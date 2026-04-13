import mongoose from "mongoose";
import moment from "moment-timezone";
import { Branch,AttendanceLog,Shift, User, InstitutionSetting  } from "@clockee/shared";
import {
  validateBranch,
  checkGeofence,
  checkDuplicateClockIn,
  detectShiftAndStatus,
  validateInstitutionPolicy,

} from "../utils/clock.helpers.js";


//  export const clockAttendance = async (req, res) => {
// //   try {
// //     const {
// //       actionType,
// //       mode,
// //       gps,
// //       qrCode,
// //       totp,
// //       token,
// //       backupCode,
// //       overrideCode,
// //     } = req.body;

// //     const userId = req.user.userId || req.user.id;

// //     const userRoles = Array.isArray(req.user.role)
// //       ? req.user.role
// //       : [req.user.role];

// //     /* ===============================
// //        1️⃣ BASIC VALIDATION
// //     =============================== */

// //     const allowedActions = ["clock-in", "clock-out"];
// //     const allowedModes = [
// //       "qr",
// //       "totp",
// //       "silent",
// //       "backup_code",
// //       "admin_override",
// //     ];

// //     if (!allowedActions.includes(actionType)) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Invalid action type",
// //       });
// //     }

// //     if (!allowedModes.includes(mode)) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Invalid clocking mode",
// //       });
// //     }

// //     /* ===============================
// //        2️⃣ GPS VALIDATION
// //     =============================== */

// //     if (!gps || typeof gps.lat !== "number" || typeof gps.lng !== "number") {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Valid GPS location is required",
// //       });
// //     }

// //     const { lat, lng } = gps;

// //     if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Invalid GPS coordinates",
// //       });
// //     }

// //     /* ===============================
// //        3️⃣ MODE VALIDATION
// //     =============================== */

// //     if (mode === "qr" && !qrCode)
// //       return res.status(400).json({ success: false, message: "QR code required" });

// //     if (mode === "totp" && !totp)
// //       return res.status(400).json({ success: false, message: "TOTP required" });

// //     if (mode === "silent" && !token)
// //       return res.status(400).json({ success: false, message: "Token required" });

// //     if (mode === "backup_code" && !backupCode)
// //       return res.status(400).json({ success: false, message: "Backup code required" });

// //     /* ===============================
// //        4️⃣ ADMIN OVERRIDE
// //     =============================== */

// //     const isAdmin =
// //       userRoles.includes("admin") || userRoles.includes("super_admin");

// //     if (mode === "admin_override") {
// //       if (!isAdmin) {
// //         return res.status(403).json({
// //           success: false,
// //           message: "Not authorized",
// //         });
// //       }

// //       if (!overrideCode || overrideCode !== process.env.ADMIN_OVERRIDE_SECRET) {
// //         return res.status(403).json({
// //           success: false,
// //           message: "Invalid override code",
// //         });
// //       }
// //     }

// //     /* ===============================
// //        5️⃣ FETCH USER
// //     =============================== */

// //     const user = await User.findById(userId);

// //     if (!user || !user.isActive) {
// //       return res.status(404).json({
// //         success: false,
// //         message: "User not found or inactive",
// //       });
// //     }

// //     /* ===============================
// //        6️⃣ SETTINGS
// //     =============================== */

// //     const institutionSetting = await InstitutionSetting.findOne({
// //       institutionId: user.institutionId,
// //       isActive: true,
// //     });

// //     const settings = {
// //       allowRemoteClocking: false,
// //       enforceGeofence: false,
// //       gpsRadiusMeters: 100,
// //       officeLocation: null,
// //       timezone: "Africa/Lagos",
// //       workStartTime: "08:00",
// //       gracePeriodMinutes: 20,
// //       clockingWindow: { earlyMinutes: 20, lateMinutes: 90 },
// //       ...(institutionSetting ? institutionSetting.toObject() : {}),
// //     };

// //     /* ===============================
// //        7️⃣ REMOTE POLICY
// //     =============================== */

// //     const REMOTE_TYPES = ["remote", "hybrid", "field"];
// //     const isRemoteUser = REMOTE_TYPES.includes(user.clockMode);
// //     const userAllowsRemote = user.remoteAccess?.allowed === true;

