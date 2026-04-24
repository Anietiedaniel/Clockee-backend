import QRCode from "qrcode";
import { Institution,  Branch, User, InstitutionSetting} from "@clockee/shared";
import mongoose from "mongoose";
import crypto from "crypto";

// both admin and supper admin can do it
export const getInstitutionProfile = async (req, res) => {
  try {
    const {
      institutionId: adminInstitutionId,
      role: requesterRoles,
      userId,
    } = req.user;

    const { institutionId: targetInstitutionId } = req.query;

    /* ================= NORMALIZE ROLES ================= */

    const roles = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= RESOLVE INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "institutionId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(institutionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID",
      });
    }

    /* ================= FETCH ================= */

    const institution = await Institution.findById(institutionId)
      .select("-__v")
      .lean();

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

    /* ================= OPTIONAL: ADD OWNER FLAG ================= */

    const ownerId = institution.owner?.toString();

    const isOwner =
      ownerId && ownerId === userId.toString();

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      data: {
        ...institution,
        isOwner: !!isOwner, // useful for frontend
      },
    });

  } catch (err) {
    console.error("Error fetching institution profile:", err.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// both admin and supper admin can do it
export const createBranch = async (req, res) => {
  try {
    const {
      role,
      institutionId: adminInstitutionId,
      userId,
    } = req.user;

    const {
      institutionId: targetInstitutionId,
      name,
      address,
      latitude,
      longitude,
    } = req.body;

    /* ================= NORMALIZE ROLES ================= */

    const roles = Array.isArray(role) ? role : [role];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= DETERMINE INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    /* ================= VALIDATION ================= */

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Branch name is required",
      });
    }

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be numbers",
      });
    }

    /* ================= CHECK INSTITUTION EXISTS ================= */

    const institution = await Institution.findById(institutionId);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

     const settings = await InstitutionSetting.findOne({ institutionId });

    if (!settings?.useBranches) {
      return res.status(400).json({
        message: "Branch feature is not enabled for this institution",
      });
    }

    /* ================= GENERATE SECRET ================= */

    const qrSecret = crypto.randomBytes(16).toString("hex");

    const qrPayload = JSON.stringify({
      institutionId,
      secret: qrSecret,
    });

    const qrCodeUrl = await QRCode.toDataURL(qrPayload);

    /* ================= CREATE BRANCH ================= */

    const branch = await Branch.create({
      institutionId,
      name: name.trim(),
      address: address?.trim(),

      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },

      qrSecret,
    });

    /* ================= UPDATE META ================= */

    await Institution.findByIdAndUpdate(institutionId, {
      $inc: { "meta.totalBranches": 1 },
    });

    /* ================= CLEAN RESPONSE ================= */

    const branchObj = branch.toObject();
    delete branchObj.qrSecret;

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: {
        ...branchObj,
        qrCodeUrl,
        createdBy: userId,
      },
    });

  } catch (err) {
    console.error("Create branch error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create branch",
      error: err.message,
    });
  }
};


// both admin and supper admin can do it
export const getBranches = async (req, res) => {
  try {
    const {
      role,
      institutionId: adminInstitutionId,
    } = req.user;

    const { institutionId: targetInstitutionId } = req.query;

    /* ================= ROLE CHECK ================= */

    const roles = Array.isArray(role) ? role : [role];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= DETERMINE INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    /* ================= CHECK FEATURE ================= */

    const settings = await InstitutionSetting.findOne({ institutionId });

    if (!settings?.useBranches) {
      return res.status(400).json({
        success: false,
        message: "Branches not enabled for this institution",
      });
    }

    /* ================= FETCH ================= */

    const branches = await Branch.find({
      institutionId,
      isActive: true,
    })
      .select("name address location radiusMeters")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: branches.length,
      data: branches,
    });

  } catch (err) {
    console.error("Get branches error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch branches",
    });
  }
};



// branches/69e68410fb771e1692066413/deactivate
export const deactivateBranch = async (req, res) => {
  try {
    const { id: branchId } = req.params;
    const { role, institutionId: userInstitutionId } = req.user;

    /* ================= ROLE CHECK ================= */

    const roles = Array.isArray(role) ? role : [role];
    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= VALIDATE ID ================= */

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /* ================= FETCH BRANCH ================= */

    const branch = await Branch.findById(branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    /* ================= INSTITUTION SCOPE ================= */

    // admin can only act within their institution
    if (!isSuperAdmin && String(branch.institutionId) !== String(userInstitutionId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this institution",
      });
    }

    /* ================= ALREADY INACTIVE CHECK ================= */

    if (!branch.isActive) {
      return res.status(400).json({
        success: false,
        message: "Branch already inactive",
      });
    }

    /* ================= HANDLE USERS (AUTO-UNASSIGN) ================= */

    await User.updateMany({
      branchId: null,
       lastBranchId: branch._id,
      branchRemovedAt: new Date()
        }
    );

    /* ================= DEACTIVATE BRANCH ================= */

    branch.isActive = false;
    await branch.save();

    return res.status(200).json({
      success: true,
      message: "Branch deactivated successfully",
    });

  } catch (err) {
    console.error("Deactivate branch error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate branch",
    });
  }
};


