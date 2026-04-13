import {InstitutionSetting} from "@clockee/shared";

export const getInstitutionSettings = async (req, res) => {
  try {
    const {
      role: requesterRoles = [],
      institutionId: adminInstitutionId,
    } = req.user;

    const { id: targetInstitutionId } = req.params;

    /* ================= ROLE ================= */

    const roles = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    const isSuperAdmin = roles.includes("super_admin");

    /* ================= RESOLVE ================= */

    let institutionId;

    if (isSuperAdmin) {
      if (!targetInstitutionId) {
        return res.status(400).json({
          success: false,
          message: "Institution ID is required for super admin",
        });
      }

      institutionId = targetInstitutionId;
    } else {
      institutionId = adminInstitutionId;
    }

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID could not be resolved",
      });
    }

    /* ================= FETCH ================= */

    let settings = await InstitutionSetting.findOne({
      institutionId: new mongoose.Types.ObjectId(institutionId),
    });

    /* ================= DEFAULT ================= */

    if (!settings) {
      settings = {
        institutionId,

        workingDays: [],
        gracePeriodMinutes: 0,
        gpsRadiusMeters: 100,
        qrRefreshSeconds: 60,
        timezone: "UTC",

        enforceGeofence: false,
        allowOfflineClocking: false,
        allowRemoteClocking: false,

        hasDepartments: false,
        enforceStaffId: false,

        notifications: {},

        isActive: true,
      };
    }

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      data: settings,
    });

  } catch (err) {
    console.error("Fetch institution settings error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institution settings",
    });
  }
};

export const updateInstitutionSetting = async (req, res) => {
  try {
    const {
      role,
      institutionId: adminInstitutionId,
      userId,
    } = req.user;

    const { id: targetInstitutionId } = req.params;

    /* ================= ROLE NORMALIZATION ================= */

    const roles = Array.isArray(role) ? role : [role];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update institution settings",
      });
    }

    /* ================= VALIDATE ID ================= */

    if (!targetInstitutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetInstitutionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID",
      });
    }

    /* ================= ACCESS CONTROL ================= */

    if (isAdmin && !isSuperAdmin) {
      if (!adminInstitutionId) {
        return res.status(403).json({
          success: false,
          message: "Admin institution not found",
        });
      }

      if (String(adminInstitutionId) !== String(targetInstitutionId)) {
        return res.status(403).json({
          success: false,
          message: "Admins can only update their own institution",
        });
      }
    }

    /* ================= ALLOWED FIELDS ================= */

    const allowedUpdates = [
      "workingDays",
      "gracePeriodMinutes",
      "clockingWindow",
      "gpsRadiusMeters",
      "enforceGeofence",
      "qrRefreshSeconds",
      "allowOfflineClocking",
      "allowRemoteClocking",
      "timezone",
      "notifications",
      "hasDepartments",
      "enforceStaffId",
      "officeLocation",
    ];

    const updates = {};

    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    /* ================= FIELD VALIDATIONS ================= */

    if (
      updates.gpsRadiusMeters !== undefined &&
      (typeof updates.gpsRadiusMeters !== "number" ||
        updates.gpsRadiusMeters <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "gpsRadiusMeters must be a positive number",
      });
    }

    if (
      updates.gracePeriodMinutes !== undefined &&
      (typeof updates.gracePeriodMinutes !== "number" ||
        updates.gracePeriodMinutes < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "gracePeriodMinutes must be a non-negative number",
      });
    }

    if (
      updates.allowRemoteClocking !== undefined &&
      typeof updates.allowRemoteClocking !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "allowRemoteClocking must be a boolean",
      });
    }

    /* ================= AUDIT ================= */

    updates.lastUpdatedBy = userId;
    updates.lastUpdatedAt = new Date();
    

    /* ================= UPDATE ================= */



    const updated = await InstitutionSetting.findOneAndUpdate(
      {
        institutionId: new mongoose.Types.ObjectId(targetInstitutionId),
      },
      {
        $set: updates,
      },
      {
        new: true,
        upsert: true,
      }
    );

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      message: "Institution settings updated successfully",
      data: updated,

    });

  } catch (error) {
    console.error("Update settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update institution settings",
    });
  }
};


export const updateOfficeLocation = async (req, res) => {
  try {
    const {
      role: requesterRole,
      institutionId: adminInstitutionId,
      userId,
    } = req.user;

    const { institutionId: paramInstitutionId } = req.params;

    const { lat, lng, radius } = req.body;

    /* ================= RESOLVE INSTITUTION ================= */

    let institutionId;

    if (requesterRole === "super_admin") {
      if (!paramInstitutionId) {
        return res.status(400).json({
          success: false,
          message: "Institution ID is required for super admin",
        });
      }
      institutionId = paramInstitutionId;
    } else {
      institutionId = adminInstitutionId;

      if (
        paramInstitutionId &&
        paramInstitutionId !== String(adminInstitutionId)
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to update this institution",
        });
      }
    }

    /* ================= VALIDATION ================= */

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude values",
      });
    }

    if (
      radius !== undefined &&
      (typeof radius !== "number" || radius <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Radius must be a positive number",
      });
    }

    /* ================= BUILD UPDATE ================= */

    const updates = {
      officeLocation: {
        type: "Point",
        coordinates: [lng, lat], // GeoJSON format
      },
      lastUpdatedBy: userId,
      lastUpdatedAt: new Date(),
    };

    if (radius !== undefined) {
      updates.gpsRadiusMeters = radius;
    }

    /* ================= UPDATE ================= */

    const updated = await InstitutionSetting.findOneAndUpdate(
      { institutionId },
      updates,
      { new: true, upsert: true }
    );

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      message: "Office location updated successfully",
      data: {
        officeLocation: updated.officeLocation,
        gpsRadiusMeters: updated.gpsRadiusMeters,
      },
    });

  } catch (error) {
    console.error("Update office location error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update office location",
    });
  }
};



// createInstitution (super admin)
// updateInstitutionProfile
// updateInstitutionStatus
// archiveInstitution
// getInstitutionDetails