// //     if (isRemoteUser && (!settings.allowRemoteClocking || !userAllowsRemote)) {
// //       return res.status(403).json({
// //         success: false,
// //         message: "Remote clocking not permitted",
// //       });
// //     }

// //     /* ===============================
// //        8️⃣ DISTANCE + GEOFENCE
// //     =============================== */

// //     let distanceFromOffice = null;

// //     if (settings.officeLocation?.coordinates?.length === 2) {
// //       const [officeLng, officeLat] = settings.officeLocation.coordinates;

// //       const toRad = (v) => (v * Math.PI) / 180;
// //       const R = 6378137;

// //       const dLat = toRad(lat - officeLat);
// //       const dLng = toRad(lng - officeLng);

// //       const a =
// //         Math.sin(dLat / 2) ** 2 +
// //         Math.cos(toRad(officeLat)) *
// //           Math.cos(toRad(lat)) *
// //           Math.sin(dLng / 2) ** 2;

// //       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// //       distanceFromOffice = R * c;

// //       if (
// //         !isRemoteUser &&
// //         settings.enforceGeofence &&
// //         mode !== "admin_override" &&
// //         distanceFromOffice > settings.gpsRadiusMeters
// //       ) {
// //         return res.status(403).json({
// //           success: false,
// //           message: "Outside allowed location",
// //           meta: {
// //             distanceFromOffice: Math.round(distanceFromOffice),
// //             allowedRadius: settings.gpsRadiusMeters,
// //           },
// //         });
// //       }
// //     }

// //     /* ===============================
// //        9️⃣ TIME + LATENESS ENGINE
// //     =============================== */

// //     const now = moment().tz(settings.timezone);

// //     const [startHour, startMinute] = settings.workStartTime.split(":");

// //     const expectedStart = moment()
// //       .tz(settings.timezone)
// //       .set({
// //         hour: parseInt(startHour),
// //         minute: parseInt(startMinute),
// //         second: 0,
// //         millisecond: 0,
// //       });

// //     const diffMinutes = now.diff(expectedStart, "minutes");

// //     let clockInStatus = "on-time";

// //     if (diffMinutes < -settings.clockingWindow.earlyMinutes) {
// //       clockInStatus = "too-early";
// //     } else if (diffMinutes < 0) {
// //       clockInStatus = "early";
// //     } else if (diffMinutes <= settings.gracePeriodMinutes) {
// //       clockInStatus = "on-time";
// //     } else if (diffMinutes <= settings.clockingWindow.lateMinutes) {
// //       clockInStatus = "late";
// //     } else {
// //       clockInStatus = "very-late";
// //     }

// //     /* ===============================
// //        🔟 DATE NORMALIZATION
// //     =============================== */

// //     const date = now.clone().startOf("day").toDate();

// //     /* ===============================
// //        11️⃣ SAVE
// //     =============================== */

// //     const attendance = await AttendanceLog.create({
// //       userId,
// //       institutionId: user.institutionId,

// //       actionType,
// //       mode,

// //       gps: {
// //         type: "Point",
// //         coordinates: [lng, lat],
// //       },

// //       timestamp: now.toDate(),
// //       date,

// //       validationResult: "accepted",

// //       status: "present",
// //       clockInStatus,
// //       minutesLate: diffMinutes > 0 ? diffMinutes : 0,

// //       // ✅ NEW FIELD
// //       distanceFromOffice: distanceFromOffice
// //         ? Math.round(distanceFromOffice)
// //         : null,

// //       ipAddress: req.ip,
// //       deviceInfo: req.headers["user-agent"],

// //       ...(mode === "admin_override" && {
// //         adminOverrideBy: userId,
// //         overrideReason: "Admin override",
// //       }),

// //       ...(mode === "qr" && { qrCode }),
// //       ...(mode === "totp" && { totp }),
// //       ...(mode === "silent" && { token }),
// //       ...(mode === "backup_code" && { backupCode }),
// //     });

// //     return res.status(201).json({
// //       success: true,
// //       message: `${actionType} successful`,
// //       meta: {
// //         clockInStatus,
// //         minutesLate: diffMinutes > 0 ? diffMinutes : 0,
// //         distanceFromOffice: distanceFromOffice
// //           ? Math.round(distanceFromOffice)
// //           : null,
// //       },
// //       data: attendance,
// //     });

// //   } catch (error) {
// //     console.error("Clock attendance error:", error);