export const updateBranch = async (req, res) => {
  try {
    const { id: branchId } = req.params;

    const {
      role,
      institutionId: adminInstitutionId,
      userId,
    } = req.user;

    const {
      institutionId: targetInstitutionId,
      name,
      address,
      latitude,
      longitude,
      radiusMeters,
      regenerateQR,
    } = req.body;

    /* ================= VALIDATE ID ================= */

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /* ================= ROLE ================= */

    const roles = Array.isArray(role) ? role : [role];
    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (isSuperAdmin && !targetInstitutionId) {
      return res.status(400).json({
        success: false,
        message: "targetInstitutionId is required for super admin",
      });
    }

    /* ================= INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    /* ================= FETCH ================= */

    const branch = await Branch.findOne({
      _id: branchId,
      institutionId,
    }).select("+qrSecret");

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    /* ================= VALIDATION ================= */

    if (
      !name &&
      !address &&
      latitude === undefined &&
      longitude === undefined &&
      radiusMeters === undefined &&
      regenerateQR !== true
    ) {
      return res.status(400).json({
        success: false,
        message: "No update data provided",
      });
    }

    /* ================= UPDATE ================= */

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      branch.name = trimmed;
    }

    if (address !== undefined) {
      branch.address = address.trim();
    }

    if (radiusMeters !== undefined) {
      if (typeof radiusMeters !== "number" || radiusMeters <= 0) {
        return res.status(400).json({
          success: false,
          message: "radiusMeters must be positive",
        });
      }
      branch.radiusMeters = radiusMeters;
    }

    if (
      latitude !== undefined &&
      longitude !== undefined
    ) {
      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude must be numbers",
        });
      }

      branch.location.coordinates = [longitude, latitude];
    }

    /* ================= QR REGEN ================= */

    let qrCodeUrl = null;

    if (regenerateQR === true) {
      const newSecret = crypto.randomBytes(16).toString("hex");

      branch.qrSecret = newSecret;

      const qrPayload = JSON.stringify({
        branchId: branch._id,
        institutionId,
        secret: newSecret,
      });

      qrCodeUrl = await QRCode.toDataURL(qrPayload);
    }

    /* ================= AUDIT ================= */

    branch.updatedBy = userId;
    branch.updatedAt = new Date();

    await branch.save();

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      data: {
        branchId: branch._id,
        name: branch.name,
        address: branch.address,
        radiusMeters: branch.radiusMeters,
        location: branch.location,
        ...(qrCodeUrl && { qrCodeUrl }),
      },
    });

  } catch (err) {
    console.error("Update branch error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update branch",
    });
  }
};


export const reactivateBranch = async (req, res) => {
  try {
    const { id: branchId } = req.params;
    const { role, institutionId: userInstitutionId } = req.user;

    /* ================= ROLE CHECK ================= */

    const roles = Array.isArray(role) ? role : [role];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= VALIDATE ID ================= */

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /* ================= FETCH BRANCH ================= */

    const branch = await Branch.findById(branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    /* ================= INSTITUTION ACCESS CONTROL ================= */

    if (
      !isSuperAdmin &&
      String(branch.institutionId) !== String(userInstitutionId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this institution",
      });
    }

    /* ================= ALREADY ACTIVE CHECK ================= */

    if (branch.isActive) {
      return res.status(400).json({
        success: false,
        message: "Branch is already active",
      });
    }

    /* ================= REACTIVATE ================= */

    branch.isActive = true;
    await branch.save();

    return res.status(200).json({
      success: true,
      message: "Branch reactivated successfully",
      data: {
        branchId: branch._id,
        name: branch.name,
        isActive: branch.isActive,
      },
    });

  } catch (err) {
    console.error("Reactivate branch error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to reactivate branch",
    });
  }
};




// export const assignUserToBranch = async (req, res) => {
//   try {
//     const { id: targetUserId } = req.params;

//     const {
//       role,
//       institutionId: adminInstitutionId,
//     } = req.user;

//     const { branchId, institutionId: targetInstitutionId } = req.body;

//     /* ================= VALIDATION ================= */

//     if (!mongoose.Types.ObjectId.isValid(targetUserId) ||
//         !mongoose.Types.ObjectId.isValid(branchId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid ID",
//       });
//     }

//     /* ================= ROLE CHECK ================= */

//     const roles = Array.isArray(role) ? role : [role];

//     const isSuperAdmin = roles.includes("super_admin");
//     const isAdmin = roles.includes("admin");

//     if (!isSuperAdmin && !isAdmin) {
//       return res.status(403).json({
//         success: false,
//         message: "Not authorized",
//       });
//     }

//     /* ================= DETERMINE INSTITUTION ================= */

