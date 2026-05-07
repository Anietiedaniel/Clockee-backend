import moment from "moment-timezone";
import { Branch,AttendanceLog,Shift, User, InstitutionSetting  } from "@clockee/shared";
import {
  validateBranch,
  checkGeofence,
  checkDuplicateClockIn,
  detectShiftAndStatus,
  validateInstitutionPolicy,

} from "../utils/clock.helpers.js";


// export const clockAttendance = async (req, res) => {
//   try {
//     const {
//       actionType,
//       mode,
//       gps,
//       qrCode,
//       totp,
//       token,
//       backupCode,
//       overrideCode,
//     } = req.body;

//     const userId = req.user.userId || req.user.id;

//     const userRoles = Array.isArray(req.user.role)
//       ? req.user.role
//       : [req.user.role];

//     /* ================= BASIC VALIDATION ================= */

//     const allowedActions = ["clock-in", "clock-out"];
//     const allowedModes = [
//       "qr",
//       "totp",
//       "silent",
//       "backup_code",
//       "admin_override",
//     ];

//     if (!allowedActions.includes(actionType)) {
//       return res.status(400).json({ success: false, message: "Invalid action type" });
//     }

//     if (!allowedModes.includes(mode)) {
//       return res.status(400).json({ success: false, message: "Invalid clocking mode" });
//     }

//     if (!gps || typeof gps.lat !== "number" || typeof gps.lng !== "number") {
//       return res.status(400).json({ success: false, message: "Valid GPS required" });
//     }

//     const { lat, lng } = gps;

//     if (mode === "qr" && !qrCode)
//       return res.status(400).json({ success: false, message: "QR code required" });

//     if (mode === "totp" && !totp)
//       return res.status(400).json({ success: false, message: "TOTP required" });

//     if (mode === "silent" && !token)
//       return res.status(400).json({ success: false, message: "Token required" });

//     if (mode === "backup_code" && !backupCode)
//       return res.status(400).json({ success: false, message: "Backup code required" });

//     /* ================= ADMIN OVERRIDE ================= */

//     const isAdmin =
//       userRoles.includes("admin") || userRoles.includes("super_admin");

//     if (mode === "admin_override") {
//       if (!isAdmin) {
//         return res.status(403).json({ success: false, message: "Not authorized" });
//       }

//       if (!overrideCode || overrideCode !== process.env.ADMIN_OVERRIDE_SECRET) {
//         return res.status(403).json({ success: false, message: "Invalid override code" });
//       }
//     }

//     /* ================= FETCH USER ================= */

//     const user = await User.findById(userId);

//     if (!user || !user.isActive) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found or inactive",
//       });
//     }

//     /* ================= SETTINGS ================= */

//     const institutionSetting = await InstitutionSetting.findOne({
//       institutionId: user.institutionId,
//       isActive: true,
//     });

//     const settings = {
//       timezone: "Africa/Lagos",
//       workStartTime: "08:00",
//       workEndTime: "17:00",
//       expectedWorkHours: 8,
//       gracePeriodMinutes: 20,
//       clockingWindow: { earlyMinutes: 20, lateMinutes: 90 },
//       enforceGeofence: false,
//       gpsRadiusMeters: 100,
//       officeLocation: null,
//       useBranches: false,
//       ...(institutionSetting ? institutionSetting.toObject() : {}),
//     };

//     /* ================= FETCH BRANCH ================= */

//     let branch = null;

//     if (settings.useBranches) {
//       if (!user.branchId) {
//         return res.status(403).json({
//           success: false,
//           message: "You are not assigned to any branch",
//         });
//       }

//       branch = await Branch.findById(user.branchId).select("+qrSecret");

//       if (!branch || !branch.isActive) {
//         return res.status(403).json({
//           success: false,
//           message: "Assigned branch is inactive",
//         });
//       }
//     }

//     /* ================= GEO CHECK ================= */

//     let distanceFromOffice = null;

//     const locationSource = settings.useBranches
//       ? branch?.location
//       : settings.officeLocation;

//     if (locationSource?.coordinates?.length === 2) {
//       const [officeLng, officeLat] = locationSource.coordinates;

//       const toRad = (v) => (v * Math.PI) / 180;
//       const R = 6378137;

//       const dLat = toRad(lat - officeLat);
//       const dLng = toRad(lng - officeLng);

//       const a =
//         Math.sin(dLat / 2) ** 2 +
//         Math.cos(toRad(officeLat)) *
//           Math.cos(toRad(lat)) *
//           Math.sin(dLng / 2) ** 2;

//       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//       distanceFromOffice = R * c;

//       const allowedRadius = settings.useBranches
//         ? branch.radiusMeters
//         : settings.gpsRadiusMeters;

//       if (
//         settings.enforceGeofence &&
//         mode !== "admin_override" &&
//         distanceFromOffice > allowedRadius
//       ) {
//         return res.status(403).json({
//           success: false,
//           message: settings.useBranches
//             ? "Outside branch location"
//             : "Outside allowed location",
//         });
//       }
//     }

//     /* ================= QR VALIDATION ================= */

//     if (mode === "qr" && settings.useBranches) {
//       try {
//         const parsed = JSON.parse(qrCode);

//         if (
//           parsed.institutionId !== String(user.institutionId) ||
//           parsed.secret !== branch.qrSecret
//         ) {
//           return res.status(403).json({
//             success: false,
//             message: "Invalid branch QR code",
//           });
//         }
//       } catch {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid QR format",
//         });
//       }
//     }

//     const now = moment().tz(settings.timezone);
//     const date = now.clone().startOf("day").toDate();

//     let attendance;

//     /* ================= CLOCK-IN ================= */

//     if (actionType === "clock-in") {
//       const existing = await AttendanceLog.findOne({
//         userId,
//         institutionId: user.institutionId,
//         actionType: "clock-in",
//         date,
//       });

//       if (existing) {
//         return res.status(400).json({
//           success: false,
//           message: "You already clocked in today",
//         });
//       }

//       const [startHour, startMin] = settings.workStartTime.split(":").map(Number);

//       const expectedStart = moment()
//         .tz(settings.timezone)
//         .set({ hour: startHour, minute: startMin, second: 0 });

//       const diffMinutes = now.diff(expectedStart, "minutes");

//       let clockInStatus = "on-time";

//       if (diffMinutes < -settings.clockingWindow.earlyMinutes) clockInStatus = "too-early";
//       else if (diffMinutes < 0) clockInStatus = "early";
//       else if (diffMinutes <= settings.gracePeriodMinutes) clockInStatus = "on-time";
//       else if (diffMinutes <= settings.clockingWindow.lateMinutes) clockInStatus = "late";
//       else clockInStatus = "very-late";

//       attendance = await AttendanceLog.create({
//         userId,
//         institutionId: user.institutionId,
//         branchId: settings.useBranches ? branch._id : null,
//         actionType,
//         mode,
//         gps: { type: "Point", coordinates: [lng, lat] },
//         timestamp: now.toDate(),
//         date,
//         status: "present",
//         clockInStatus,
//         minutesLate: diffMinutes > 0 ? diffMinutes : 0,
//         distanceFromOffice: distanceFromOffice
//           ? Math.round(distanceFromOffice)
//           : null,
//       });

//       return res.status(201).json({
//         success: true,
//         message: "Clock-in successful",
//         meta: { clockInStatus },
//         data: attendance,
//       });
//     }

//     /* ================= CLOCK-OUT ================= */

//     if (actionType === "clock-out") {
//       const lastClockIn = await AttendanceLog.findOne({
//         userId,
//         institutionId: user.institutionId,
//         actionType: "clock-in",
//         date,
//       }).sort({ timestamp: -1 });

//       if (!lastClockIn) {
//         return res.status(400).json({
//           success: false,
//           message: "No clock-in found for today",
//         });
//       }

//       const existingOut = await AttendanceLog.findOne({
//         userId,
//         institutionId: user.institutionId,
//         actionType: "clock-out",
//         date,
//       });

//       if (existingOut) {
//         return res.status(400).json({
//           success: false,
//           message: "You already clocked out today",
//         });
//       }

//       const workDurationMinutes = now.diff(
//         moment(lastClockIn.timestamp),
//         "minutes"
//       );

//       let clockOutStatus = "completed";

//       if (settings.workEndTime) {
//         const [h, m] = settings.workEndTime.split(":").map(Number);
//         const expectedEnd = moment().tz(settings.timezone).set({ hour: h, minute: m });

//         if (now.isBefore(expectedEnd)) clockOutStatus = "early_exit";
//         else if (now.isAfter(expectedEnd)) clockOutStatus = "overtime";
//       }

