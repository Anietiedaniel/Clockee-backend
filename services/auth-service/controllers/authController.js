import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import {
  User,
  hashPassword,
  verifyPassword,
  generateRandomCode,
  hashCodes,
  createLogger,
  sendAlert,
  Visitor,
  InviteToken,
  TokenBlacklist,
} from "@clockee/shared";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


const logger = createLogger("auth-service");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}


function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      institutionId: user.institutionId,
      name: user.name, 
      email: user.email,
      
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export const registerVisitor = async (req, res) => {
  try {
    const { name, email, companyName, phone, interest } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    // Check DB connection safety
    const existing = await Visitor.findOne({ email });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Visitor already registered ",
      });
    }

    await Visitor.create({
      name,
      email,
      companyName,
      phone,
      interest,
    });

    return res.status(201).json({
      success: true,
      message: "Successfully registered visitor",
    });

  } catch (err) {
    console.error("REGISTER VISITOR ERROR:", err);

    // Handle duplicate key explicitly
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists ",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to register visitor",
    });
  }
};


export async function registerUser(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      institutionId,
      departmentOrUnit,
      studentOrStaffId,
    } = req.body;

    if (!name || !email || !password || !institutionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await hashPassword(password);

    await User.create({
      name,
      email,
      passwordHash,
      institutionId,
      departmentOrUnit,
      studentOrStaffId,
      role: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Registration successful. Awaiting admin approval.",
    });
  } catch (err) {
    next(err);
  }
}


export async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.role === "pending") {
      return res.status(403).json({
        success: false,
        status: "PENDING_APPROVAL",
        message: "Account awaiting approval by admin",
      });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
      },
    });

  } catch (err) {
    next(err);
  }
}

export const logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token required",
      });
    }

    const decoded = jwt.decode(token);

    if (!decoded?.exp) {
      return res.status(400).json({
        success: false,
        message: "Invalid token",
      });
    }

    await TokenBlacklist.create({
      token,
      expiresAt: new Date(decoded.exp * 1000),
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });

  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

export async function verifyToken(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ valid: false });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false });
  }
}


export async function generateBackupCodes(req, res, next) {
  try {
    const admin = await User.findById(req.user.userId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { targetUserId } = req.body;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target user not found",
      });
    }

    const rawCodes = Array.from({ length: 5 }, generateRandomCode);
    targetUser.backupCodes = await hashCodes(rawCodes);
    await targetUser.save();

    res.json({
      success: true,
      message: "Backup codes generated",
      codes: rawCodes,
    });
  } catch (err) {
    next(err);
  }
}

export async function useBackupCode(req, res, next) {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user?.backupCodes?.length) {
      return res.status(400).json({
        success: false,
        message: "No backup codes available",
      });
    }

    const validCode = user.backupCodes.find(
      bc => !bc.used && verifyPassword(code, bc.code)
    );

    if (!validCode) {
      return res.status(401).json({
        success: false,
        message: "Invalid or used backup code",
      });
    }

    validCode.used = true;
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Backup code accepted",
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res) {
  try {
    let { email } = req.body;

    /* ================= VALIDATION ================= */
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });

    /* ================= SECURITY RESPONSE ================= */
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If email exists, reset link has been sent",
      });
    }

    /* ================= GENERATE RESET TOKEN ================= */
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    /* ================= FIXED SMTP CONFIG ================= */
    const port = Number(process.env.SMTP_PORT || 465);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // ✅ FIX: automatic secure handling
      auth: {
        user: process.env.ALERT_EMAIL_FROM,
        pass: process.env.ALERT_EMAIL_PASS,
      },
      connectionTimeout: 10000, // ✅ prevents hanging forever
    });

    /* ================= VERIFY SMTP BEFORE SENDING ================= */
    await transporter.verify().catch((err) => {
      console.error("SMTP VERIFY FAILED:", err.message);
      throw new Error("Email service not available");
    });

    /* ================= SEND EMAIL ================= */
    await transporter.sendMail({
      to: user.email,
      from: process.env.ALERT_EMAIL_FROM,
      subject: "Clockee Password Reset",
      html: `
        <h3>Password Reset Request</h3>
        <p>This link expires in 10 minutes.</p>
        <a href="${resetURL}">Reset Password</a>
      `,
    });

    return res.json({
      success: true,
      message: "If email exists, reset link has been sent",
    });

  } catch (err) {
    console.error("Forgot password error:", err.message);

    logger.error(err.message);
    sendAlert("auth-service", "error", err.message, "/forgot-password");

    return res.status(500).json({
      success: false,
      message: "Failed to send reset email",
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    /* ================= VALIDATION ================= */
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    /* ================= HASH TOKEN ================= */
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    /* ================= FIND USER ================= */
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    /* ================= UPDATE PASSWORD ================= */
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);

    /* ================= CLEAR RESET FIELDS ================= */
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google token required",
      });
    }

    /* ================= VERIFY GOOGLE TOKEN ================= */

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const {
      email,
      name,
      picture,
      sub: googleId,
    } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Google account has no email",
      });
    }

    /* ================= CHECK USER ================= */

    let user = await User.findOne({ email });

    /* ================= CREATE USER IF NOT EXISTS ================= */

    if (!user) {
      user = await User.create({
        name,
        email,
        avatar: picture,
        googleId,
        authProvider: "google",
        role: "pending", // or "user" depending on your flow
      });
    }

    /* ================= GENERATE YOUR JWT ================= */

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        avatar: user.avatar,
      },
    });

  } catch (error) {
    console.error("Google auth error:", error);

    return res.status(500).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};
