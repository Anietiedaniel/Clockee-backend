
import { Institution, User } from "@clockee/shared";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

export const createInstitutionWithOwner = async (req, res) => {
  console.log("🔥 ROUTE HIT");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { role, userId: adminId } = req.user;

    // Only super_admin can create
    if (!Array.isArray(role) || !role.includes("super_admin")) {
  return res.status(403).json({
    message: "Only super admin can create institutions",
  });
}

    const {
      name,
      type,
      address,
      email,
      phone,
      industry,
      ownerData, // { name, email, password }
    } = req.body;

    // Validation
    if (!name || !type) {
      return res.status(400).json({
        message: "Institution name and type are required",
      });
    }

    if (!ownerData?.name || !ownerData?.email || !ownerData?.password) {
      return res.status(400).json({
        message: "Owner name, email and password are required",
      });
    }

    // Check duplicates
    const existingInstitution = await Institution.findOne({ email }).session(session);
    if (existingInstitution) {
      await session.abortTransaction();
      return res.status(409).json({
        message: "Institution with this email already exists",
      });
    }

    const existingUser = await User.findOne({ email: ownerData.email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(409).json({
        message: "Owner email already exists",
      });
    }

    // Create Institution first (temporary owner)
    const institution = new Institution({
      name: name.trim(),
      type,
      address,
      email,
      phone,
      owner: null,
      createdBy: adminId,
      meta: {
        industry,
      },
    });

    await institution.save({ session });

    //  Hash password
    const hashedPassword = await bcrypt.hash(ownerData.password, 10);

    // Create Owner User
    const owner = new User({
      name: ownerData.name,
      email: ownerData.email,
      passwordHash: hashedPassword,
      role: "admin",
      institutionId: institution._id,
      institutionName: institution.name,
      institutionType: institution.type,
      createdBy: adminId,
    });

    await owner.save({ session });

    //  Link owner back to institution
    institution.owner = owner._id;
    await institution.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Institution and owner created successfully",
      institutionId: institution._id,
      ownerId: owner._id,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Create institution error:", error);
    res.status(500).json({
      message: "Failed to create institution",
      error: error.message,
    });
  }
};

export const superCreateAdmin = async (req, res) => {
  try {
    const {
      role: requesterRoles,
      userId: createdBy,
    } = req.user;

    const { id: targetInstitutionId } = req.params;

    // --- Normalize requester roles ---
    const requesterRoleArray = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    // --- Authorization: ONLY super_admin ---
    if (!requesterRoleArray.includes("super_admin")) {
      return res.status(403).json({
        message: "Only super admin can create admin users",
      });
    }

    // --- Validate ObjectId ---
    if (
      !targetInstitutionId ||
      !mongoose.Types.ObjectId.isValid(targetInstitutionId)
    ) {
      return res.status(400).json({
        message: "Invalid or missing Institution ID",
      });
    }

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
    phone = phone?.trim();
    studentOrStaffId = studentOrStaffId?.trim();

    // --- Ensure role is array ---
    if (!Array.isArray(role)) {
      role = [role];
    }

    // --- Allowed roles ---
    const allowedRoles = [
      "super_admin",
      "admin",
      "staff",
      "student",
      "pending",
      "rejected",
    ];

    const invalidRoles = role.filter((r) => !allowedRoles.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        message: `Invalid roles: ${invalidRoles.join(", ")}`,
      });
    }

    // --- Strict admin-only creation ---
    if (!(role.length === 1 && role[0] === "admin")) {
      return res.status(405).json({
        message: "Only admin role allowed",
      });
    }

    // --- Prevent duplicate email ---
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    // --- Prevent duplicate student/staff ID ---
    if (studentOrStaffId) {
      const existingId = await User.findOne({ studentOrStaffId });
      if (existingId) {
        return res.status(409).json({
          message: "Staff/Student ID already exists",
        });
      }
    }

    // --- Fetch institution ---
    const institution = await Institution.findById(targetInstitutionId);
    if (!institution) {
      return res.status(404).json({
        message: "Institution not found",
      });
    }

    // --- Hash password ---
    const passwordHash = await bcrypt.hash(password, 12);

    // --- Get creator name ---
    const creator = await User.findById(createdBy).select("name");

    // --- Create admin user ---
    const user = await User.create({
      name,
      email,
      role, // ["admin"]
      institutionId: targetInstitutionId,
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

    // --- Remove sensitive data ---
    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    return res.status(201).json({
      message: "Admin created successfully",
      user: userResponse,
    });

  } catch (err) {
    console.error("Admin create user error:", err);

    return res.status(500).json({
      message: "Failed to create user",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : undefined,
    });
  }
};