//       attendance = await AttendanceLog.create({
//         userId,
//         institutionId: user.institutionId,
//         branchId: settings.useBranches ? branch._id : null,
//         actionType,
//         mode,
//         gps: { type: "Point", coordinates: [lng, lat] },
//         timestamp: now.toDate(),
//         date,
//         clockOutStatus,
//         workDurationMinutes,
//         distanceFromOffice: distanceFromOffice
//           ? Math.round(distanceFromOffice)
//           : null,
//       });

//       return res.status(201).json({
//         success: true,
//         message: "Clock-out successful",
//         meta: { workDurationMinutes, clockOutStatus },
//         data: attendance,
//       });
//     }
//   } catch (error) {
//     console.error("Clock attendance error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

export const clockAttendance = async (req, res) => {
  try {
    const {
      actionType,
      mode,
      gps,
      qrCode,
      totp,
      token,
      backupCode,
      overrideCode,
    } = req.body;

    const userId = req.user.userId || req.user.id;

    const userRoles = Array.isArray(req.user.role)
      ? req.user.role
      : [req.user.role];

    /* ================= BASIC VALIDATION ================= */

    const allowedActions = ["clock-in", "clock-out"];
    const allowedModes = [
      "qr",
      "totp",
      "silent",
      "backup_code",
      "admin_override",
    ];

    if (!allowedActions.includes(actionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action type",
      });
    }

    if (!allowedModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clocking mode",
      });
    }

    if (!gps || typeof gps.lat !== "number" || typeof gps.lng !== "number") {
      return res.status(400).json({
        success: false,
        message: "Valid GPS required",
      });
    }

    const { lat, lng } = gps;

    if (mode === "qr" && !qrCode) {
      return res.status(400).json({
        success: false,
        message: "QR code required",
      });
    }

    if (mode === "totp" && !totp) {
      return res.status(400).json({
        success: false,
        message: "TOTP required",
      });
    }

    if (mode === "silent" && !token) {
      return res.status(400).json({
        success: false,
        message: "Token required",
      });
    }

    if (mode === "backup_code" && !backupCode) {
      return res.status(400).json({
        success: false,
        message: "Backup code required",
      });
    }

    /* ================= ADMIN OVERRIDE ================= */

    const isAdmin =
      userRoles.includes("admin") || userRoles.includes("super_admin");

    if (mode === "admin_override") {
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Not authorized",
        });
      }

      if (
        !overrideCode ||
        overrideCode !== process.env.ADMIN_OVERRIDE_SECRET
      ) {
        return res.status(403).json({
          success: false,
          message: "Invalid override code",
        });
      }
    }

    /* ================= FETCH USER ================= */

    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    /* ================= SETTINGS ================= */

    const institutionSetting = await InstitutionSetting.findOne({
      institutionId: user.institutionId,
      isActive: true,
    });

    const settings = {
      timezone: "Africa/Lagos",
      workStartTime: "08:00",
      workEndTime: "17:00",
      expectedWorkHours: 8,
      gracePeriodMinutes: 20,
      clockingWindow: {
        earlyMinutes: 20,
        lateMinutes: 90,
      },
      enforceGeofence: false,
      gpsRadiusMeters: 100,
      officeLocation: null,
      useBranches: false,
      allowRemoteClocking: false,
      ...(institutionSetting ? institutionSetting.toObject() : {}),
    };

    /* ================= FETCH BRANCH ================= */

    let branch = null;

    if (settings.useBranches) {
      if (!user.branchId) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to any branch",
        });
      }

      branch = await Branch.findById(user.branchId).select("+qrSecret");

      if (!branch || !branch.isActive) {
        return res.status(403).json({
          success: false,
          message: "Assigned branch is inactive",
        });
      }
    }

    /* ================= REMOTE ACCESS CONTROL ================= */

    const isRemoteMode =
      user.clockMode === "remote" ||
      user.clockMode === "hybrid" ||
      user.clockMode === "field";

    const institutionAllowsRemote = settings.allowRemoteClocking === true;
    const userAllowsRemote = user.remoteAccess?.allowed === true;

    const remoteAuthorized =
      mode === "admin_override" ||
      (institutionAllowsRemote && userAllowsRemote && isRemoteMode);

    /* ================= GEO CHECK ================= */

    let distanceFromOffice = null;

    const locationSource = settings.useBranches
      ? branch?.location
      : settings.officeLocation;

    /*
      IMPORTANT:
      Coordinates in DB MUST be:
      [lng, lat]
    */

    if (
      locationSource &&
      Array.isArray(locationSource.coordinates) &&
      locationSource.coordinates.length === 2
    ) {
      const [officeLng, officeLat] = locationSource.coordinates;

      /* ================= VALIDATE OFFICE COORDINATES ================= */

      if (
        typeof officeLat !== "number" ||
        typeof officeLng !== "number" ||
        officeLat < -90 ||
        officeLat > 90 ||
        officeLng < -180 ||
        officeLng > 180
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Invalid office/branch coordinates configuration. Expected [lng, lat].",
        });
      }

      /* ================= VALIDATE USER GPS ================= */

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
          message: "Invalid user GPS coordinates",
        });
      }

      console.log("========= GEO DEBUG =========");
      console.log("User GPS:", { lat, lng });
      console.log("Office GPS:", { officeLat, officeLng });
      console.log("Use Branches:", settings.useBranches);

      /* ================= SAME LOCATION TOLERANCE ================= */
      const sameLat = Math.abs(lat - officeLat) < 0.00001;
      const sameLng = Math.abs(lng - officeLng) < 0.00001;

      if (sameLat && sameLng) {
        distanceFromOffice = 0;
      } else {
        /* ================= HAVERSINE ================= */

        const toRad = (value) => (value * Math.PI) / 180;

        const R = 6371000; // meters

        const dLat = toRad(lat - officeLat);
        const dLng = toRad(lng - officeLng);

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(officeLat)) *
            Math.cos(toRad(lat)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        distanceFromOffice = R * c;
      }

      const allowedRadius = settings.useBranches
        ? branch?.radiusMeters || 100
        : settings.gpsRadiusMeters || 100;

      console.log(
        "Distance From Office:",
        Math.round(distanceFromOffice),
        "meters"
      );

      console.log("Allowed Radius:", allowedRadius, "meters");

      const outsideAllowedZone = distanceFromOffice > allowedRadius;

      if (
        settings.enforceGeofence &&
        mode !== "admin_override" &&
        outsideAllowedZone
      ) {
        if (!remoteAuthorized) {
          return res.status(403).json({
            success: false,
            message: `Outside allowed location. You are ${Math.round(
              distanceFromOffice
            )}m away. Allowed radius is ${allowedRadius}m.`,
            meta: {
              distanceFromOffice: Math.round(distanceFromOffice),
              allowedRadius,
              remoteAllowed: false,
            },
          });
        }

        console.log("Remote clocking allowed for this user.");
      }

      console.log("========= GEO PASS =========");
    } else {
      console.log(
        "No office/branch coordinates configured. Skipping geofence validation."
      );
    }

    /* ================= QR VALIDATION ================= */

    if (mode === "qr" && settings.useBranches) {
      try {
        const parsed = JSON.parse(qrCode);

        if (
          parsed.institutionId !== String(user.institutionId) ||
          parsed.secret !== branch.qrSecret
        ) {
          return res.status(403).json({
            success: false,
            message: "Invalid branch QR code",
          });
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid QR format",
        });
      }
    }

    const now = moment().tz(settings.timezone);
    const date = now.clone().startOf("day").toDate();

    let attendance;

    /* ================= CLOCK-IN ================= */

    if (actionType === "clock-in") {
      const existing = await AttendanceLog.findOne({
        userId,
        institutionId: user.institutionId,
        actionType: "clock-in",
        date,
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "You already clocked in today",
        });
      }

      const [startHour, startMin] = settings.workStartTime
        .split(":")
        .map(Number);

      const expectedStart = moment()
        .tz(settings.timezone)
        .set({
          hour: startHour,
          minute: startMin,
          second: 0,
        });

      const diffMinutes = now.diff(expectedStart, "minutes");

      let clockInStatus = "on-time";

      if (diffMinutes < -settings.clockingWindow.earlyMinutes) {
        clockInStatus = "too-early";
      } else if (diffMinutes < 0) {
        clockInStatus = "early";
      } else if (diffMinutes <= settings.gracePeriodMinutes) {
        clockInStatus = "on-time";
      } else if (diffMinutes <= settings.clockingWindow.lateMinutes) {
        clockInStatus = "late";
      } else {
        clockInStatus = "very-late";
      }

      attendance = await AttendanceLog.create({
        userId,
        institutionId: user.institutionId,
        branchId: settings.useBranches ? branch?._id : null,
        shiftId: null,
        actionType,
        mode,
        gps: {
          type: "Point",
          coordinates: [lng, lat],
        },
        timestamp: now.toDate(),
        date,
        status: "present",
        clockInStatus,
        minutesLate: diffMinutes > 0 ? diffMinutes : 0,
        distanceFromOffice:
          distanceFromOffice !== null
            ? Math.round(distanceFromOffice)
            : null,
        validationResult:
          distanceFromOffice !== null &&
          settings.enforceGeofence &&
          distanceFromOffice > settings.gpsRadiusMeters &&
          !remoteAuthorized
            ? "out_of_zone"
            : "accepted",
      });

      return res.status(201).json({
        success: true,
        message: remoteAuthorized
          ? "Remote clock-in successful"
          : "Clock-in successful",
        meta: {
          clockInStatus,
          remote: remoteAuthorized,
          distanceFromOffice:
            distanceFromOffice !== null
              ? Math.round(distanceFromOffice)
              : null,
        },
        data: attendance,
      });
    }

    /* ================= CLOCK-OUT ================= */

    if (actionType === "clock-out") {
      const lastClockIn = await AttendanceLog.findOne({
        userId,
        institutionId: user.institutionId,
        actionType: "clock-in",
        date,
      }).sort({ timestamp: -1 });

      if (!lastClockIn) {
        return res.status(400).json({
          success: false,
          message: "No clock-in found for today",
        });
      }

      const existingOut = await AttendanceLog.findOne({
        userId,
        institutionId: user.institutionId,
        actionType: "clock-out",
        date,
      });

      if (existingOut) {
        return res.status(400).json({
          success: false,
          message: "You already clocked out today",
        });
      }

      const workDurationMinutes = now.diff(
        moment(lastClockIn.timestamp),
        "minutes"
      );

      let clockOutStatus = "completed";

      if (settings.workEndTime) {
        const [h, m] = settings.workEndTime.split(":").map(Number);

        const expectedEnd = moment()
          .tz(settings.timezone)
          .set({
            hour: h,
            minute: m,
          });

        if (now.isBefore(expectedEnd)) {
          clockOutStatus = "early_exit";
        } else if (now.isAfter(expectedEnd)) {
          clockOutStatus = "overtime";
        }
      }

      attendance = await AttendanceLog.create({
        userId,
        institutionId: user.institutionId,
        branchId: settings.useBranches ? branch?._id : null,
        shiftId: null,
        actionType,
        mode,
        gps: {
          type: "Point",
          coordinates: [lng, lat],
        },
        timestamp: now.toDate(),
        date,
        clockOutStatus,
        workDurationMinutes,
        distanceFromOffice:
          distanceFromOffice !== null
            ? Math.round(distanceFromOffice)
            : null,
        validationResult:
          distanceFromOffice !== null &&
          settings.enforceGeofence &&
          distanceFromOffice > settings.gpsRadiusMeters &&
          !remoteAuthorized
            ? "out_of_zone"
            : "accepted",
      });

      return res.status(201).json({
        success: true,
        message: remoteAuthorized
          ? "Remote clock-out successful"
          : "Clock-out successful",
        meta: {
          workDurationMinutes,
          clockOutStatus,
          remote: remoteAuthorized,
          distanceFromOffice:
            distanceFromOffice !== null
              ? Math.round(distanceFromOffice)
              : null,
        },
        data: attendance,
      });
    }
  } catch (error) {
    console.error("Clock attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



export const adminOverrideClock = async (req, res) => {
  try {
    //  Role enforcement
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can perform manual attendance override.",
      });
    }

    const adminId = req.user._id;
    const { userId, branchId, actionType, reason } = req.body;

    // Basic validations
    if (!userId || !branchId || !actionType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (userId, branchId, actionType).",
      });
    }

    if (!["clock-in", "clock-out"].includes(actionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action type. Must be 'clock-in' or 'clock-out'.",
      });
    }

    // Fetch user to get institutionId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Verify admin belongs to same institution
    if (String(req.user.institutionId) !== String(user.institutionId)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to override for this institution.",
      });
    }

    // Create attendance log
    const log = new AttendanceLog({
      userId: user._id,
      institutionId: user.institutionId,
      branchId,
      shiftId: null,
      actionType,
      gps: { lat: 0, lng: 0 }, // not applicable
      mode: "admin_override",
      timestamp: new Date(),
      validationResult: "accepted",
      status: "on-time",
      syncStatus: "online",
      adminOverrideBy: adminId,
      reason,
    });

    await log.save();

    return res.status(201).json({
      success: true,
      message: `Manual ${actionType} recorded successfully.`,
      data: log,
    });
  } catch (error) {
    console.error("Admin override error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during admin override.",
    });
  }
};

