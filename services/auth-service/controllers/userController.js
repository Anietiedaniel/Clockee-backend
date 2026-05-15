import { User, verifyPassword,hashPassword } from "@clockee/shared";
import{ Institution } from "@clockee/shared";
// export const getMyProfile = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId)
//       .select("-passwordHash -backupCodes");

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         /* ================= BASIC INFO ================= */
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,

//         /* ================= INSTITUTION + BRANCH ================= */
//         institutionId: user.institutionId || null,
//         branchId: user.branchId || null,

//         /* ================= INSTITUTION DETAILS ================= */
//         institutionName: user.institutionName,
//         institutionType: user.institutionType,

//         /* ================= USER DETAILS ================= */
//         departmentOrUnit: user.departmentOrUnit,
//         studentOrStaffId: user.studentOrStaffId,

//         /* ================= CONTACT ================= */
//         address: user.address,
//         phone: user.phone,

//         /* ================= CLOCKING ================= */
//         clockMode: user.clockMode,
//         remoteAccess: user.remoteAccess,

//         /* ================= STATUS ================= */
//         isActive: user.isActive,

//         /* ================= SECURITY SESSION (OPTIONAL) ================= */
//         activeSession: user.activeSession
//           ? {
//               sessionId:
//                 user.activeSession.sessionId || null,
//               deviceInfo:
//                 user.activeSession.deviceInfo || null,
//               lastLogin:
//                 user.activeSession.lastLogin || null,
//             }
//           : null,

//         /* ================= TIMESTAMPS ================= */
//         createdAt: user.createdAt,
//         updatedAt: user.updatedAt,
//       },
//     });
//   } catch (error) {
//     console.error(
//       "Error fetching profile:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

export const getMyProfile = async (req, res) => {
  try {
    /* ================= FETCH USER ================= */
    const user = await User.findById(req.user.userId)
      .select("-passwordHash -backupCodes");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* =====================================================
       OWNER CHECK FROM INSTITUTION SCHEMA
       institution.owner === user._id
       This ensures owner is NOT based on role
    ===================================================== */
    let isInstitutionOwner = false;

    if (user.institutionId) {
      const institution = await Institution.findById(
        user.institutionId
      ).select("owner");

      if (
        institution &&
        institution.owner &&
        String(institution.owner) === String(user._id)
      ) {
        isInstitutionOwner = true;
      }
    }

    /* ================= SAFE ROLE ARRAY ================= */
    const roles = Array.isArray(user.role)
      ? user.role
      : [user.role];

    /* ================= DASHBOARD TYPE ================= */
    const dashboardType = isInstitutionOwner
      ? "owner"
      : roles.includes("super_admin")
      ? "super_admin"
      : roles.includes("admin")
      ? "admin"
      : roles.includes("student")
      ? "student"
      : "staff";

    /* ================= RESPONSE ================= */
    return res.status(200).json({
      success: true,

      data: {
        /* ================= BASIC INFO ================= */
        id: user._id,
        name: user.name,
        email: user.email,

        /* 🔥 ROLE + OWNER */
        role: roles,
        isInstitutionOwner,
        dashboardType,

        /* ================= INSTITUTION + BRANCH ================= */
        institutionId:
          user.institutionId || null,

        branchId:
          user.branchId || null,

        /* ================= INSTITUTION DETAILS ================= */
        institutionName:
          user.institutionName || null,

        institutionType:
          user.institutionType || null,

        /* ================= USER DETAILS ================= */
        departmentOrUnit:
          user.departmentOrUnit || null,

        studentOrStaffId:
          user.studentOrStaffId || null,

        /* ================= CONTACT ================= */
        address:
          user.address || null,

        phone:
          user.phone || null,

        /* ================= CLOCKING ================= */
        clockMode:
          user.clockMode || null,

        remoteAccess:
          user.remoteAccess || false,

        /* ================= STATUS ================= */
        isActive:
          user.isActive,

        /* ================= SECURITY SESSION ================= */
        activeSession: user.activeSession
          ? {
              sessionId:
                user.activeSession.sessionId ||
                null,

              deviceInfo:
                user.activeSession.deviceInfo ||
                null,

              lastLogin:
                user.activeSession.lastLogin ||
                null,
            }
          : null,

        /* ================= TIMESTAMPS ================= */
        createdAt:
          user.createdAt,

        updatedAt:
          user.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching profile:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message || "Server error",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    /* ================= VALIDATION ================= */

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    /* ================= GET USER ================= */

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* ================= VERIFY CURRENT PASSWORD ================= */

    const isMatch = await verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    /* ================= PREVENT REUSING SAME PASSWORD ================= */

    const isSamePassword = await verifyPassword(
      newPassword,
      user.passwordHash
    );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    /* ================= SAVE NEW PASSWORD ================= */

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-passwordHash -backupCodes");

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: user,
    });

  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