// only super admin can do this
// export const getAllInstitutions = async (req, res) => {
//   try {
//     const institutions = await Institution.find()
//       .select("name type isActive createdAt")
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       total: institutions.length,
//       institutions,
//     });
//   } catch (err) {
//     console.error("Get institutions error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const getAllInstitutions = async (req, res) => {
  try {
    /* ================= FETCH INSTITUTIONS RAW ================= */

    // 🔥 KEY FIX:
    // Use native collection query to bypass Mongoose casting issues
    // caused by corrupted legacy owner values like " jackie"
    const institutions = await Institution.collection
      .find(
        {},
        {
          projection: {
            name: 1,
            type: 1,
            isActive: 1,
            createdAt: 1,
            owner: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    /* ================= ENRICH ================= */

    const enrichedInstitutions = await Promise.all(
      institutions.map(async (institution) => {
        const institutionId = institution._id;

        let ownerData = null;

        /* ================= SAFE OWNER ================= */

        if (institution.owner) {
          const ownerValue = String(institution.owner).trim();

          // Only lookup if valid ObjectId
          if (mongoose.Types.ObjectId.isValid(ownerValue)) {
            const owner = await User.findById(ownerValue)
              .select("name email")
              .lean();

            if (owner) {
              ownerData = {
                id: owner._id,
                name: owner.name,
                email: owner.email,
              };
            }
          } else {
            // Legacy bad data fallback
            ownerData = {
              id: null,
              name: ownerValue,
              email: null,
            };
          }
        }

        /* ================= COUNTS ================= */

        const adminCount = await User.countDocuments({
          institutionId,
          role: { $in: ["admin"] },
          isActive: true,
        });

        const staffCount = await User.countDocuments({
          institutionId,
          role: { $in: ["staff", "student"] },
          isActive: true,
        });

        return {
          _id: institution._id,
          name: institution.name,
          type: institution.type,
          isActive: institution.isActive,
          createdAt: institution.createdAt,

          owner: ownerData,

          stats: {
            admins: adminCount,
            staff: staffCount,
          },
        };
      })
    );

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      total: enrichedInstitutions.length,
      institutions: enrichedInstitutions,
    });

  } catch (err) {
    console.error("Get institutions error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

// only super admin can do this
export const toggleInstitutionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be boolean" });
    }

    const institution = await Institution.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!institution) {
      return res.status(404).json({ message: "Institution not found" });
    }

    res.status(200).json({
      message: `Institution ${isActive ? "activated" : "deactivated"} successfully`,
      institution,
    });
  } catch (err) {
    console.error("Toggle institution error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// only supper admin can do this
export const assignInstitutionAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.institutionId.toString() !== id) {
      return res.status(400).json({ message: "User does not belong to institution" });
    }

    user.role = "admin";
    await user.save();

    res.status(200).json({
      message: "User promoted to institution admin",
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Assign admin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// only super admin can do this
export const getAllUsersPlatform = async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role institutionId isActive createdAt")
      .populate("institutionId", "name");

    res.status(200).json({
      total: users.length,
      users,
    });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllAdminsPlatform = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ["admin"] } // matches ["admin"] OR ["admin","staff"]
    })
      .select("name email role institutionId isActive createdAt")
      .populate("institutionId", "name");

    res.status(200).json({
      total: admins.length,
      admins,
    });
  } catch (err) {
    console.error("Get admins error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// admin and super admin can do this
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ["admin", "staff", "student"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent touching another super admin
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "Cannot modify super admin" });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      message: "User role updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Role update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const adminOnboardStatus = (req, res) => {
  res.status(200).json({
    success: true,
    status: "ONBOARDED",
    message: "Admin is onboard",
  });
};

export const getAllInstitutionOwners = async (req, res) => {
  try {
    const { role } = req.user;

    const isSuperAdmin = role?.includes("super_admin");

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only super admin can access all institution owners",
      });
    }

    /* ================= FETCH INSTITUTIONS WITH OWNERS ================= */

    const institutions = await Institution.find({ isActive: true })
      .populate({
        path: "owner",
        select: "-passwordHash -backupCodes",
      })
      .select("name type email phone country state city owner createdAt");

    /* ================= FORMAT CLEAN RESPONSE ================= */

    const result = institutions.map((inst) => ({
      institutionId: inst._id,
      institutionName: inst.name,
      institutionType: inst.type,
      institutionEmail: inst.email,
      institutionPhone: inst.phone,
      location: {
        country: inst.country,
        state: inst.state,
        city: inst.city,
      },
      createdAt: inst.createdAt,
      owner: inst.owner || null,
    }));

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });

  } catch (error) {
    console.error("Get all institution owners error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institution owners",
    });
  }
};