// export const getAttendanceHistory = async (req, res) => {
//   try {
//     const { role, institutionId, userId } = req.user;

//     const {
//       user,
//       dateFrom,
//       dateTo,
//       actionType,
//       mode,
//       page = 1,
//       limit = 10,
//     } = req.query;

//     /* ===============================
//        NORMALIZE ROLE
//     =============================== */

//     const roles = Array.isArray(role) ? role : [role];
//     const isAdmin = roles.includes("admin");
//     const isSuperAdmin = roles.includes("super_admin");

//     /* ===============================
//        USER SCOPE CONTROL
//     =============================== */

//     let targetUserId = userId;

//     // Admin/SuperAdmin can view other users
//     if ((isAdmin || isSuperAdmin) && user) {
//       const foundUser = await User.findOne({
//         _id: user,
//         institutionId,
//       });

//       if (!foundUser) {
//         return res.status(404).json({
//           success: false,
//           message: "User not found in this institution",
//         });
//       }

//       targetUserId = user;
//     }

//     /* ===============================
//        BUILD QUERY
//     =============================== */

//     const query = {
//       institutionId,
//       userId: targetUserId,
//     };

//     if (dateFrom || dateTo) {
//       query.date = {};
//       if (dateFrom) query.date.$gte = new Date(dateFrom);
//       if (dateTo) query.date.$lte = new Date(dateTo);
//     }

//     if (actionType) query.actionType = actionType;
//     if (mode) query.mode = mode;

//     /* ===============================
//        FETCH LOGS (Sorted)
//     =============================== */

//     const logs = await AttendanceLog.find(query)
//       .sort({ date: -1, timestamp: -1 })
//       .lean();

//     /* ===============================
//        GROUP BY DAY
//     =============================== */

//     const grouped = {};

//     for (const log of logs) {
//       const dayKey = new Date(log.date).toISOString().split("T")[0];

//       if (!grouped[dayKey]) {
//         grouped[dayKey] = {
//           date: dayKey,
//           clockIn: null,
//           clockOut: null,
//         };
//       }

//       if (log.actionType === "clock-in") {
//         grouped[dayKey].clockIn = {
//           time: log.timestamp,
//           status: log.clockInStatus,
//           minutesLate: log.minutesLate,
//           mode: log.mode,
//         };
//       }

//       if (log.actionType === "clock-out") {
//         grouped[dayKey].clockOut = {
//           time: log.timestamp,
//           status: log.clockOutStatus,
//           workDurationMinutes: log.workDurationMinutes,
//           productivityStatus: log.productivityStatus,
//           mode: log.mode,
//         };
//       }
//     }

//     /* ===============================
//        PAGINATION AFTER GROUPING
//     =============================== */

//     const groupedArray = Object.values(grouped);

//     const total = groupedArray.length;
//     const parsedLimit = parseInt(limit);
//     const parsedPage = parseInt(page);

//     const skip = (parsedPage - 1) * parsedLimit;

//     const paginated = groupedArray.slice(skip, skip + parsedLimit);

//     /* ===============================
//        RESPONSE
//     =============================== */

//     return res.status(200).json({
//       success: true,
//       message: "Attendance history fetched successfully",
//       total,
//       currentPage: parsedPage,
//       totalPages: Math.ceil(total / parsedLimit),
//       data: paginated,
//     });

//   } catch (err) {
//     console.error("Error fetching attendance history:", err);

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