// //     if (error.code === 11000) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "You already performed this action today",
// //       });
// //     }

// //     return res.status(500).json({
// //       success: false,
// //       message: "Failed to process attendance",
// //     });
// //   }
// // };




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

    /* ===============================
       BASIC VALIDATION
    =============================== */

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

    /* ===============================
       GPS VALIDATION
    =============================== */

    if (!gps || typeof gps.lat !== "number" || typeof gps.lng !== "number") {
      return res.status(400).json({
        success: false,
        message: "Valid GPS location is required",
      });
    }

    const { lat, lng } = gps;

    /* ===============================
       MODE VALIDATION
    =============================== */

    if (mode === "qr" && !qrCode)
      return res.status(400).json({ success: false, message: "QR code required" });

    if (mode === "totp" && !totp)
      return res.status(400).json({ success: false, message: "TOTP required" });

    if (mode === "silent" && !token)
      return res.status(400).json({ success: false, message: "Token required" });

    if (mode === "backup_code" && !backupCode)
      return res.status(400).json({ success: false, message: "Backup code required" });

    /* ===============================
        ADMIN OVERRIDE
    =============================== */

    const isAdmin =
      userRoles.includes("admin") || userRoles.includes("super_admin");

    if (mode === "admin_override") {
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Not authorized",
        });
      }

      if (!overrideCode || overrideCode !== process.env.ADMIN_OVERRIDE_SECRET) {
        return res.status(403).json({
          success: false,
          message: "Invalid override code",
        });
      }
    }

    /* ===============================
        FETCH USER
    =============================== */

    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    /* ===============================
        SETTINGS
    =============================== */

    const institutionSetting = await InstitutionSetting.findOne({
      institutionId: user.institutionId,
      isActive: true,
    });

    const settings = {
      allowRemoteClocking: false,
      enforceGeofence: false,
      gpsRadiusMeters: 100,
      officeLocation: null,
      timezone: "Africa/Lagos",
      workStartTime: "08:00",
      gracePeriodMinutes: 20,
      clockingWindow: { earlyMinutes: 20, lateMinutes: 90 },
      ...(institutionSetting ? institutionSetting.toObject() : {}),
    };

    /* ===============================
        GEO + DISTANCE
    =============================== */

    let distanceFromOffice = null;

    if (settings.officeLocation?.coordinates?.length === 2) {
      const [officeLng, officeLat] = settings.officeLocation.coordinates;

      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6378137;

      const dLat = toRad(lat - officeLat);
      const dLng = toRad(lng - officeLng);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(officeLat)) *
          Math.cos(toRad(lat)) *
          Math.sin(dLng / 2) ** 2;

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceFromOffice = R * c;

      if (
        settings.enforceGeofence &&
        mode !== "admin_override" &&
        distanceFromOffice > settings.gpsRadiusMeters
      ) {
        return res.status(403).json({
          success: false,
          message: "Outside allowed location",
        });
      }
    }

    const now = moment().tz(settings.timezone);
    const date = now.clone().startOf("day").toDate();

    let attendance;

    /* ===============================
       🟢 CLOCK-IN
    =============================== */

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

      const diffMinutes = now.diff(
        moment().tz(settings.timezone).set({
          hour: 8,
          minute: 0,
        }),
        "minutes"
      );

      attendance = await AttendanceLog.create({
        userId,
        institutionId: user.institutionId,
        actionType,
        mode,
        gps: { type: "Point", coordinates: [lng, lat] },
        timestamp: now.toDate(),
        date,
        status: "present",
        minutesLate: diffMinutes > 0 ? diffMinutes : 0,
        distanceFromOffice: distanceFromOffice
          ? Math.round(distanceFromOffice)
          : null,
      });

      return res.status(201).json({
        success: true,
        message: "Clock-in successful",
        data: attendance,
      });
    }

    /* ===============================
       🔴 CLOCK-OUT
    =============================== */

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

      attendance = await AttendanceLog.create({
        userId,
        institutionId: user.institutionId,
        actionType,
        mode,
        gps: { type: "Point", coordinates: [lng, lat] },
        timestamp: now.toDate(),
        date,
        status: "completed",
        workDurationMinutes,
        distanceFromOffice: distanceFromOffice
          ? Math.round(distanceFromOffice)
          : null,
      });

      return res.status(201).json({
        success: true,
        message: "Clock-out successful",
        meta: {
          workDurationMinutes,
        },
        data: attendance,
      });
    }
  } catch (error) {
    console.error("Clock attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process attendance",
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

export const getAttendanceHistory = async (req, res) => {
  try {
    const { role, institutionId, _id: userId } = req.user;
    const {
      user,         
      dateFrom,
      dateTo,
      actionType,
      mode,
      page = 1,
      limit = 10
    } = req.query;

    // Determine whose records to fetch
    let targetUserId = userId;

    if (role === "admin" || role === "super_admin") {
      targetUserId = user || userId; // allow admin to pass userId query
    }

    // Build date range filter
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    // Build query
    const query = {
      institutionId,
      userId: targetUserId,
    };
    if (Object.keys(dateFilter).length) query.timestamp = dateFilter;
    if (actionType) query.actionType = actionType;
    if (mode) query.mode = mode;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch records
    const logs = await AttendanceLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add GPS & QR type info to each log
    const processedLogs = logs.map(log => ({
      ...log,
      gps: log.gps || { lat: null, lng: null },
      qrType: log.qrCode ? (log.mode === "qr_dynamic" ? "dynamic" : "static") : null,
      isAdminOverride: log.mode === "admin_override" ? true : false
    }));

    // Count total
    const total = await AttendanceLog.countDocuments(query);

    res.status(200).json({
      message: "Attendance history fetched successfully.",
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: processedLogs,
    });
  } catch (err) {
    console.error("Error fetching attendance history:", err);
    res.status(500).json({ message: "Server error." });
  }
};



export const syncOfflineLogs = async (req, res) => {
  try {
    const { offlineLogs } = req.body;
    const { _id: userId, institutionId, role } = req.user;

    if (!offlineLogs || !Array.isArray(offlineLogs) || offlineLogs.length === 0) {
      return res.status(400).json({ message: "No offline logs provided." });
    }

    const results = [];

    for (const log of offlineLogs) {
      const { branchId, gps, actionType, mode, timestamp, qrCode } = log;

      try {
        // Validate branch
        const branch = await Branch.findById(branchId);
        if (!branch || branch.institutionId.toString() !== institutionId.toString()) {
          results.push({ ...log, syncStatus: "rejected_on_sync", reason: "Invalid branch or institution" });
          continue;
        }

        // Validate GPS
        const toRad = (v) => (v * Math.PI) / 180;
        const R = 6371e3;
        const dLat = toRad(gps.lat - branch.gps.lat);
        const dLon = toRad(gps.lng - branch.gps.lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(branch.gps.lat)) *
          Math.cos(toRad(gps.lat)) *
          Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance > branch.gps.radius) {
          results.push({ ...log, syncStatus: "rejected_on_sync", reason: "Out of zone" });
          continue;
        }

        // Prevent duplicates
        const existing = await AttendanceLog.findOne({
          userId,
          branchId,
          actionType,
          timestamp: new Date(timestamp),
        });

        if (existing) {
          results.push({ ...log, syncStatus: "rejected_on_sync", reason: "Duplicate log" });
          continue;
        }

        // Save new synced log
        const saved = await AttendanceLog.create({
          userId,
          institutionId,
          branchId,
          actionType,
          mode: mode || "silent",
          qrCode: qrCode || null,
          qrType: qrCode ? (mode === "qr_dynamic" ? "dynamic" : "static") : null,
          gps,
          timestamp: new Date(timestamp),
          serverReceivedAt: new Date(),
          syncStatus: "synced",
          validationResult: "accepted",
          isAdminOverride: mode === "admin_override" ? true : false,
        });

        results.push({ ...log, syncStatus: "synced", _id: saved._id });
      } catch (innerErr) {
        console.error("Error syncing individual log:", innerErr);
        results.push({ ...log, syncStatus: "rejected_on_sync", reason: "Server error" });
      }
    }

    res.status(200).json({
      message: "Offline logs synchronized.",
      summary: {
        total: offlineLogs.length,
        synced: results.filter((r) => r.syncStatus === "synced").length,
        rejected: results.filter((r) => r.syncStatus === "rejected_on_sync").length,
      },
      results,
    });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ message: "Server error during sync." });
  }
};



