import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
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




const logger = createLogger("auth-service");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}


function generateToken({ userId, sessionId, role, institutionId, name, email }) {
  return jwt.sign(
    {
      userId,
      sessionId,
      role,
      institutionId,
      name,
      email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
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
    const { email, password, deviceInfo } = req.body; 

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

    // ⚠️ FIX: role is an array in your schema
    if (user.role?.includes("pending")) {
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

    // ================= NEW: SESSION =================
    const sessionId = uuidv4();

    user.activeSession = {
      sessionId,
      deviceInfo: deviceInfo || "unknown device",
      lastLogin: new Date(),
    };

    await user.save();

    // ================= TOKEN =================
    const token = generateToken({
      userId: user._id,
      sessionId, // 🔥 VERY IMPORTANT
    });

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
      session: user.activeSession,
    });

  } catch (err) {
    next(err);
  }
}

export const logoutUser = async (req, res) => {
  try {
    const userId = req.user.userId; // from protect middleware

    await User.findByIdAndUpdate(userId, {
      activeSession: null, // 🔥 kill session
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
};;

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
    const {
      role,
      institutionId: adminInstitutionId,
      userId: adminId,
    } = req.user;

    const { targetUserId, institutionId: targetInstitutionId } = req.body;

    /* ================= ROLE CHECK ================= */

    const roles = Array.isArray(role) ? role : [role];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    /* ================= VALIDATION ================= */

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "targetUserId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid targetUserId",
      });
    }

    if (isSuperAdmin && !targetInstitutionId) {
      return res.status(400).json({
        success: false,
        message: "institutionId is required for super admin",
      });
    }

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    /* ================= FETCH USER ================= */

    const targetUser = await User.findOne({
      _id: targetUserId,
      institutionId,
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    /* ================= GENERATE CODES ================= */

    const rawCodes = Array.from({ length: 5 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    const hashedCodes = await Promise.all(
      rawCodes.map(async (code) => ({
        code: await bcrypt.hash(code, 10),
        used: false,
      }))
    );

    /* ================= SAVE ================= */

    targetUser.backupCodes = hashedCodes;
    await targetUser.save();

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      message: "Backup codes generated successfully",
      data: {
        userId: targetUser._id,
        name: targetUser.name,
        codes: rawCodes, // ⚠️ show only once
        creator: adminId,
      },
    });

  } catch (err) {
    console.error("Generate backup codes error:", err);
    next(err);
  }
}




export async function useBackupCode(req, res, next) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and backup code are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.backupCodes?.length) {
      return res.status(400).json({
        success: false,
        message: "No backup codes available",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    /* ================= VERIFY CODE ================= */

    let validCode = null;

    for (const bc of user.backupCodes) {
      if (bc.used) continue;

      const isMatch = await verifyPassword(code, bc.code);

      if (isMatch) {
        validCode = bc;
        break;
      }
    }

    if (!validCode) {
      return res.status(401).json({
        success: false,
        message: "Invalid or used backup code",
      });
    }

    /* ================= MARK USED ================= */

    validCode.used = true;

    /* ================= SESSION ================= */

    const sessionId = uuidv4();

    user.activeSession = {
      sessionId,
      lastLogin: new Date(),
      deviceInfo: "backup-code-login",
    };

    await user.save();

    /* ================= TOKEN ================= */

    const token = generateToken({
      userId: user._id,
      sessionId,
      role: user.role,
      institutionId: user.institutionId,
      name: user.name,
      email: user.email,
    });

    return res.json({
      success: true,
      message: "Backup code accepted",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
      },
      session:user.activeSession,
    });

  } catch (err) {
    console.error("Backup code error:", err);
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

    // 🔐 IMPORTANT: invalidate active session (single-device system)
    user.activeSession = null;

    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    /* ================= SMTP CONFIG ================= */
    const port = Number(process.env.SMTP_PORT || 465);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.ALERT_EMAIL_FROM,
        pass: process.env.ALERT_EMAIL_PASS,
      },
      connectionTimeout: 10000,
    });

    /* ================= VERIFY SMTP ================= */
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