//     const institutionId = isSuperAdmin
//       ? targetInstitutionId
//       : adminInstitutionId;

//     if (!institutionId) {
//       return res.status(400).json({
//         success: false,
//         message: "Institution ID is required",
//       });
//     }

//     /* ================= CHECK SETTINGS ================= */

//     const settings = await InstitutionSetting.findOne({ institutionId });

//     if (!settings?.useBranches) {
//       return res.status(400).json({
//         success: false,
//         message: "Branch feature not enabled",
//       });
//     }

//     /* ================= FETCH USER ================= */

//     const user = await User.findOne({
//       _id: targetUserId,
//       institutionId,
//     });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found in this institution",
//       });
//     }

//     /* ================= FETCH BRANCH ================= */

//     const branch = await Branch.findOne({
//       _id: branchId,
//       institutionId,
//       isActive: true,
//     });

//     if (!branch) {
//       return res.status(404).json({
//         success: false,
//         message: "Branch not found",
//       });
//     }

//     /* ================= UPDATE ================= */

//     user.branchId = branchId;
//     await user.save();

//     /* ================= RESPONSE ================= */

//     return res.status(200).json({
//       success: true,
//       message: "User assigned to branch successfully",
//       data: {
//         userId: user._id,
//         name: user.name,
//         branch: {
//           id: branch._id,
//           name: branch.name,
//         },
//       },
//     });

//   } catch (err) {
//     console.error("Assign branch error:", err.message);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to assign user to branch",
//     });
//   }
// };


// both admin and supper admin can do it
export const assignUserToBranch = async (req, res) => {
  try {
    const { id: targetUserId, institutionId:targetInstitutionId } = req.params;

    const {
      role,
      institutionId: adminInstitutionId,
    } = req.user;

    const { branchId} = req.body;

    /* ================= VALIDATION ================= */

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /* ================= ROLE CHECK ================= */

    const roles = Array.isArray(role) ? role : [role];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= DETERMINE INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    /* ================= SETTINGS CHECK ================= */

    const settings = await InstitutionSetting.findOne({ institutionId });

    // fallback: if no settings → assume branches NOT enabled
    if (!settings || settings.useBranches !== true) {
      return res.status(400).json({
        success: false,
        message: "Branch feature is not enabled for this institution",
      });
    }

    /* ================= FETCH USER ================= */

    const user = await User.findOne({
      _id: targetUserId,
      institutionId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in this institution",
      });
    }

    /* ================= UNASSIGN CASE ================= */
    if (!branchId) {
      user.branchId = null;

      await user.save();

      return res.status(200).json({
        success: true,
        message: "User removed from branch",
        data: {
          userId: user._id,
          name: user.name,
          branch: null,
        },
      });
    }

    /* ================= FETCH BRANCH ================= */

    const branch = await Branch.findOne({
      _id: branchId,
      institutionId,
      isActive: true,
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found or inactive",
      });
    }

    /* ================= UPDATE ================= */

    user.branchId = branchId;
    await user.save();

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      message: "User assigned to branch successfully",
      data: {
        userId: user._id,
        name: user.name,
        branch: {
          id: branch._id,
          name: branch.name,
        },
      },
    });

  } catch (err) {
    console.error("Assign branch error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to assign user to branch",
    });
  }
};


export const updateInstitution = async (req, res) => {
  try {
    const {
      role: requesterRoles,
      institutionId: adminInstitutionId,
      userId,
    } = req.user;

    const { institutionId: targetInstitutionId, ...body } = req.body;

    /* ================= NORMALIZE ROLES ================= */

    const roles = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= RESOLVE INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(institutionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID",
      });
    }

    /* ================= FETCH ================= */

    const institution = await Institution.findById(institutionId);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

    /* ================= OWNER CHECK ================= */

    const ownerId = institution.owner?.toString();

    const isOwner =
      ownerId && ownerId === userId.toString();

    // 🔥 Only owner or super admin can update institution
    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Only owner can update institution",
      });
    }

    /* ================= ALLOWED FIELDS ================= */

    const allowedFields = [
      "name",
      "address",
      "email",
      "phone",
      "website",
      "logo",
    ];

    /* ================= APPLY SAFE UPDATES ================= */

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        institution[field] = body[field];
      }
    });

    /* ================= SAVE ================= */

    await institution.save();

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      message: "Institution updated successfully",
      data: institution,
    });

  } catch (err) {
    console.error("Error updating institution:", err.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// both admin and supper admin can do it
export const getDepartmentsOrUnits = async (req, res) => {
  try {
    const { institutionId } = req.user;

    const aggregation = await User.aggregate([
      {
        $match: {
          institutionId,
          role: { $in: ["staff", "student"] },
          departmentOrUnit: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$departmentOrUnit",
          totalUsers: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          totalUsers: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    res.status(200).json({
      count: aggregation.length,
      departmentsOrUnits: aggregation,
    });
  } catch (err) {
    console.error("Error fetching departments/units:", err);
    res.status(500).json({ message: "Server error" });
  }
};


