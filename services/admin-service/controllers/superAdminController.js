
import { Institution, User } from "@clockee/shared";
import bcrypt from "bcrypt";

// only super admin can do this
// old controller
// export const createInstitution = async (req, res) => {
//   try {
//     const { role, userId: adminId  } = req.user;

//     // Only platform admin can create institutions
//     if (role !== "super_admin") {
//       return res.status(403).json({
//         message: "Only super admin can create institutions",
//       });
//     }

//     const {
//       name,
//       type,
//       address,
//       email,
//       phone,
//       industry,
//     } = req.body;

//     // Required validation
//     if (!name || !type) {
//       return res.status(400).json({
//         message: "Institution name and type are required",
//       });
//     }

    
//     const existing = await Institution.findOne({ email });
//     if (existing) {
//       return res.status(409).json({
//         message: "Institution with this name already exists",
//       });
//     }

//     const institution = await Institution.create({
//       name: name.trim(),
//       type,
//       address,
//       email,
//       phone,
//       createdBy: adminId,
//       meta: {
//         industry,
//       },
//     });

//     res.status(201).json({
//       success: true,
//       message: "Institution created successfully",
//       institution,
//     });
//   } catch (err) {
//     console.error("Create institution error:", err);
//     res.status(500).json({ message: "Failed to create institution",error: err.message });
//   }
// };



export const createInstitutionWithOwner = async (req, res) => {
  console.log("🔥 ROUTE HIT");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { role, userId: adminId } = req.user;

    // Only super_admin can create
    if (role !== "super_admin") {
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
      role: requesterRole,
      institutionId: SuperAdminInstitutionId,
      userId: createdBy,
    } = req.user;

    const { id: targetInstitutionId } = req.params;

    const {
      name,
      email,
      role,
      departmentOrUnit,
      studentOrStaffId,
      password,
      phone
    } = req.body;

    
    if (!targetInstitutionId) {
      return res.status(400).json({ message: "Institution ID is required" });
    }

    // Prevent privilege escalation
    if (requesterRole !== "super_admin" && role === "super_admin") {
      return res.status(403).json({
        message: "You cannot create a super admin user",
      });
    }

     if (role !== "admin") {
      return res.status(405).json({
        message: "only admin role allowed",
      });
    }

    // Prevent duplicate email
    if (await User.findOne({ email })) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Fetch institution (IMPORTANT)
    const institution = await Institution.findById(targetInstitutionId);
    if (!institution) {
      return res.status(404).json({ message: "Institution not found" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const creator = await User.findById(createdBy).select("name");

    const user = await User.create({
      name,
      email,
      role,
      institutionId:targetInstitutionId,
      institutionName: institution.name,
      institutionType: institution.type, // must be "school" or "company"
      departmentOrUnit,
      studentOrStaffId,
      passwordHash,
      isActive: true,
      createdBy:SuperAdminInstitutionId,
      creatorName : creator?.name,
      phone: phone,
      
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (err) {
    console.error("Admin create user error:", err);

    res.status(500).json({
      message: "Failed to create user",
      error: err.message, // KEEP THIS
    });
  }
};

// only super admin can do this
export const getAllInstitutions = async (req, res) => {
  try {
    const institutions = await Institution.find()
      .select("name type isActive createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      total: institutions.length,
      institutions,
    });
  } catch (err) {
    console.error("Get institutions error:", err);
    res.status(500).json({ message: "Server error" });
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


// revokeRole
// getInstitutionDetails – Fetch single institution info.
// updateBranch
// getBranchList
// getUserActivityLogs
// getBranchAttendanceStats – Branch-wise detailed attendance metrics for analytics.

// getUserShiftInfo – Return assigned shifts and schedules for a user.

// getUserList – Fetch all users in an institution, with filters (role, active status, etc.).

// getUserDetails – Fetch detailed info for a single user.
// // get a specific user
