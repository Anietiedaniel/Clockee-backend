import Institution  from "../models/institutionModel.js";

export const checkInstitutionActive = async (req, res, next) => {
  try {
    const { institutionId } = req.user;

    const institution = await Institution.findById(institutionId).select("isActive");

    if (!institution || !institution.isActive) {
      return res.status(403).json({
        message: "Institution is deactivated. Contact support.",
      });
    }

    next();
  } catch (err) {
    console.error("Institution check error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