export const getRealTimeStatus = async (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    const { branchId } = req.query;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all active users in institution (include admins, filter by branch if provided)
    const userFilter = { institutionId, isActive: true };
    if (branchId) userFilter.branchId = branchId;

    const users = await User.find(userFilter)
      .select("name role studentOrStaffId departmentOrUnit")
      .lean();

    // Fetch today's attendance logs
    const logs = await AttendanceLog.find({
      institutionId,
      actionType: "clock-in",
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("userId", "name studentOrStaffId departmentOrUnit")
      .lean();

    // Map userId -> latest clock-in log
    const logMap = new Map();
    logs.forEach(log => {
      logMap.set(String(log.userId._id), {
        status: log.status,
        qrType: log.qrType || null,
        isAdminOverride: log.mode === "admin_override" ? true : false,
        timestamp: log.timestamp,
      });
    });

    const onTime = [];
    const late = [];
    const absent = [];

    // Categorize each user
    for (const user of users) {
      const log = logMap.get(String(user._id));

      if (!log) {
        absent.push(user);
      } else if (log.status === "on-time") {
        onTime.push({ ...user, ...log });
      } else if (log.status === "late") {
        late.push({ ...user, ...log });
      } else {
        absent.push({ ...user, ...log });
      }
    }

    // Return summary
    return res.status(200).json({
      success: true,
      data: {
        summary: {
          onTime: onTime.length,
          late: late.length,
          absent: absent.length,
          total: users.length,
        },
        details: {
          onTime,
          late,
          absent,
        },
      },
    });
  } catch (error) {
    console.error("Realtime status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch real-time status.",
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

    // Fetch users & today's logs
    const totalUsers = await User.countDocuments({ institutionId, isActive: true });
    const pendingApprovals = await User.countDocuments({ institutionId, role: "pending" });

    const todaysLogs = await AttendanceLog.find({
      institutionId,
      actionType: "clock-in",
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).select("status branchId mode qrType");

    // Count on-time, late, and present (include admin_override logs)
    const onTime = todaysLogs.filter(l => l.status === "on-time" || l.mode === "admin_override").length;
    const late = todaysLogs.filter(l => l.status === "late").length;
    const present = onTime + late;
    const absent = totalUsers - present;

    // QR / Admin override counts for today
    const qrStatic = todaysLogs.filter(l => l.qrType === "static").length;
    const qrDynamic = todaysLogs.filter(l => l.qrType === "dynamic").length;
    const adminOverrides = todaysLogs.filter(l => l.mode === "admin_override").length;

    // Weekly trend with QR and admin override counts
    const today = new Date();
    const weeklyTrend = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayLogs = await AttendanceLog.find({
        institutionId,
        actionType: "clock-in",
        timestamp: { $gte: dayStart, $lte: dayEnd },
      }).select("mode qrType");

      const attendanceCount = dayLogs.length;
      const rate = totalUsers ? ((attendanceCount / totalUsers) * 100).toFixed(1) : 0;

      const dayQrStatic = dayLogs.filter(l => l.qrType === "static").length;
      const dayQrDynamic = dayLogs.filter(l => l.qrType === "dynamic").length;
      const dayAdminOverrides = dayLogs.filter(l => l.mode === "admin_override").length;

      weeklyTrend.push({
        date: dayStart.toISOString().split("T")[0],
        attendanceRate: Number(rate),
        qrStaticCount: dayQrStatic,
        qrDynamicCount: dayQrDynamic,
        adminOverrideCount: dayAdminOverrides,
      });
    }

    // Top branches (by clock-in count today) including QR/admin stats
    const topBranches = await AttendanceLog.aggregate([
      { $match: { institutionId, actionType: "clock-in", timestamp: { $gte: startOfDay, $lte: endOfDay } } },
      {
        $group: {
          _id: "$branchId",
          total: { $sum: 1 },
          qrStatic: { $sum: { $cond: [{ $eq: ["$qrType", "static"] }, 1, 0] } },
          qrDynamic: { $sum: { $cond: [{ $eq: ["$qrType", "dynamic"] }, 1, 0] } },
          adminOverrides: { $sum: { $cond: [{ $eq: ["$mode", "admin_override"] }, 1, 0] } },
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

    // Build final summary
    const summary = {
      todaySummary: {
        totalUsers,
        onTime,
        late,
        absent,
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




