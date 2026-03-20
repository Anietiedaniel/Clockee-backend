import {Institution} from "@clockee/shared";

export const requireCompleteProfile = async (req, res, next) => {
  try {
    const user = req.user; // from protect middleware

    // Always required
    const missing = [];
    if (!user.name) missing.push("name");
    if (!user.email) missing.push("email");
    if (!user.institutionId) missing.push("institution");

    // Fetch institution rules
    const institution = await Institution.findById(user.institutionId)
      .select("hasDepartments enforceStaffId");

    if (institution?.hasDepartments && !user.departmentOrUnit) {
      missing.push("departmentOrUnit");
    }

    if (institution?.enforceStaffId && !user.studentOrStaffId) {
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
    return res.status(500).json({ message: "Profile validation failed" });
  }
};
