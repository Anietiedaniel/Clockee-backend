import { InstitutionSetting} from "@clockee/shared";
export const checkClockInPolicy = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user?.institutionId) {
      return res.status(400).json({
        message: "User not attached to an institution",
      });
    }

    const settings = await InstitutionSetting.findOne({
      institutionId: user.institutionId,
      isActive: true,
    });

    if (!settings) {
      return res.status(404).json({
        message: "Institution settings not found",
      });
    }

    /* ================= WORKING DAY CHECK ================= */

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: settings.timezone,
    });

    if (!settings.workingDays.includes(today)) {
      return res.status(403).json({
        message: "Clock-in not allowed today",
      });
    }

    /* ================= REMOTE POLICY LAYER ================= */

    // Institution does NOT allow remote at all
    if (!settings.allowRemoteClocking && user.isRemoteWorker) {
      return res.status(403).json({
        message: "Remote clock-in is not allowed by institution policy",
      });
    }



      if (!user.allowRemoteClocking) {
        return res.status(403).json({
          message: "You are not permitted to clock in remotely",
        });
      }

    // Institution allows remote AND user is marked remote
    if (settings.allowRemoteClocking && user.isRemoteWorker) {
      return next(); // Skip geofence
    }

    /* ================= GEOFENCE ENFORCEMENT ================= */

    if (settings.enforceGeofence) {
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          message: "Location required for clock-in",
        });
      }

      const isInside = await isWithinOfficeRadius(
        latitude,
        longitude,
        settings.gpsRadiusMeters
      );

      if (!isInside) {
        return res.status(403).json({
          message: "You are outside the allowed clock-in zone",
        });
      }
    }

    next();
  } catch (err) {
    console.error("Clock-in policy error:", err);
    res.status(500).json({
      message: "Clock-in validation failed",
    });
  }
};