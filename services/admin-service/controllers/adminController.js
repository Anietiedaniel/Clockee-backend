import { User,InviteToken, Institution} from "@clockee/shared";
import crypto from "crypto";
import fs from "fs";
import bcrypt from "bcrypt";
import csvParser from "csv-parser";
import dotenv from "dotenv";
dotenv.config();

import { sendEmail } from "../../email-service/emailService.js";
import { logAdminAction } from "../logs/auditLogger.js";
const MAX_BULK_INVITES = 500;
const INVITE_TTL_DAYS = 7;


export const disableInstitutionInvite = async (req, res) => {
  try {
    const { role, institutionId: adminInstitutionId } = req.user;
    const { id: targetInstitutionId } = req.params;

    // Decide institution scope
    const institutionId =
      role === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    // Admin safety check
    if (
      role !== "super_admin" &&
      targetInstitutionId !== adminInstitutionId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    await InviteToken.updateMany(
      {
        institutionId,
        email: null,
        expiresAt: { $gt: new Date() },
      },
      { expiresAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "Institution invites disabled successfully",
    });
  } catch (err) {
    console.error("Disable invite error:", err);
    res.status(500).json({
      message: "Failed to disable invite",
    });
  }
};

export const adminCreateUser = async (req, res) => {
  try {
    const {
      role: requesterRoles,
      institutionId: adminInstitutionId,
      userId: createdBy,
    } = req.user;

    let { id: targetInstitutionId } = req.params;

    let {
      name,
      email,
      role,
      departmentOrUnit,
      studentOrStaffId,
      password,
      phone,
    } = req.body;

    // --- Required fields ---
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // --- Normalize inputs ---
    name = name.trim();
    email = email.toLowerCase().trim();
    studentOrStaffId = studentOrStaffId?.trim();
    phone = phone?.trim();

    // --- Ensure requesterRoles is an array ---
    const requesterRoleArray = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    // --- Ensure role is always an array ---
    if (!Array.isArray(role) || role.length === 0) {
      return res.status(400).json({ message: "Role must be a non-empty array" });
    }

    // --- Validate allowed roles ---
    const allowedRoles = ["super_admin", "admin", "staff", "student", "pending", "rejected"];
    const invalidRoles = role.filter(r => !allowedRoles.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        message: `Invalid roles: ${invalidRoles.join(", ")}`,
      });
    }

    // --- Determine institution based on requester role ---
    let institutionId;
    if (requesterRoleArray.includes("super_admin")) {
      // Super admin must provide targetInstitutionId
      if (!targetInstitutionId) {
        return res.status(400).json({ message: "Super admin must provide a target institution ID" });
      }
      institutionId = targetInstitutionId;
    } else if (requesterRoleArray.includes("admin")) {
      // Admin can only create users for their own institution
      institutionId = adminInstitutionId;
      if (targetInstitutionId && targetInstitutionId !== adminInstitutionId) {
        return res.status(403).json({
          message: "Admins can only create users within their own institution",
        });
      }
    } else {
      return res.status(403).json({ message: "Admin access required" });
    }

    // --- Prevent privilege escalation ---
    if (!requesterRoleArray.includes("super_admin") && role.includes("super_admin")) {
      return res.status(403).json({
        message: "You cannot assign super admin role",
      });
    }

    // --- Prevent duplicate email ---
    if (await User.findOne({ email })) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // --- Prevent duplicate student/staff ID ---
    if (studentOrStaffId && (await User.findOne({ studentOrStaffId }))) {
      return res.status(409).json({ message: "Staff/Student ID already exists" });
    }

    // --- Fetch institution ---
    const institution = await Institution.findById(institutionId);
    if (!institution) {
      return res.status(404).json({ message: "Institution not found" });
    }

    // --- Hash password ---
    const passwordHash = await bcrypt.hash(password, 12);

    // --- Get creator name safely ---
    const creator = await User.findById(createdBy).select("name");

    // --- Create user ---
    const user = await User.create({
      name,
      email,
      role,
      institutionId,
      institutionName: institution.name,
      institutionType: institution.type,
      departmentOrUnit,
      studentOrStaffId,
      passwordHash,
      isActive: true,
      createdBy,
      creatorName: creator?.name || "System",
      phone,
    });

    // --- Remove sensitive data before sending ---
    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    return res.status(201).json({
      message: "User created successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("Admin create user error:", err);

    return res.status(500).json({
      message: "Failed to create user",
      error: err.message,
    });
  }
};

export const getPendingUsers = async (req, res) => {
  try {
    const { role, institutionId: adminInstitutionId } = req.user;
    const { id: targetInstitutionId } = req.params;

    const institutionId =
      role === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    // Prevent admin cross-institution access
    if (
      role !== "super_admin" &&
      targetInstitutionId !== adminInstitutionId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const pendingUsers = await User.find({
      institutionId,
      role: "pending",
    }).select("name email role createdAt");

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      users: pendingUsers,
    });
  } catch (err) {
    console.error("Error fetching pending users:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUserApproval = async (req, res) => {
  try {
    const { action, newRole } = req.body;
    const { id: userId } = req.params;
    const { role, institutionId: adminInstitutionId } = req.user;

    /* ================= FIND USER ================= */
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    /* ================= ACCESS CONTROL ================= */
    if (
      role !== "super_admin" &&
      user.institutionId.toString() !== adminInstitutionId.toString()
    ) {
      return res.status(403).json({
        message: "You cannot approve users from another institution",
      });
    }

    /* ================= VALIDATE ACTION ================= */
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    /* ================= STATE CHECK ================= */
    if (user.role !== "pending") {
      return res.status(400).json({
        message: "User has already been processed",
      });
    }

    /* ================= APPLY DECISION ================= */
    if (action === "approve") {
      if (!["staff", "student"].includes(newRole)) {
        return res.status(400).json({
          message: "newRole must be staff or student",
        });
      }
      user.role = newRole;
    } else {
      user.role = "rejected";
    }

    await user.save();

    /* ================= AUDIT LOG ================= */
    await logAdminAction({
      action: action === "approve" ? "USER_APPROVED" : "USER_REJECTED",
      admin: req.user.id,
      targetUser: user._id,
      metadata: { role: user.role },
    });

    /* ================= RESPONSE ================= */
    return res.status(200).json({
      success: true,
      message:
        action === "approve"
          ? "User approved successfully"
          : "User rejected successfully",
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error updating user approval:", error);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// get all users of a particular institution
export const getAllUsers = async (req, res) => {
  try {
    const { role: requesterRoles, institutionId: adminInstitutionId } = req.user;
    const { id: targetInstitutionId, role: roleFilter } = req.query;

    // --- Normalize requester roles ---
    const requesterRoleArray = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    /* ================= RESOLVE INSTITUTION ================= */
    let institutionId;

    if (requesterRoleArray.includes("super_admin")) {
      institutionId = targetInstitutionId || undefined;
    } else if (requesterRoleArray.includes("admin")) {
      institutionId = adminInstitutionId;
    } else {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    if (!institutionId && !requesterRoleArray.includes("super_admin")) {
      return res.status(400).json({
        message: "Institution ID is required",
      });
    }

    /* ================= BUILD FILTER ================= */
    const filter = {
      ...(institutionId && { institutionId }),

      // EXCLUDE pending and rejected users
      role: { $nin: ["pending", "rejected"] }, // works with arrays
    };

    // --- Role filter (must use $in) ---
    if (roleFilter) {
      const allowedRoles = ["staff", "student", "admin"];

      if (!allowedRoles.includes(roleFilter)) {
        return res.status(400).json({
          message: "Invalid role filter",
        });
      }

      filter.role = { $in: [roleFilter] }; 
      // matches inside array
    }

    /* ================= QUERY ================= */
    const users = await User.find(filter)
      .select(
        "name email role departmentOrUnit isActive createdAt creatorName"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      institutionId: institutionId || "Parent Institution",
      count: users.length,
      data: users,
    });

  } catch (err) {
    console.error("Error fetching users:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const { role: requesterRoles, institutionId: adminInstitutionId } = req.user;
    const { id: targetInstitutionId, role: roleFilter } = req.query;

    // Normalize requester roles
    const requesterRoleArray = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    /* ================= RESOLVE INSTITUTION ================= */
    let institutionId;

    if (requesterRoleArray.includes("super_admin")) {
      institutionId = targetInstitutionId || undefined;
    } else if (requesterRoleArray.includes("admin")) {
      institutionId = adminInstitutionId;
    } else {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    if (!institutionId && !requesterRoleArray.includes("super_admin")) {
      return res.status(400).json({
        message: "Institution ID is required",
      });
    }

    /* ================= BUILD BASE FILTER ================= */

    const filter = {
      ...(institutionId && { institutionId }),

      // Exclude invalid roles
      role: { $nin: ["pending", "rejected"] },
    };

    /* ================= ROLE FILTER ================= */

    if (roleFilter) {
      const allowedRoles = ["super-admin", "admin"];

      if (!allowedRoles.includes(roleFilter)) {
        return res.status(400).json({
          message: "Invalid role filter",
        });
      }

      // Replace role filter completely
      filter.role = { $in: [roleFilter] };
    }

    /* ================= QUERY ================= */

    const users = await User.find(filter)
      .select("name email role departmentOrUnit isActive createdAt creatorName")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      institutionId: institutionId || "ALL",
      count: users.length,
      data: users,
    });

  } catch (err) {
    console.error("Error fetching users:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const deactivateUser = async (req, res) => {
  try {
    const { role, institutionId: adminInstitutionId } = req.user;
    const { id } = req.params; // user to deactivate

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ================= ACCESS CONTROL =================
    if (
      role !== "super_admin" &&
      user.institutionId.toString() !== adminInstitutionId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // ================= BUSINESS RULES =================
    if (["admin", "super_admin"].includes(user.role)) {
      return res.status(400).json({
        message: "Admins cannot be deactivated",
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        message: "User is already deactivated",
      });
    }

    // ================= ACTION =================
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("Deactivate user error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const reactivateUser = async (req, res) => {
  try {
    const { role, institutionId: adminInstitutionId } = req.user;
    const { id } = req.params; // user to reactivate
    
  const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

     if (
      role !== "super_admin" &&
      user.institutionId.toString() !== adminInstitutionId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (user.isActive) {
      return res.status(400).json({
        message: "User is already active",
      });
    }

    user.isActive = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User reactivated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("Reactivate user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const rejectUser = async (req, res) => {
  try {
   const { role: requesterRole, institutionId: adminInstitutionId } = req.user;
    const { id } = req.params; // user to reject
  
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure same institution
     if (
      role !== "super_admin" &&
      user.institutionId.toString() !== adminInstitutionId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Only pending users can be rejected
    if (user.role !== "pending") {
      return res.status(400).json({
        message: "Only pending users can be rejected",
      });
    }

    user.role = "rejected";
    

    await user.save();

    res.status(200).json({
      success: true,
      message: "User rejected successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("Reject user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// for a specific staff
export const createInvite = async (req, res) => {
  try {
    const {
      role: requesterRoles,
      institutionId: adminInstitutionId,
      userId: adminId,
      name: creatorName,
    } = req.user;

    let { email, role: inviteRole } = req.body;
    const { institutionId: targetInstitutionId } = req.query;

    const expiresInDays = 7;

    // --- Normalize requester roles ---
    const requesterRoleArray = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    // --- Normalize inviteRole to array ---
    if (!Array.isArray(inviteRole) || inviteRole.length === 0) {
      return res.status(400).json({
        message: "Role must be a non-empty array",
      });
    }

    // --- Resolve institution ---
    const institutionId = requesterRoleArray.includes("super_admin")
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        message: "institutionId is required",
      });
    }

    // --- Validation ---
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const allowedRoles = ["staff", "student", "admin"];

    const invalidRoles = inviteRole.filter(r => !allowedRoles.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        message: `Invalid roles: ${invalidRoles.join(", ")}`,
      });
    }

    // --- Prevent privilege escalation ---
    if (
      !requesterRoleArray.includes("super_admin") &&
      inviteRole.includes("admin")
    ) {
      return res.status(403).json({
        message: "Only super admin can invite admin users",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // --- Check existing user ---
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // --- Check existing invite ---
    const existingInvite = await InviteToken.findOne({
      email: normalizedEmail,
      institutionId,
      expiresAt: { $gt: new Date() },
    });

    if (existingInvite) {
      return res.status(409).json({
        message: "An active invite already exists for this email",
      });
    }

    // --- Create invite ---
    const token = crypto.randomBytes(32).toString("hex");

    const invite = await InviteToken.create({
      token,
      email: normalizedEmail,
      institutionId,
      role: inviteRole, // now array
      creatorName,
      createdBy: adminId,
      expiresAt: new Date(
        Date.now() + expiresInDays * 24 * 60 * 60 * 1000
      ),
    });

    return res.status(201).json({
      message: "Invite created successfully",
      inviteLink: `${process.env.FRONTEND_URL}/register?invite=${token}`,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error("Create invite error:", err);

    return res.status(500).json({
      message: "Failed to create invite",
      error: err.message,
    });
  }
};

export const registerWithTokenInvite = async (req, res) => {
  try {
    const { token, name, email, password, studentOrStaffId } = req.body;

    // --- Validate required fields ---
    if (!token || !name || !password) {
      return res.status(400).json({
        message: "Token, name and password are required",
      });
    }

    // --- Find invite ---
    const invite = await InviteToken.findOne({
      token,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      return res.status(400).json({
        message: "Invalid or expired invite link",
      });
    }

    // --- Determine email (Direct vs Public invite) ---
    let finalEmail;

    if (invite.email) {
      // Direct invite → enforce email
      finalEmail = invite.email;

      if (email && email !== invite.email) {
        return res.status(400).json({
          message: "This invite is restricted to a specific email",
        });
      }
    } else {
      // Public invite → email required from user
      if (!email) {
        return res.status(400).json({
          message: "Email is required for public registration",
        });
      }

      finalEmail = email;
    }

    finalEmail = finalEmail.toLowerCase().trim();

    // --- Prevent duplicate email ---
    const existingUser = await User.findOne({ email: finalEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    // --- Prevent duplicate staff/student ID ---
    if (studentOrStaffId) {
      const existingId = await User.findOne({ studentOrStaffId });
      if (existingId) {
        return res.status(409).json({
          message: "Student/Staff ID already exists",
        });
      }
    }

    // --- Hash password ---
    const passwordHash = await bcrypt.hash(password, 12);

    // --- Create user with PENDING role ---
    const user = await User.create({
      name: name.trim(),
      email: finalEmail,
      passwordHash,
      institutionId: invite.institutionId,
      role: ["pending"], // ALWAYS pending
      createdBy: invite.createdBy,
      creatorName: invite.creatorName,
      departmentOrUnit: invite.departmentOrUnit,
      studentOrStaffId,
      isActive: false, // optional until approved
    });

    // --- Prevent reuse of invite ---
    await InviteToken.deleteOne({ _id: invite._id });

    // --- Clean response ---
    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    return res.status(201).json({
      message: "Registration successful. Awaiting admin approval.",
      user: userResponse,
    });

  } catch (err) {
    console.error("Register with invite error:", err);

    return res.status(500).json({
      message: "Registration failed",
      error: err.message,
    });
  }
};

export const bulkInvite = async (req, res) => {
  const {
    role: requesterRole,
    institutionId: adminInstitutionId,
    userId: adminId,
    name: creatorName,
  } = req.user;

  const { institutionId: targetInstitutionId } = req.query;

  const institutionId =
    requesterRole === "super_admin"
      ? targetInstitutionId
      : adminInstitutionId;

  if (!institutionId) {
    return res.status(400).json({
      message: "institutionId is required",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      message: "CSV file is required",
    });
  }

  const rows = [];
  const results = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csvParser())
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (rows.length > MAX_BULK_INVITES) {
      return res.status(400).json({
        message: `CSV exceeds ${MAX_BULK_INVITES} rows limit`,
      });
    }

    for (const row of rows) {
      try {
        if (!row.email || !row.role) {
          throw new Error("Missing email or role");
        }

        const email = row.email.toLowerCase().trim();
        const role = row.role.toLowerCase().trim();

        if (!ALLOWED_ROLES.includes(role)) {
          throw new Error("Invalid role");
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) throw new Error("User already exists");

        const existingInvite = await InviteToken.findOne({
          email,
          institutionId,
          expiresAt: { $gt: new Date() },
        });
        if (existingInvite) throw new Error("Active invite already exists");

        const token = crypto.randomBytes(32).toString("hex");

        await InviteToken.create({
          token,
          email,
          role,
          institutionId,
          departmentOrUnit: row.departmentOrUnit || null,
          studentOrStaffId: row.studentOrStaffId || null,
          creatorName,
          createdBy: adminId,
          expiresAt: new Date(
            Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
          ),
        });

        await sendEmail({
          to: email,
          subject: "You're invited to Clockee",
          html: `
            <p>Hello,</p>
            <p>You have been invited to join Clockee.</p>
            <p>
              <a href="${process.env.FRONTEND_URL}/register?invite=${token}">
                Complete your registration
              </a>
            </p>
          `,
        });

        results.push({ email, status: "success" });
      } catch (err) {
        results.push({
          email: row.email || "unknown",
          status: "failed",
          error: err.message,
        });
      }
    }

    return res.status(200).json({
      message: "Bulk invites processed",
      total: rows.length,
      successCount: results.filter(r => r.status === "success").length,
      failedCount: results.filter(r => r.status === "failed").length,
      results,
    });
  } catch (err) {
    console.error("Bulk invite error:", err);
    return res.status(500).json({
      message: "Bulk invite failed",
    });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};

// generate onboard link/we can auto email later

export const generatePublicOnboardingLink = async (req, res) => {
  try {
    const {
      userId,
      name: creatorName,
      role: requesterRoles,
      institutionId: adminInstitutionId,
    } = req.user;

    const { institutionId: targetInstitutionId } = req.query;
    let { targetRole } = req.body; 

    // --- Normalize requester roles ---
    const requesterRoleArray = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    // --- Normalize targetRole to array ---
    if (!Array.isArray(targetRole) || targetRole.length === 0) {
      return res.status(400).json({
        message: "targetRole must be a non-empty array",
      });
    }

    const allowedRoles = ["staff", "student"];

    const invalidRoles = targetRole.filter(r => !allowedRoles.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        message: `Invalid roles: ${invalidRoles.join(", ")}`,
      });
    }

    // --- Resolve institution ---
    let institutionId;

    if (requesterRoleArray.includes("super_admin")) {
      if (!targetInstitutionId) {
        return res.status(400).json({
          message: "institutionId is required for super admin",
        });
      }
      institutionId = targetInstitutionId;
    } else if (requesterRoleArray.includes("admin")) {
      institutionId = adminInstitutionId;
    } else {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    if (!institutionId) {
      return res.status(400).json({
        message: "institutionId could not be resolved",
      });
    }

    // --- Check existing onboarding link ---
    const existingInvite = await InviteToken.findOne({
      institutionId,
      type: "public_onboarding",
      expiresAt: { $gt: new Date() },
    });

    if (existingInvite) {
      return res.status(409).json({
        message: "An active onboarding link already exists for this institution",
      });
    }

    // --- Generate token ---
    const token = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // --- Create invite ---
    await InviteToken.create({
      token,
      institutionId,
      role: targetRole, // ✅ now array
      type: "public_onboarding",
      expiresAt,
      createdBy: userId,
      creatorName,
    });

    return res.status(201).json({
      message: "Public onboarding link created successfully",
      onboardingLink: `${process.env.FRONTEND_URL}/onboard?token=${token}`,
      expiresAt,
    });

  } catch (err) {
    console.error("Public onboarding error:", err);

    return res.status(500).json({
      message: "Failed to generate onboarding link",
      error: err.message,
    });
  }
};

export const getInstitutionInvite = async (req, res) => {
  try {
    const {
      role: requesterRole,
      institutionId: adminInstitutionId,
    } = req.user;

    const { institutionId: targetInstitutionId } = req.query;

    const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        message: "Institution ID is required",
      });
    }

    const invites = await InviteToken.find({
      institutionId,
      expiresAt: { $gt: new Date() },
    }).select("email role expiresAt createdAt");

    return res.status(200).json({
      success: true,
      count: invites.length,
      data: invites,
    });
  } catch (err) {
    console.error("Fetch invite error:", err);
    res.status(500).json({ message: "Failed to fetch invites" });
  }
};


export const resendInvite = async (req, res) => {
  try {
    const {
      role: requesterRole,
      institutionId: adminInstitutionId,
    } = req.user;

    const { institutionId: targetInstitutionId } = req.query;

    const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        message: "Institution ID is required",
      });
    }

    // invite id
    const { id: inviteId } = req.params;
    const invite = await InviteToken.findById(inviteId);

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (
      requesterRole !== "super_admin" &&
      invite.institutionId.toString() !== institutionId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Public onboarding links cannot be resent
    if (!invite.email) {
      return res.status(400).json({
        message: "Public onboarding links cannot be resent",
      });
    }

    const existingUser = await User.findOne({
      email: invite.email.toLowerCase(),
    });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Always regenerate token
    invite.token = crypto.randomBytes(32).toString("hex");
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invite.save();

    const inviteLink = `${process.env.FRONTEND_URL}/register?invite=${invite.token}`;

    res.status(200).json({
      success: true,
      message: "Invite resent successfully",
      inviteLink,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error("Resend invite error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to resend invite",
    });
  }
};

export const updateUserRemoteAccess = async (req, res) => {
  try {
    const {
      role: requesterRole,
      institutionId: adminInstitutionId,
    } = req.user;

    const { institutionId: targetInstitutionId, ...updates } = req.body;

    const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        message: "Institution ID is required",
      });
    }

    const user = await User.findOne({
      _id: req.params.id,
      institutionId,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found in this institution",
      });
    }

    user.allowRemoteClocking = updates.allowRemoteClocking;
    await user.save();

    return res.json({
      message: "User remote access updated successfully",
      user,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to update user remote access",
    });
  }
};

export const promoteToAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const requester = req.user;

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Prevent modifying super admin
    if (targetUser.roles.includes("super_admin")) {
      return res.status(400).json({
        message: "Cannot modify super admin"
      });
    }

    // Prevent self-promotion
    if (targetUser._id.toString() === requester._id.toString()) {
      return res.status(400).json({
        message: "You cannot promote yourself"
      });
    }

    // Cross-institution protection
    if (
      !requester.roles.includes("super_admin") &&
      requester.institutionId.toString() !==
        targetUser.institutionId.toString()
    ) {
      return res.status(403).json({
        message: "You cannot manage users from another institution"
      });
    }

    // Owner check if not super_admin
    if (!requester.roles.includes("super_admin")) {
      const institution = await Institution.findById(
        requester.institutionId
      ).select("owner");

      if (!institution) {
        return res.status(404).json({
          message: "Institution not found"
        });
      }

      if (institution.owner.toString() !== requester._id.toString()) {
        return res.status(403).json({
          message: "Only the institution owner can promote admins"
        });
      }
    }

    // Already admin check
    if (targetUser.roles.includes("admin")) {
      return res.status(400).json({
        message: "User is already an admin"
      });
    }

    // Promote
    targetUser.roles.push("admin");
    await targetUser.save();

    res.status(200).json({
      message: "User promoted to admin successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Promotion failed"
    });
  }
};

export const demoteAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const requester = req.user;

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Prevent modifying super_admin
    if (targetUser.roles.includes("super_admin")) {
      return res.status(400).json({
        message: "Cannot modify super admin"
      });
    }

    // Cross-institution protection
    if (
      !requester.roles.includes("super_admin") &&
      requester.institutionId.toString() !==
        targetUser.institutionId.toString()
    ) {
      return res.status(403).json({
        message: "You cannot manage users from another institution"
      });
    }

    const institution = await Institution.findById(
      requester.institutionId
    ).select("owner");

    if (!institution) {
      return res.status(404).json({
        message: "Institution not found"
      });
    }

    // Prevent demoting institution owner
    if (
      institution.owner.toString() === targetUser._id.toString()
    ) {
      return res.status(403).json({
        message: "Cannot demote institution owner"
      });
    }

    // Only owner or super_admin can demote
    if (
      !requester.roles.includes("super_admin") &&
      institution.owner.toString() !== requester._id.toString()
    ) {
      return res.status(403).json({
        message: "Only institution owner can demote admin"
      });
    }

    // Ensure target is actually admin
    if (!targetUser.roles.includes("admin")) {
      return res.status(400).json({
        message: "User is not an admin"
      });
    }

    // Remove admin role
    targetUser.roles = targetUser.roles.filter(
      role => role !== "admin"
    );

    //  ensure user still has at least one role
    if (targetUser.roles.length === 0) {
      targetUser.roles.push("staff");
    }

    await targetUser.save();

    res.status(200).json({
      message: "Admin demoted successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Demotion failed"
    });
  }
};