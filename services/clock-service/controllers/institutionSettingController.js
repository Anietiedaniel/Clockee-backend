import {InstitutionSetting} from "@clockee/shared";
import {Institution} from "@clockee/shared";


export const createInstitutionSettings = async (req, res) => {
  try {
    const {
      role:requesterRole,
      institutionId: adminInstitutionId,
      userId: createdBy,
    } = req.user;

    const{id: targetInstitutionId,} = req.params;

    const {
      // policy fields
      workingDays,
      gracePeriodMinutes,
      gpsRadiusMeters,
      qrRefreshSeconds,
      timezone,
      allowOfflineClocking,
      notifications,
      hasDepartments,
      enforceStaffId,
    } = req.body;

    /* ================= ROLE & INSTITUTION RESOLUTION ================= */
    const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required.",
      });
    }

    /* ================= INSTITUTION VALIDATION ================= */
    const institution = await Institution.findById(institutionId);
    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found.",
      });
    }

    /* ================= PREVENT DUPLICATES ================= */
    const existing = await InstitutionSetting.findOne({ institutionId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Institution settings already exist.",
      });
    }

    /* ================= CREATE SETTINGS ================= */
    const settings = await InstitutionSetting.create({
      institutionId,

      // attendance policies
      workingDays,
      gracePeriodMinutes,
      gpsRadiusMeters,
      qrRefreshSeconds,
      timezone,
      allowOfflineClocking,

      // feature flags
      hasDepartments,
      enforceStaffId,

      // notifications
      notifications,

      // lifecycle
      isActive: true,

      createdBy
    });

    /* ================= RESPONSE ================= */
    return res.status(201).json({
      success: true,
      message: "Institution settings created successfully.",
      data: settings,
    });
  } catch (err) {
    console.error("Create institution settings error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create institution settings.",
    });
  }
};

export const getInstitutionSettings = async (req, res) => {
  try {
    const { role:requesterRole, institutionId:adminInstitutionId } = req.user;
    const { id:targetInstitutionId } = req.params;

      const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required.",
      });
    }

   

    /* ================= FETCH SETTINGS ================= */
    const settings = await InstitutionSetting.findOne({ institutionId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Institution settings not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (err) {
    console.error("Fetch institution settings error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch institution settings.",
    });
  }
};


export const updateInstitutionSettings = async (req, res) => {
  try {
    const { role:requesterRole, institutionId: adminInstitutionId } = req.user;
    const { id: targetInstitutionId } = req.params;

    /* ================= RESOLVE INSTITUTION ================= */
    const institutionId =
      requesterRole === "super_admin" ? targetInstitutionId : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required.",
      });
    }

    /* ================= ALLOWED FIELDS ================= */
    const allowedUpdates = [
      "workingDays",
      "gracePeriodMinutes",
      "gpsRadiusMeters",
      "qrRefreshSeconds",
      "timezone",
      "allowOfflineClocking",
      "notifications",
      "hasDepartments",
      "enforceStaffId",
      "isActive",
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    /* ================= UPDATE ================= */
    const settings = await InstitutionSetting.findOneAndUpdate(
      { institutionId },
      { $set: updates },
      { new: true } 
    );

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Institution settings not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Institution settings updated successfully.",
      data: settings,
    });
  } catch (error) {
    console.error("Update institution settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update institution settings.",
    });
  }
};