export const getAttendanceHistory = async (req, res) => {
  try {
    const { role, institutionId: requesterInstitutionId, userId } = req.user;

    const {
      user,
      institutionId: targetInstitutionId,
      dateFrom,
      dateTo,
      actionType,
      mode,
      page = 1,
      limit = 10,
    } = req.query;

    /* ===============================
       NORMALIZE ROLE
    =============================== */

    const roles = Array.isArray(role) ? role : [role];

    const isAdmin = roles.includes("admin");
    const isSuperAdmin = roles.includes("super_admin");

    /* ===============================
       VALIDATE PAGINATION
    =============================== */

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 10)
    );

    /* ===============================
       DETERMINE INSTITUTION SCOPE
    =============================== */

    let scopedInstitutionId = requesterInstitutionId;

    if (isSuperAdmin && targetInstitutionId) {
      if (!mongoose.Types.ObjectId.isValid(targetInstitutionId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid institution ID",
        });
      }

      scopedInstitutionId = targetInstitutionId;
    }

    if (!scopedInstitutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    /* ===============================
       USER SCOPE CONTROL
    =============================== */

    let targetUserId = userId;

    // Admin/SuperAdmin can inspect other users
    if ((isAdmin || isSuperAdmin) && user) {
      if (!mongoose.Types.ObjectId.isValid(user)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const userQuery = {
        _id: user,
        isActive: true,
      };

      // Admin limited to own institution
      if (!isSuperAdmin) {
        userQuery.institutionId = requesterInstitutionId;
      }

      // Super admin scoped by selected institution if provided
      if (isSuperAdmin && scopedInstitutionId) {
        userQuery.institutionId = scopedInstitutionId;
      }

      const foundUser = await User.findOne(userQuery).select(
        "_id institutionId"
      );

      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found in permitted scope",
        });
      }

      targetUserId = foundUser._id;
      scopedInstitutionId = foundUser.institutionId;
    }

    /* ===============================
       FETCH SETTINGS (TIMEZONE SAFE)
    =============================== */

    const setting = await InstitutionSetting.findOne({
      institutionId: scopedInstitutionId,
      isActive: true,
    }).select("timezone");

    const timezone = setting?.timezone || "Africa/Lagos";

    /* ===============================
       BUILD QUERY
    =============================== */

    const query = {
      institutionId: scopedInstitutionId,
      userId: targetUserId,
      isActive: true,
    };

    if (dateFrom || dateTo) {
      query.date = {};

      if (dateFrom) {
        const start = new Date(dateFrom);

        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid dateFrom",
          });
        }

        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }

      if (dateTo) {
        const end = new Date(dateTo);

        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid dateTo",
          });
        }

        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (actionType) {
      const allowedActions = ["clock-in", "clock-out"];

      if (!allowedActions.includes(actionType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid actionType",
        });
      }

      query.actionType = actionType;
    }

    if (mode) {
      const allowedModes = [
        "qr",
        "totp",
        "silent",
        "backup_code",
        "admin_override",
      ];

      if (!allowedModes.includes(mode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid mode",
        });
      }

      query.mode = mode;
    }

    /* ===============================
       FETCH LOGS
    =============================== */

    const logs = await AttendanceLog.find(query)
      .sort({ date: -1, timestamp: -1 })
      .select(
        "date timestamp actionType clockInStatus clockOutStatus minutesLate workDurationMinutes mode"
      )
      .lean();

    /* ===============================
       GROUP BY DAY (TIMEZONE SAFE)
    =============================== */

    const grouped = {};

    for (const log of logs) {
      const dayKey = moment(log.date)
        .tz(timezone)
        .format("YYYY-MM-DD");

      if (!grouped[dayKey]) {
        grouped[dayKey] = {
          date: dayKey,
          clockIn: null,
          clockOut: null,
        };
      }

      if (log.actionType === "clock-in" && !grouped[dayKey].clockIn) {
        grouped[dayKey].clockIn = {
          time: log.timestamp,
          status: log.clockInStatus || null,
          minutesLate: log.minutesLate || 0,
          mode: log.mode,
        };
      }

      if (log.actionType === "clock-out" && !grouped[dayKey].clockOut) {
        grouped[dayKey].clockOut = {
          time: log.timestamp,
          status: log.clockOutStatus || null,
          workDurationMinutes: log.workDurationMinutes || 0,
          mode: log.mode,
        };
      }
    }

    /* ===============================
       PAGINATION AFTER GROUPING
       (MVP SAFE — upgrade to aggregation later)
    =============================== */

    const groupedArray = Object.values(grouped).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const total = groupedArray.length;

    const skip = (parsedPage - 1) * parsedLimit;

    const paginated = groupedArray.slice(skip, skip + parsedLimit);

    /* ===============================
       RESPONSE
    =============================== */

    return res.status(200).json({
      success: true,
      message: "Attendance history fetched successfully",
      total,
      currentPage: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
      filters: {
        institutionId: scopedInstitutionId,
        userId: targetUserId,
        timezone,
      },
      data: paginated,
    });
  } catch (err) {
    console.error("Error fetching attendance history:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const syncOfflineLogs = async (req, res) => {
  try {
    const { offlineLogs } = req.body;
    const { _id: userId, institutionId, sessionId } = req.user;

    if (!offlineLogs || !Array.isArray(offlineLogs) || offlineLogs.length === 0) {
      return res.status(400).json({ message: "No offline logs provided." });
    }

    // ===============================
    // 🔐 SESSION VALIDATION (IMPORTANT)
    // ===============================
    const user = await User.findById(userId);

    if (!user || user.activeSession?.sessionId !== sessionId) {
      return res.status(401).json({
        success: false,
        message: "Session expired or logged in on another device",
      });
    }

    const results = [];

    for (const log of offlineLogs) {
      const { branchId, gps, actionType, mode, timestamp, qrCode } = log;

      try {
        const now = moment(timestamp);
        const date = now.clone().startOf("day").toDate();

        /* ===============================
           SETTINGS
        =============================== */
        const settingsDoc = await InstitutionSetting.findOne({
          institutionId,
          isActive: true,
        });

        const settings = {
          timezone: "Africa/Lagos",
          workStartTime: "08:00",
          workEndTime: "17:00",
          expectedWorkHours: 8,
          ...(settingsDoc ? settingsDoc.toObject() : {}),
        };

        /* ===============================
           DUPLICATE CHECK
        =============================== */
        const existing = await AttendanceLog.findOne({
          userId,
          actionType,
          date,
        });

        if (existing) {
          results.push({
            ...log,
            syncStatus: "rejected_on_sync",
            reason: "Already exists for this day",
          });
          continue;
        }

        /* ===============================
           CLOCK-IN
        =============================== */
        if (actionType === "clock-in") {
          const [h, m] = settings.workStartTime.split(":").map(Number);

          const expectedStart = moment(timestamp).set({
            hour: h,
            minute: m,
            second: 0,
          });

          const diffMinutes = now.diff(expectedStart, "minutes");

          let clockInStatus = "on-time";

          if (diffMinutes < -20) clockInStatus = "too-early";
          else if (diffMinutes < 0) clockInStatus = "early";
          else if (diffMinutes <= 20) clockInStatus = "on-time";
          else if (diffMinutes <= 90) clockInStatus = "late";
          else clockInStatus = "very-late";

          const saved = await AttendanceLog.create({
            userId,
            institutionId,
            branchId,
            actionType,
            mode: mode || "offline",
            gps,
            timestamp: new Date(timestamp),
            date,

            clockInStatus,
            minutesLate: diffMinutes > 0 ? diffMinutes : 0,

            syncStatus: "synced",
            serverReceivedAt: new Date(),
          });

          results.push({ ...log, syncStatus: "synced", _id: saved._id });
          continue;
        }

        /* ===============================
           CLOCK-OUT
        =============================== */
        if (actionType === "clock-out") {
          const lastClockIn = await AttendanceLog.findOne({
            userId,
            actionType: "clock-in",
            date,
          });

          if (!lastClockIn) {
            results.push({
              ...log,
              syncStatus: "rejected_on_sync",
              reason: "No clock-in found",
            });
            continue;
          }

          const workDurationMinutes = now.diff(
            moment(lastClockIn.timestamp),
            "minutes"
          );

          let clockOutStatus = "completed";

          const [h, m] = settings.workEndTime.split(":").map(Number);

          const expectedEnd = moment(timestamp).set({
            hour: h,
            minute: m,
          });

          if (now.isBefore(expectedEnd)) clockOutStatus = "early_exit";
          else if (now.isAfter(expectedEnd)) clockOutStatus = "overtime";

          const expectedMinutes = (settings.expectedWorkHours || 8) * 60;

          let productivityStatus = "normal";
          if (workDurationMinutes < expectedMinutes * 0.5) {
            productivityStatus = "underworked";
          }

          const saved = await AttendanceLog.create({
            userId,
            institutionId,
            branchId,
            actionType,
            mode: mode || "offline",
            gps,
            timestamp: new Date(timestamp),
            date,

            clockOutStatus,
            workDurationMinutes,
            productivityStatus,

            syncStatus: "synced",
            serverReceivedAt: new Date(),
          });

          results.push({ ...log, syncStatus: "synced", _id: saved._id });
        }

      } catch (innerErr) {
        console.error("Sync error:", innerErr);

        results.push({
          ...log,
          syncStatus: "rejected_on_sync",
          reason: "Server error",
        });
      }
    }

    return res.status(200).json({
      message: "Offline logs synchronized.",
      summary: {
        total: offlineLogs.length,
        synced: results.filter(r => r.syncStatus === "synced").length,
        rejected: results.filter(r => r.syncStatus === "rejected_on_sync").length,
      },
      results,
    });

  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ message: "Server error during sync." });
  }
};




