import { InstitutionSetting} from "@clockee/shared";

// export const requireCompleteProfile = async (req, res, next) => {
//   try {
//     const user = req.user; // from protect middleware

//     // Always required
//     const missing = [];
//     if (!user.name) missing.push("name");
//     if (!user.email) missing.push("email");
//     if (!user.institutionId) missing.push("institution");

//     // Fetch institution rules
//     const institution = await Institution.findById(user.institutionId)
//       .select("hasDepartments enforceStaffId");

//     if (institution?.hasDepartments && !user.departmentOrUnit) {
//       missing.push("departmentOrUnit");
//     }

//     if (institution?.enforceStaffId && !user.studentOrStaffId) {
//       missing.push("studentOrStaffId");
//     }

//     if (missing.length > 0) {
//       return res.status(428).json({
//         message: "Profile incomplete",
//         missingFields: missing,
//       });
//     }

//     next();
//   } catch (err) {
//     return res.status(500).json({ message: "Profile validation failed" });
//   }
// };

export const requireCompleteProfile = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const missing = [];

    // Always required
    if (!user.name) missing.push("name");
    if (!user.email) missing.push("email");
    if (!user.institutionId) missing.push("institution");

    if (!user.institutionId) {
      return res.status(400).json({
        message: "User is not attached to an institution",
      });
    }

    // Fetch institution SETTINGS (not Institution)
    const settings = await InstitutionSetting.findOne({
      institutionId: user.institutionId,
      isActive: true,
    }).select("hasDepartments enforceStaffId");

    if (!settings) {
      return res.status(404).json({
        message: "Institution settings not configured",
      });
    }

    // Department required?
    if (settings.hasDepartments && !user.departmentOrUnit) {
      missing.push("departmentOrUnit");
    }

    // Staff ID required?
    if (settings.enforceStaffId && !user.studentOrStaffId) {
      missing.push("studentOrStaffId");
    }

    if (missing.length > 0) {
      return res.status(428).json({
        message: "Profile incomplete",
        missingFields: missing,
      });
    }

    next();
  } catch (err) {
    console.error("Profile validation failed:", err);
    return res.status(500).json({
      message: "Profile validation failed",
    });
  }
};