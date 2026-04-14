import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";



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

export const registerWithInvite = async (req, res) => {
  try {
    const { token } = req.query;
    const { name, email, password } = req.body;

    const invite = await InviteToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      return res.status(400).json({ message: "Invalid or expired invite" });
    }

       //  Check if expired
    if (invite.expiresAt < new Date()) {
      return res.status(400).json({
        message: "This invite has expired. Please ask your admin to resend the invite."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: invite.role,
      institutionId: invite.institutionId,
      departmentOrUnit: invite.departmentOrUnit,
      studentOrStaffId: invite.studentOrStaffId,
      isActive: true,
    });

    invite.used = true;
    await invite.save();

    res.status(201).json({
      message: "Registration successful",
      userId: user._id,
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
};

// export const registerViaPublicInvite = async (req, res) => {
//   try {
//     const { token } = req.params;
//     const { name, email,password, departmentOrUnit, studentOrStaffId } = req.body;

//     const invite = await InviteToken.findOne({
//       token,
//       isActive: true,
//     });

//     if (!invite) {
//       return res.status(400).json({ message: "Invalid invite link" });
//     }

//     const existing = await User.findOne({ email });
//     if (existing) {
//       return res.status(400).json({ message: "Email already registered" });
//     }
//      const passwordHash = await bcrypt.hash(password, 12);
//     await User.create({
//       name,
//       email,
//       passwordHash,
//       institutionId: invite.institutionId,
//       departmentOrUnit,
//       studentOrStaffId,
//       role: "pending", // admin to approve
//       isActive: true,
//       createdBy: invite.createdBy,
//     });

//     res.status(201).json({
//       message: "Registration submitted. Await admin approval.",
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Registration failed" });
//   }
// };
export const registerViaPublicOnboardingLink = async (req, res) => {
  try {
    const { token } = req.query;
    const {
      email,
      password,
      address,
      phone,
      name,
    } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Invalid onboarding link" });
    }

    const onboardingToken = await InviteToken.findOne({
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!onboardingToken) {
      return res.status(400).json({
        message: "This onboarding link has expired or is invalid",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      passwordHash,
      role: "pending", // 🔐 admin approval required
      institutionId: onboardingToken.institutionId,

      // profile info
      address,
      phone,

      isActive: false,
      createdBy: onboardingToken.createdBy, // admin who created link
    });

    res.status(201).json({
      message:
        "Registration successful. Await admin approval before login.",
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
};

// POST   /api/admin/onboarding/token     → createOnboardingToken
// GET    /api/admin/onboarding/tokens    → list tokens
// PATCH  /api/admin/onboarding/token/:id → disable token


export const registerViaQrInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const { name, email,password, departmentOrUnit, studentOrStaffId } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    // Validate invite
    const invite = await InviteToken.findOne({
      token,
      isActive: true,
    });

    if (!invite) {
      return res.status(400).json({ message: "Invalid or expired invite link" });
    }

    //  Prevent duplicate users
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    //  Create user (PENDING)
    await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      institutionId: invite.institutionId,
      departmentOrUnit,
      studentOrStaffId,
      role: "pending",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Registration submitted. Await admin approval.",
    });
  } catch (err) {
    console.error("QR registration error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
};

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

    /* ================= SECURITY (DON'T REVEAL EXISTENCE) ================= */
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If email exists, reset link has been sent",
      });
    }

    /* ================= GENERATE TOKEN ================= */
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    /* ================= SAVE TOKEN ================= */
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 min

    await user.save();

    /* ================= RESET URL ================= */
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    /* ================= EMAIL TRANSPORT ================= */
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.ALERT_EMAIL_FROM,
        pass: process.env.ALERT_EMAIL_PASS,
      },
    });

    /* ================= SEND EMAIL ================= */
    await transporter.sendMail({
      to: user.email,
      from: process.env.ALERT_EMAIL_FROM,
      subject: "Clockee Password Reset",
      html: `
        <h3>Password Reset Request</h3>
        <p>Click below to reset your password. This link expires in 10 minutes.</p>
        <a href="${resetURL}">Reset Password</a>
      `,
    });

    return res.json({
      success: true,
      message: "If email exists, reset link has been sent",
    });

  } catch (err) {
    console.error(err);

    logger.error(err.message);
    sendAlert("auth-service", "error", err.message, "/forgot-password");

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

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

    user.passwordHash = await hashPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
}