// export const getRealTimeStatus = async (req, res) => {
//   try {
//     const institutionId = req.user.institutionId;
//     const { branchId } = req.query;

//     const startOfDay = new Date();
//     startOfDay.setHours(0, 0, 0, 0);

//     const endOfDay = new Date();
//     endOfDay.setHours(23, 59, 59, 999);

//     /* ================= USERS ================= */

//     const userFilter = { institutionId, isActive: true };
//     if (branchId) userFilter.branchId = branchId;

//     const users = await User.find(userFilter)
//       .select("name role studentOrStaffId departmentOrUnit")
//       .lean();

//     /* ================= LOGS ================= */

//     const logs = await AttendanceLog.find({
//       institutionId,
//       timestamp: { $gte: startOfDay, $lte: endOfDay },
//     }).lean();

//     /* ================= MAP ================= */

//     const clockInMap = new Map();
//     const clockOutMap = new Map();

//     logs.forEach(log => {
//       const userKey = String(log.userId);

//       if (log.actionType === "clock-in") {
//         clockInMap.set(userKey, log);
//       }

//       if (log.actionType === "clock-out") {
//         clockOutMap.set(userKey, log);
//       }
//     });

//     /* ================= GROUPS ================= */

//     const onTime = [];
//     const late = [];
//     const veryLate = [];
//     const early = [];
//     const absent = [];
//     const notClockedOut = [];

//     for (const user of users) {
//       const uId = String(user._id);

//       const clockIn = clockInMap.get(uId);
//       const clockOut = clockOutMap.get(uId);

//       if (!clockIn) {
//         absent.push(user);
//         continue;
//       }

//       const enriched = {
//         ...user,
//         clockInStatus: clockIn.clockInStatus,
//         clockOutStatus: clockOut?.clockOutStatus || null,
//         clockInTime: clockIn.timestamp,
//         clockOutTime: clockOut?.timestamp || null,
//       };

//       // GROUPING
//       switch (clockIn.clockInStatus) {
//         case "on-time":
//           onTime.push(enriched);
//           break;
//         case "late":
//           late.push(enriched);
//           break;
//         case "very-late":
//           veryLate.push(enriched);
//           break;
//         case "early":
//           early.push(enriched);
//           break;
//         default:
//           onTime.push(enriched);
//       }

//       if (clockIn && !clockOut) {
//         notClockedOut.push(enriched);
//       }
//     }

//     /* ================= RESPONSE ================= */

//     return res.status(200).json({
//       success: true,
//       data: {
//         summary: {
//           total: users.length,
//           onTime: onTime.length,
//           late: late.length,
//           veryLate: veryLate.length,
//           early: early.length,
//           absent: absent.length,
//           notClockedOut: notClockedOut.length,
//         },
//         details: {
//           onTime,
//           late,
//           veryLate,
//           early,
//           absent,
//           notClockedOut,
//         },
//       },
//     });

//   } catch (error) {
//     console.error("Realtime status error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch real-time status.",
//     });
//   }
// };




// export const getDashboardSummary = async (req, res) => {
//   try {
//     const institutionId = req.user.institutionId;

//     const startOfDay = new Date();
//     startOfDay.setHours(0, 0, 0, 0);

//     const endOfDay = new Date();
//     endOfDay.setHours(23, 59, 59, 999);

//     /* ================= USERS ================= */

//     const totalUsers = await User.countDocuments({
//       institutionId,
//       isActive: true,
//     });

//     const pendingApprovals = await User.countDocuments({
//       institutionId,
//       role: "pending",
//     });

//     /* ================= TODAY CLOCK-IN ================= */

//     const todaysClockIns = await AttendanceLog.find({
//       institutionId,
//       actionType: "clock-in",
//       timestamp: { $gte: startOfDay, $lte: endOfDay },
//     }).select("clockInStatus branchId mode qrType");

//     const onTime = todaysClockIns.filter(l => l.clockInStatus === "on-time").length;
//     const early = todaysClockIns.filter(l => l.clockInStatus === "early").length;
//     const late = todaysClockIns.filter(l => l.clockInStatus === "late").length;
//     const veryLate = todaysClockIns.filter(l => l.clockInStatus === "very-late").length;

//     const present = todaysClockIns.length;
//     const absent = totalUsers - present;

//     /* ================= TODAY CLOCK-OUT ================= */

//     const todaysClockOuts = await AttendanceLog.find({
//       institutionId,
//       actionType: "clock-out",
//       timestamp: { $gte: startOfDay, $lte: endOfDay },
//     }).select("clockOutStatus");

//     const completed = todaysClockOuts.filter(l => l.clockOutStatus === "completed").length;
//     const earlyExit = todaysClockOuts.filter(l => l.clockOutStatus === "early_exit").length;
//     const overtime = todaysClockOuts.filter(l => l.clockOutStatus === "overtime").length;
//     const underWork = todaysClockOuts.filter(l => l.clockOutStatus === "under_work").length;

//     /* ================= QR + ADMIN ================= */

//     const qrStatic = todaysClockIns.filter(l => l.qrType === "static").length;
//     const qrDynamic = todaysClockIns.filter(l => l.qrType === "dynamic").length;
//     const adminOverrides = todaysClockIns.filter(l => l.mode === "admin_override").length;

//     /* ================= WEEKLY TREND ================= */

//     const today = new Date();
//     const weeklyTrend = [];

//     for (let i = 6; i >= 0; i--) {
//       const dayStart = new Date(today);
//       dayStart.setDate(today.getDate() - i);
//       dayStart.setHours(0, 0, 0, 0);

//       const dayEnd = new Date(dayStart);
//       dayEnd.setHours(23, 59, 59, 999);

//       const dayLogs = await AttendanceLog.find({
//         institutionId,
//         actionType: "clock-in",
//         timestamp: { $gte: dayStart, $lte: dayEnd },
//       }).select("mode qrType");

//       const attendanceCount = dayLogs.length;
//       const rate = totalUsers
//         ? ((attendanceCount / totalUsers) * 100).toFixed(1)
//         : 0;

//       const dayQrStatic = dayLogs.filter(l => l.qrType === "static").length;
//       const dayQrDynamic = dayLogs.filter(l => l.qrType === "dynamic").length;
//       const dayAdminOverrides = dayLogs.filter(l => l.mode === "admin_override").length;

//       weeklyTrend.push({
//         date: dayStart.toISOString().split("T")[0],
//         attendanceRate: Number(rate),
//         qrStaticCount: dayQrStatic,
//         qrDynamicCount: dayQrDynamic,
//         adminOverrideCount: dayAdminOverrides,
//       });
//     }

//     /* ================= TOP BRANCHES ================= */

//     const topBranches = await AttendanceLog.aggregate([
//       {
//         $match: {
//           institutionId,
//           actionType: "clock-in",
//           timestamp: { $gte: startOfDay, $lte: endOfDay },
//         },
//       },
//       {
//         $group: {
//           _id: "$branchId",
//           total: { $sum: 1 },
//           qrStatic: {
//             $sum: { $cond: [{ $eq: ["$qrType", "static"] }, 1, 0] },
//           },
//           qrDynamic: {
//             $sum: { $cond: [{ $eq: ["$qrType", "dynamic"] }, 1, 0] },
//           },
//           adminOverrides: {
//             $sum: { $cond: [{ $eq: ["$mode", "admin_override"] }, 1, 0] },
//           },
//         },
//       },
//       { $sort: { total: -1 } },
//       { $limit: 5 },
//       {
//         $lookup: {
//           from: "branches",
//           localField: "_id",
//           foreignField: "_id",
//           as: "branch",
//         },
//       },
//       { $unwind: "$branch" },
//       {
//         $project: {
//           _id: 0,
//           branchId: "$branch._id",
//           branchName: "$branch.name",
//           total: 1,
//           qrStatic: 1,
//           qrDynamic: 1,
//           adminOverrides: 1,
//         },
//       },
//     ]);

//     /* ================= FINAL RESPONSE ================= */

//     const summary = {
//       todaySummary: {
//         totalUsers,
//         present,
//         absent,

//         // CLOCK-IN
//         onTime,
//         early,
//         late,
//         veryLate,

//         // CLOCK-OUT
//         completed,
//         earlyExit,
//         overtime,
//         underWork,

//         // SYSTEM
//         qrStatic,
//         qrDynamic,
//         adminOverrides,
//       },
//       weeklyTrend,
//       topBranches,
//       pendingApprovals,
//     };

//     return res.status(200).json({
//       success: true,
//       data: summary,
//     });

//   } catch (error) {
//     console.error("Dashboard summary error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to generate dashboard summary",
//     });
//   }
// };

//  Replace multiple .find() with MongoDB aggregation pipeline (1 query instead of many)
//  Add caching (Redis)
//  Add monthly + department analytics

export const getRealTimeStatus = async (req, res) => {
  try {
    const { institutionId, role, userId } = req.user;
    const { branchId, summaryOnly = "false" } = req.query;

    /* ================= ROLE CHECK ================= */

    const roles = Array.isArray(role) ? role : [role];

    const isAdmin = roles.includes("admin");
    const isSuperAdmin = roles.includes("super_admin");

    if (!isAdmin && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view real-time attendance",
      });
    }

    /* ================= VALIDATE BRANCH ================= */

    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    /* ================= SETTINGS / TIMEZONE ================= */

    const setting = await InstitutionSetting.findOne({
      institutionId,
      isActive: true,
    }).select("timezone");

    const timezone = setting?.timezone || "Africa/Lagos";

    const startOfDay = moment()
      .tz(timezone)
      .startOf("day")
      .toDate();

    const endOfDay = moment()
      .tz(timezone)
      .endOf("day")
      .toDate();

    /* ================= USERS ================= */

    const userFilter = {
      institutionId,
      isActive: true,
      role: {
        $nin: ["pending", "rejected"],
      },
      createdAt: { $lte: endOfDay }, // avoid future/new onboarding issue
    };

    if (branchId) {
      userFilter.branchId = branchId;
    }

    const users = await User.find(userFilter)
      .select(
        "name role studentOrStaffId departmentOrUnit branchId createdAt"
      )
      .lean();

    /* ================= LOG QUERY ================= */

    const logQuery = {
      institutionId,
      isActive: true,
      timestamp: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    if (branchId) {
      logQuery.branchId = branchId;
    }

    const logs = await AttendanceLog.find(logQuery)
      .sort({ timestamp: 1 })
      .lean();

    /* ================= MAP LATEST CLOCK-IN / OUT ================= */

    const clockInMap = new Map();
    const clockOutMap = new Map();

    for (const log of logs) {
      const userKey = String(log.userId);

      if (log.actionType === "clock-in") {
        const existing = clockInMap.get(userKey);

        if (
          !existing ||
          new Date(log.timestamp) > new Date(existing.timestamp)
        ) {
          clockInMap.set(userKey, log);
        }
      }

      if (log.actionType === "clock-out") {
        const existing = clockOutMap.get(userKey);

        if (
          !existing ||
          new Date(log.timestamp) > new Date(existing.timestamp)
        ) {
          clockOutMap.set(userKey, log);
        }
      }
    }

    /* ================= GROUPS ================= */

    const tooEarly = [];
    const early = [];
    const onTime = [];
    const late = [];
    const veryLate = [];
    const absent = [];
    const notClockedOut = [];

    for (const user of users) {
      const uId = String(user._id);

      /* ================= ONBOARDING SAFETY ================= */
      if (new Date(user.createdAt) > startOfDay) {
        continue;
      }

      const clockIn = clockInMap.get(uId);
      const clockOut = clockOutMap.get(uId);

      if (!clockIn) {
        absent.push(user);
        continue;
      }

      const enriched = {
        _id: user._id,
        name: user.name,
        role: user.role,
        studentOrStaffId: user.studentOrStaffId || null,
        departmentOrUnit: user.departmentOrUnit || null,
        branchId: user.branchId || null,

        clockInStatus: clockIn.clockInStatus || null,
        clockOutStatus: clockOut?.clockOutStatus || null,

        clockInTime: clockIn.timestamp,
        clockOutTime: clockOut?.timestamp || null,

        mode: clockIn.mode || null,
        minutesLate: clockIn.minutesLate || 0,
      };

      /* ================= STATUS GROUPING ================= */

      switch (clockIn.clockInStatus) {
        case "too-early":
          tooEarly.push(enriched);
          break;

        case "early":
          early.push(enriched);
          break;

        case "on-time":
          onTime.push(enriched);
          break;

        case "late":
          late.push(enriched);
          break;

        case "very-late":
          veryLate.push(enriched);
          break;

        default:
          onTime.push(enriched);
      }

      /* ================= NOT CLOCKED OUT ================= */

      if (clockIn && !clockOut) {
        notClockedOut.push(enriched);
      }
    }

    /* ================= SUMMARY ================= */

    const summary = {
      total: users.filter(
        (u) => new Date(u.createdAt) <= startOfDay
      ).length,

      tooEarly: tooEarly.length,
      early: early.length,
      onTime: onTime.length,
      late: late.length,
      veryLate: veryLate.length,

      absent: absent.length,
      notClockedOut: notClockedOut.length,
    };

    /* ================= RESPONSE ================= */

    if (summaryOnly === "true") {
      return res.status(200).json({
        success: true,
        timezone,
        data: { summary },
      });
    }

    return res.status(200).json({
      success: true,
      timezone,
      data: {
        summary,
        details: {
          tooEarly,
          early,
          onTime,
          late,
          veryLate,
          absent,
          notClockedOut,
        },
      },
    });
  } catch (error) {
    console.error("Realtime status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch real-time status",
    });
  }
};


export const getDashboardSummary = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    /* ================= ELIGIBLE USERS (ONLY STAFF/STUDENTS ACTIVE BEFORE TODAY) ================= */

    const eligibleRoles = ["staff", "student"];

    const totalUsers = await User.countDocuments({
      institutionId,
      isActive: true,
      createdAt: { $lte: endOfDay },
      role: { $in: eligibleRoles },
    });

    const pendingApprovals = await User.countDocuments({
      institutionId,
      role: "pending",
    });

    /* ================= TODAY CLOCK-IN ================= */

    const todaysClockIns = await AttendanceLog.find({
      institutionId,
      actionType: "clock-in",
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).select("clockInStatus branchId mode qrType");

    const onTime = todaysClockIns.filter(
      (l) => l.clockInStatus === "on-time"
    ).length;

    const early = todaysClockIns.filter(
      (l) => l.clockInStatus === "early"
    ).length;

    const late = todaysClockIns.filter(
      (l) => l.clockInStatus === "late"
    ).length;

    const veryLate = todaysClockIns.filter(
      (l) => l.clockInStatus === "very-late"
    ).length;

    const present = todaysClockIns.length;

    // Prevent negative values
    const absent = Math.max(totalUsers - present, 0);

    /* ================= TODAY CLOCK-OUT ================= */

    const todaysClockOuts = await AttendanceLog.find({
      institutionId,
      actionType: "clock-out",
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).select("clockOutStatus");

    const completed = todaysClockOuts.filter(
      (l) => l.clockOutStatus === "completed"
    ).length;

    const earlyExit = todaysClockOuts.filter(
      (l) => l.clockOutStatus === "early_exit"
    ).length;

    const overtime = todaysClockOuts.filter(
      (l) => l.clockOutStatus === "overtime"
    ).length;

    const underWork = todaysClockOuts.filter(
      (l) => l.clockOutStatus === "under_work"
    ).length;

    /* ================= QR + ADMIN ================= */

    const qrStatic = todaysClockIns.filter(
      (l) => l.qrType === "static"
    ).length;

    const qrDynamic = todaysClockIns.filter(
      (l) => l.qrType === "dynamic"
    ).length;

    const adminOverrides = todaysClockIns.filter(
      (l) => l.mode === "admin_override"
    ).length;

    /* ================= WEEKLY TREND ================= */

    const today = new Date();
    const weeklyTrend = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      /* ===== ELIGIBLE USERS FOR THAT DAY ===== */
      const eligibleUsersForDay = await User.countDocuments({
        institutionId,
        isActive: true,
        createdAt: { $lte: dayEnd },
        role: { $in: eligibleRoles },
      });

      /* ===== CLOCK-INS FOR THAT DAY ===== */
      const dayLogs = await AttendanceLog.find({
        institutionId,
        actionType: "clock-in",
        timestamp: { $gte: dayStart, $lte: dayEnd },
      }).select("mode qrType");

      const attendanceCount = dayLogs.length;

      const rate = eligibleUsersForDay
        ? ((attendanceCount / eligibleUsersForDay) * 100).toFixed(1)
        : 0;

      const dayQrStatic = dayLogs.filter(
        (l) => l.qrType === "static"
      ).length;

      const dayQrDynamic = dayLogs.filter(
        (l) => l.qrType === "dynamic"
      ).length;

      const dayAdminOverrides = dayLogs.filter(
        (l) => l.mode === "admin_override"
      ).length;

      weeklyTrend.push({
        date: dayStart.toISOString().split("T")[0],
        eligibleUsers: eligibleUsersForDay,
        present: attendanceCount,
        absent: Math.max(eligibleUsersForDay - attendanceCount, 0),
        attendanceRate: Number(rate),
        qrStaticCount: dayQrStatic,
        qrDynamicCount: dayQrDynamic,
        adminOverrideCount: dayAdminOverrides,
      });
    }

    /* ================= TOP BRANCHES ================= */

    const topBranches = await AttendanceLog.aggregate([
      {
        $match: {
          institutionId,
          actionType: "clock-in",
          timestamp: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: "$branchId",
          total: { $sum: 1 },
          qrStatic: {
            $sum: {
              $cond: [{ $eq: ["$qrType", "static"] }, 1, 0],
            },
          },
          qrDynamic: {
            $sum: {
              $cond: [{ $eq: ["$qrType", "dynamic"] }, 1, 0],
            },
          },
          adminOverrides: {
            $sum: {
              $cond: [{ $eq: ["$mode", "admin_override"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branch",
        },
      },
      { $unwind: "$branch" },
      {
        $project: {
          _id: 0,
          branchId: "$branch._id",
          branchName: "$branch.name",
          total: 1,
          qrStatic: 1,
          qrDynamic: 1,
          adminOverrides: 1,
        },
      },
    ]);

    /* ================= FINAL RESPONSE ================= */

    const summary = {
      todaySummary: {
        totalUsers,
        present,
        absent,

        // CLOCK-IN
        onTime,
        early,
        late,
        veryLate,

        // CLOCK-OUT
        completed,
        earlyExit,
        overtime,
        underWork,

        // SYSTEM
        qrStatic,
        qrDynamic,
        adminOverrides,
      },

      weeklyTrend,

      topBranches,

      pendingApprovals,
    };

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate dashboard summary",
    });
  }
};

// export const getStaffDashboardOverview = async (req, res) => {
//   try {
//     const userId = req.user.userId || req.user.id;

//     /* ================= FETCH USER ================= */

//     const user = await User.findById(userId).select(
//       "name avatar role institutionId"
//     );

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     /* ================= SETTINGS ================= */

//     const setting = await InstitutionSetting.findOne({
//       institutionId: user.institutionId,
//     });

//     const timezone = setting?.timezone || "Africa/Lagos";
//     const expectedDailyHours = setting?.expectedDailyHours || 8;

//     const now = moment().tz(timezone);
//     const todayStart = now.clone().startOf("day").toDate();

//     /* ================= TODAY LOGS ================= */

//     const todayLogs = await AttendanceLog.find({
//       userId,
//       date: todayStart,
//     }).sort({ timestamp: 1 });

//     const clockIn = todayLogs.find((l) => l.actionType === "clock-in");
//     const clockOut = todayLogs.find((l) => l.actionType === "clock-out");

//     /* ================= WORK HOURS ================= */

//     let totalWorkedToday = 0;

//     if (clockIn && clockOut) {
//       totalWorkedToday = (clockOut.workDurationMinutes || 0) / 60;
//     } else if (clockIn && !clockOut) {
//       totalWorkedToday =
//         now.diff(moment(clockIn.timestamp), "minutes") / 60;
//     }

//     /* ================= CLOCK-IN STATUS ================= */

//     let clockInStatus = null;
//     let minutesLate = 0;

//     if (clockIn) {
//       minutesLate = clockIn.minutesLate || 0;
//       clockInStatus = minutesLate > 0 ? "late" : "on-time";
//     }

//     /* ================= CLOCK-OUT STATUS ================= */

//     let clockOutStatus = null;
//     let underWorked = false;

//     if (clockOut && setting?.workEndTime) {
//       const [endHour, endMin] = setting.workEndTime.split(":");

//       const expectedEnd = moment(clockOut.timestamp)
//         .tz(timezone)
//         .set({ hour: endHour, minute: endMin });

//       if (moment(clockOut.timestamp).isBefore(expectedEnd)) {
//         underWorked = true;
//         clockOutStatus = "early";
//       } else {
//         clockOutStatus = "normal";
//       }
//     }

//     /* ================= REMAINING HOURS ================= */

//     let remainingHours = 0;

//     if (!clockIn) {
//       remainingHours = expectedDailyHours;
//     } else if (clockIn && !clockOut) {
//       remainingHours = Math.max(0, expectedDailyHours - totalWorkedToday);
//     }

//     /* ================= WEEK RANGE ================= */

//     const weekStart = now.clone().startOf("isoWeek").toDate();
//     const weekEnd = now.clone().endOf("isoWeek").toDate();

//     const weekClockOutLogs = await AttendanceLog.find({
//       userId,
//       timestamp: { $gte: weekStart, $lte: weekEnd },
//       actionType: "clock-out",
//     });

//     /* ================= WEEKLY TREND ================= */

//     const weeklyMap = {};

//     weekClockOutLogs.forEach((log) => {
//       const day = moment(log.timestamp)
//         .tz(timezone)
//         .format("ddd");

//       const hours = (log.workDurationMinutes || 0) / 60;

//       weeklyMap[day] = (weeklyMap[day] || 0) + hours;
//     });

//     const weeklyTrend = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
//       .map((day) => ({
//         day,
//         hours: Number((weeklyMap[day] || 0).toFixed(2)),
//       }))
//       .filter((d) => d.hours > 0);

//     /* ================= SUMMARY ================= */

//     const totalHoursWeek =
//       weekClockOutLogs.reduce(
//         (acc, log) => acc + (log.workDurationMinutes || 0),
//         0
//       ) / 60;

//     const presentDays = weekClockOutLogs.length;

//     const lateDays = await AttendanceLog.countDocuments({
//       userId,
//       timestamp: { $gte: weekStart, $lte: weekEnd },
//       minutesLate: { $gt: 0 },
//       actionType: "clock-in",
//     });

//     const workingDaysCount = setting?.workingDays?.length || 5;

//     const absentDays = Math.max(0, workingDaysCount - presentDays);

//     const attendanceRate =
//       workingDaysCount > 0
//         ? Math.round((presentDays / workingDaysCount) * 100)
//         : 0;

//     const overtimeHours =
//       totalHoursWeek > expectedDailyHours * workingDaysCount
//         ? totalHoursWeek - expectedDailyHours * workingDaysCount
//         : 0;

//     /* ================= RESPONSE ================= */

//     return res.status(200).json({
//       success: true,
//       data: {
//         user: {
//           _id: user._id,
//           name: user.name,
//           avatar: user.avatar || null,
//           role: user.role,
//         },

//         /* ✅ CLEAN TODAY STATUS */
//         todayStatus: {
//           clockedIn: !!clockIn,
//           clockInTime: clockIn ? clockIn.timestamp : null,
//           clockInStatus,
//           minutesLate,

//           clockedOut: !!clockOut,
//           clockOutTime: clockOut ? clockOut.timestamp : null,
//           clockOutStatus,

//           underWorked,

//           totalWorkedToday: Number(totalWorkedToday.toFixed(2)),
//           expectedDailyHours,
//           remainingHours: Number(remainingHours.toFixed(2)),
//         },

//         /* ✅ SUMMARY */
//         summary: {
//           attendanceRate,
//           lateDays,
//           absentDays,
//           overtimeHours: Number(overtimeHours.toFixed(2)),
//           totalHoursWeek: Number(totalHoursWeek.toFixed(2)),
//           presentDays,
//           totalWorkingDays: workingDaysCount,
//         },

//         weeklyTrend,

//         notifications: {
//           unread: 0,
//         },
//       },
//     });

//   } catch (error) {
//     console.error("Dashboard error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to load dashboard",
//     });
//   }
// };

// interesting

export const getStaffDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    /* ================= FETCH USER ================= */

    const user = await User.findById(userId).select(
      "name avatar role institutionId createdAt isActive"
    );

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    /* ================= SETTINGS ================= */

    const setting = await InstitutionSetting.findOne({
      institutionId: user.institutionId,
      isActive: true,
    });

    const timezone = setting?.timezone || "Africa/Lagos";

    // FIX: your schema uses expectedWorkHours, not expectedDailyHours
    const expectedDailyHours = setting?.expectedWorkHours || 8;

    const workingDays = setting?.workingDays || [
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ];

    const now = moment().tz(timezone);

    const todayStart = now.clone().startOf("day").toDate();
    const todayEnd = now.clone().endOf("day").toDate();

    /* ================= TODAY LOGS ================= */

    const todayLogs = await AttendanceLog.find({
      userId,
      date: todayStart,
      isActive: true,
    }).sort({ timestamp: 1 });

    const clockIn = todayLogs.find((l) => l.actionType === "clock-in");
    const clockOut = todayLogs.find((l) => l.actionType === "clock-out");

    /* ================= WORK HOURS TODAY ================= */

    let totalWorkedToday = 0;

    if (clockIn && clockOut) {
      totalWorkedToday = (clockOut.workDurationMinutes || 0) / 60;
    } else if (clockIn && !clockOut) {
      totalWorkedToday =
        now.diff(moment(clockIn.timestamp).tz(timezone), "minutes") / 60;
    }

    /* ================= CLOCK-IN STATUS ================= */

    let clockInStatus = null;
    let minutesLate = 0;

    if (clockIn) {
      minutesLate = clockIn.minutesLate || 0;
      clockInStatus = clockIn.clockInStatus || (minutesLate > 0 ? "late" : "on-time");
    }

    /* ================= CLOCK-OUT STATUS ================= */

    let clockOutStatus = null;
    let underWorked = false;

    if (clockOut) {
      clockOutStatus = clockOut.clockOutStatus || null;

      if (clockOut.workDurationMinutes) {
        underWorked = clockOut.workDurationMinutes < expectedDailyHours * 60;
      }
    }

    /* ================= REMAINING HOURS ================= */

    let remainingHours = 0;

    if (!clockIn) {
      remainingHours = expectedDailyHours;
    } else if (clockIn && !clockOut) {
      remainingHours = Math.max(0, expectedDailyHours - totalWorkedToday);
    }

    /* ================= WEEK RANGE ================= */

    const weekStart = now.clone().startOf("isoWeek");
    const weekEnd = now.clone().endOf("isoWeek");

    /* ================= USER START SAFETY ================= */
    // Prevent counting days before user joined
    const employmentStart = moment(user.createdAt)
      .tz(timezone)
      .startOf("day");

    const effectiveWeekStart = moment.max(
      weekStart.clone(),
      employmentStart.clone()
    );

    /* ================= WEEK LOGS ================= */

    const weekClockOutLogs = await AttendanceLog.find({
      userId,
      actionType: "clock-out",
      isActive: true,
      timestamp: {
        $gte: effectiveWeekStart.toDate(),
        $lte: weekEnd.toDate(),
      },
    });

    const weekClockInLogs = await AttendanceLog.find({
      userId,
      actionType: "clock-in",
      isActive: true,
      timestamp: {
        $gte: effectiveWeekStart.toDate(),
        $lte: weekEnd.toDate(),
      },
    });

    /* ================= WEEKLY TREND ================= */

    const weeklyMap = {};

    weekClockOutLogs.forEach((log) => {
      const day = moment(log.timestamp).tz(timezone).format("ddd");

      const hours = (log.workDurationMinutes || 0) / 60;

      weeklyMap[day] = (weeklyMap[day] || 0) + hours;
    });

    const weeklyTrend = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((day) => ({
        day,
        hours: Number((weeklyMap[day] || 0).toFixed(2)),
      }))
      .filter((d) => d.hours > 0);

    /* ================= PRESENT DAYS ================= */
    // Count unique days with clock-in, not raw log count
    const uniquePresentDays = new Set(
      weekClockInLogs.map((log) =>
        moment(log.timestamp).tz(timezone).format("YYYY-MM-DD")
      )
    );

    const presentDays = uniquePresentDays.size;

    /* ================= LATE DAYS ================= */

    const uniqueLateDays = new Set(
      weekClockInLogs
        .filter((log) => (log.minutesLate || 0) > 0)
        .map((log) =>
          moment(log.timestamp).tz(timezone).format("YYYY-MM-DD")
        )
    );

    const lateDays = uniqueLateDays.size;

    /* ================= ELIGIBLE WORKING DAYS ================= */

    let eligibleWorkingDays = 0;

    const cursor = effectiveWeekStart.clone();

    while (cursor.isSameOrBefore(weekEnd, "day")) {
      const dayName = cursor.format("ddd");

      if (workingDays.includes(dayName)) {
        eligibleWorkingDays++;
      }

      cursor.add(1, "day");
    }

    /* ================= ABSENT DAYS ================= */

    const absentDays = Math.max(0, eligibleWorkingDays - presentDays);

    /* ================= ATTENDANCE RATE ================= */

    const attendanceRate =
      eligibleWorkingDays > 0
        ? Math.round((presentDays / eligibleWorkingDays) * 100)
        : 0;

    /* ================= TOTAL HOURS ================= */

    const totalHoursWeek =
      weekClockOutLogs.reduce(
        (acc, log) => acc + (log.workDurationMinutes || 0),
        0
      ) / 60;

    /* ================= OVERTIME ================= */

    const expectedWeeklyHours = expectedDailyHours * eligibleWorkingDays;

    const overtimeHours =
      totalHoursWeek > expectedWeeklyHours
        ? totalHoursWeek - expectedWeeklyHours
        : 0;

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          avatar: user.avatar || null,
          role: user.role,
        },

        todayStatus: {
          clockedIn: !!clockIn,
          clockInTime: clockIn ? clockIn.timestamp : null,
          clockInStatus,
          minutesLate,

          clockedOut: !!clockOut,
          clockOutTime: clockOut ? clockOut.timestamp : null,
          clockOutStatus,

          underWorked,

          totalWorkedToday: Number(totalWorkedToday.toFixed(2)),
          expectedDailyHours,
          remainingHours: Number(remainingHours.toFixed(2)),
        },

        summary: {
          attendanceRate,
          lateDays,
          absentDays,
          overtimeHours: Number(overtimeHours.toFixed(2)),
          totalHoursWeek: Number(totalHoursWeek.toFixed(2)),
          presentDays,
          totalWorkingDays: eligibleWorkingDays,
        },

        weeklyTrend,

        notifications: {
          unread: 0,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};

export const getUserWorkSchedule = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    /* ================= USER ================= */

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* ================= SETTINGS ================= */

    const settings = await InstitutionSetting.findOne({
      institutionId: user.institutionId,
    });

    const timezone = settings?.timezone || "Africa/Lagos";
    const now = moment().tz(timezone);

    const todayStart = now.clone().startOf("day").toDate();

    /* ================= TODAY LOGS ================= */

    const logs = await AttendanceLog.find({
      userId,
      date: todayStart,
    }).sort({ timestamp: 1 });

    const clockIn = logs.find((l) => l.actionType === "clock-in");
    const clockOut = logs.find((l) => l.actionType === "clock-out");

    /* ================= DEFAULT SCHEDULE ================= */

    const defaultStartTime = settings?.workStartTime || "08:00";
    const defaultEndTime = settings?.workEndTime || "17:00";

    /* ================= ACTUAL TIMES ================= */

    const actualStartTime = clockIn
      ? moment(clockIn.timestamp).tz(timezone).format("HH:mm")
      : null;

    const actualEndTime = clockOut
      ? moment(clockOut.timestamp).tz(timezone).format("HH:mm")
      : null;

    /* ================= STATUS ================= */

    let startStatus = null;
    let endStatus = null;

    if (clockIn) {
      startStatus =
        clockIn.minutesLate > 0 ? "late" : "on-time";
    }

    if (clockOut) {
      const expectedEnd = moment(clockOut.timestamp)
        .tz(timezone)
        .set({
          hour: defaultEndTime.split(":")[0],
          minute: defaultEndTime.split(":")[1],
        });

      endStatus = moment(clockOut.timestamp).isBefore(expectedEnd)
        ? "early"
        : "completed";
    }

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      data: {
        userId: user._id,

        schedule: {
          expectedStartTime: defaultStartTime,
          expectedEndTime: defaultEndTime,

          actualStartTime,
          actualEndTime,

          startStatus,
          endStatus,
        },

        summary: {
          isClockedIn: !!clockIn,
          isClockedOut: !!clockOut,
        },
      },
    });

  } catch (error) {
    console.error("Work schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch work schedule",
    });
  }
};
