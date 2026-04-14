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
      return res.status(400).json({ success: false, message: "Invalid action type" });
    }

    if (!allowedModes.includes(mode)) {
      return res.status(400).json({ success: false, message: "Invalid clocking mode" });
    }

    if (!gps || typeof gps.lat !== "number" || typeof gps.lng !== "number") {
      return res.status(400).json({ success: false, message: "Valid GPS required" });
    }

    const { lat, lng } = gps;

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
        return res.status(403).json({ success: false, message: "Not authorized" });
      }

      if (!overrideCode || overrideCode !== process.env.ADMIN_OVERRIDE_SECRET) {
        return res.status(403).json({ success: false, message: "Invalid override code" });
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
      timezone: "Africa/Lagos",
      workStartTime: "08:00",
      workEndTime: "17:00",
      expectedWorkHours: 8,
      gracePeriodMinutes: 20,
      clockingWindow: { earlyMinutes: 20, lateMinutes: 90 },
      enforceGeofence: false,
      gpsRadiusMeters: 100,
      officeLocation: null,
      ...(institutionSetting ? institutionSetting.toObject() : {}),
    };

    /* ===============================
       GEO CHECK
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

      // ✅ USE SETTINGS TIME
      const [startHour, startMin] = settings.workStartTime.split(":").map(Number);

      const expectedStart = moment()
        .tz(settings.timezone)
        .set({
          hour: startHour,
          minute: startMin,
          second: 0,
          millisecond: 0,
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
        actionType,
        mode,
        gps: { type: "Point", coordinates: [lng, lat] },
        timestamp: now.toDate(),
        date,

        status: "present",
        clockInStatus,
        minutesLate: diffMinutes > 0 ? diffMinutes : 0,

        distanceFromOffice: distanceFromOffice
          ? Math.round(distanceFromOffice)
          : null,
      });

      return res.status(201).json({
        success: true,
        message: "Clock-in successful",
        meta: {
          clockInStatus,
          minutesLate: diffMinutes > 0 ? diffMinutes : 0,
        },
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

      /* ===== CLOCK-OUT STATUS ===== */

      let clockOutStatus = "completed";
      let expectedEnd = null;

      // SHIFT FIRST
      if (lastClockIn.shiftId) {
        const shift = await Shift.findById(lastClockIn.shiftId);
        if (shift?.endTime) {
          const [h, m] = shift.endTime.split(":").map(Number);
          expectedEnd = moment().tz(settings.timezone).set({ hour: h, minute: m });
        }
      }

      // FALLBACK
      if (!expectedEnd && settings.workEndTime) {
        const [h, m] = settings.workEndTime.split(":").map(Number);
        expectedEnd = moment().tz(settings.timezone).set({ hour: h, minute: m });
      }

      if (expectedEnd) {
        if (now.isBefore(expectedEnd)) clockOutStatus = "early_exit";
        else if (now.isAfter(expectedEnd)) clockOutStatus = "overtime";
      }

      /* ===== UNDERWORK DETECTION ===== */

      const expectedMinutes = (settings.expectedWorkHours || 8) * 60;

      let productivityStatus = "normal";

      if (workDurationMinutes < expectedMinutes * 0.5) {
        productivityStatus = "underworked";
      }

      attendance = await AttendanceLog.create({
        userId,
        institutionId: user.institutionId,
        actionType,
        mode,
        gps: { type: "Point", coordinates: [lng, lat] },
        timestamp: now.toDate(),
        date,

        clockOutStatus,
        workDurationMinutes,
        productivityStatus,

        distanceFromOffice: distanceFromOffice
          ? Math.round(distanceFromOffice)
          : null,
      });

      return res.status(201).json({
        success: true,
        message: "Clock-out successful",
        meta: {
          workDurationMinutes,
          clockOutStatus,
          productivityStatus,
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

export const getAttendanceHistory = async (req, res) => {
  try {
    const { role, institutionId, userId } = req.user;

    const {
      user,
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
       USER SCOPE CONTROL
    =============================== */

    let targetUserId = userId;

    // Admin/SuperAdmin can view other users
    if ((isAdmin || isSuperAdmin) && user) {
      const foundUser = await User.findOne({
        _id: user,
        institutionId,
      });

      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found in this institution",
        });
      }

      targetUserId = user;
    }

    /* ===============================
       BUILD QUERY
    =============================== */

    const query = {
      institutionId,
      userId: targetUserId,
    };

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    if (actionType) query.actionType = actionType;
    if (mode) query.mode = mode;

    /* ===============================
       FETCH LOGS (Sorted)
    =============================== */

    const logs = await AttendanceLog.find(query)
      .sort({ date: -1, timestamp: -1 })
      .lean();

    /* ===============================
       GROUP BY DAY
    =============================== */

    const grouped = {};

    for (const log of logs) {
      const dayKey = new Date(log.date).toISOString().split("T")[0];

      if (!grouped[dayKey]) {
        grouped[dayKey] = {
          date: dayKey,
          clockIn: null,
          clockOut: null,
        };
      }

      if (log.actionType === "clock-in") {
        grouped[dayKey].clockIn = {
          time: log.timestamp,
          status: log.clockInStatus,
          minutesLate: log.minutesLate,
          mode: log.mode,
        };
      }

      if (log.actionType === "clock-out") {
        grouped[dayKey].clockOut = {
          time: log.timestamp,
          status: log.clockOutStatus,
          workDurationMinutes: log.workDurationMinutes,
          productivityStatus: log.productivityStatus,
          mode: log.mode,
        };
      }
    }

    /* ===============================
       PAGINATION AFTER GROUPING
    =============================== */

    const groupedArray = Object.values(grouped);

    const total = groupedArray.length;
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

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
    const { _id: userId, institutionId } = req.user;

    if (!offlineLogs || !Array.isArray(offlineLogs) || offlineLogs.length === 0) {
      return res.status(400).json({ message: "No offline logs provided." });
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
           DUPLICATE CHECK (SMART)
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

    /* ================= USERS ================= */

    const userFilter = { institutionId, isActive: true };
    if (branchId) userFilter.branchId = branchId;

    const users = await User.find(userFilter)
      .select("name role studentOrStaffId departmentOrUnit")
      .lean();

    /* ================= LOGS ================= */

    const logs = await AttendanceLog.find({
      institutionId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    /* ================= MAP ================= */

    const clockInMap = new Map();
    const clockOutMap = new Map();

    logs.forEach(log => {
      const userKey = String(log.userId);

      if (log.actionType === "clock-in") {
        clockInMap.set(userKey, log);
      }

      if (log.actionType === "clock-out") {
        clockOutMap.set(userKey, log);
      }
    });

    /* ================= GROUPS ================= */

    const onTime = [];
    const late = [];
    const veryLate = [];
    const early = [];
    const absent = [];
    const notClockedOut = [];

    for (const user of users) {
      const uId = String(user._id);

      const clockIn = clockInMap.get(uId);
      const clockOut = clockOutMap.get(uId);

      if (!clockIn) {
        absent.push(user);
        continue;
      }

      const enriched = {
        ...user,
        clockInStatus: clockIn.clockInStatus,
        clockOutStatus: clockOut?.clockOutStatus || null,
        clockInTime: clockIn.timestamp,
        clockOutTime: clockOut?.timestamp || null,
      };

      // GROUPING
      switch (clockIn.clockInStatus) {
        case "on-time":
          onTime.push(enriched);
          break;
        case "late":
          late.push(enriched);
          break;
        case "very-late":
          veryLate.push(enriched);
          break;
        case "early":
          early.push(enriched);
          break;
        default:
          onTime.push(enriched);
      }

      if (clockIn && !clockOut) {
        notClockedOut.push(enriched);
      }
    }

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total: users.length,
          onTime: onTime.length,
          late: late.length,
          veryLate: veryLate.length,
          early: early.length,
          absent: absent.length,
          notClockedOut: notClockedOut.length,
        },
        details: {
          onTime,
          late,
          veryLate,
          early,
          absent,
          notClockedOut,
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

    /* ================= USERS ================= */

    const totalUsers = await User.countDocuments({
      institutionId,
      isActive: true,
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

    const onTime = todaysClockIns.filter(l => l.clockInStatus === "on-time").length;
    const early = todaysClockIns.filter(l => l.clockInStatus === "early").length;
    const late = todaysClockIns.filter(l => l.clockInStatus === "late").length;
    const veryLate = todaysClockIns.filter(l => l.clockInStatus === "very-late").length;

    const present = todaysClockIns.length;
    const absent = totalUsers - present;

    /* ================= TODAY CLOCK-OUT ================= */

    const todaysClockOuts = await AttendanceLog.find({
      institutionId,
      actionType: "clock-out",
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).select("clockOutStatus");

    const completed = todaysClockOuts.filter(l => l.clockOutStatus === "completed").length;
    const earlyExit = todaysClockOuts.filter(l => l.clockOutStatus === "early_exit").length;
    const overtime = todaysClockOuts.filter(l => l.clockOutStatus === "overtime").length;
    const underWork = todaysClockOuts.filter(l => l.clockOutStatus === "under_work").length;

    /* ================= QR + ADMIN ================= */

    const qrStatic = todaysClockIns.filter(l => l.qrType === "static").length;
    const qrDynamic = todaysClockIns.filter(l => l.qrType === "dynamic").length;
    const adminOverrides = todaysClockIns.filter(l => l.mode === "admin_override").length;

    /* ================= WEEKLY TREND ================= */

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
      const rate = totalUsers
        ? ((attendanceCount / totalUsers) * 100).toFixed(1)
        : 0;

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
            $sum: { $cond: [{ $eq: ["$qrType", "static"] }, 1, 0] },
          },
          qrDynamic: {
            $sum: { $cond: [{ $eq: ["$qrType", "dynamic"] }, 1, 0] },
          },
          adminOverrides: {
            $sum: { $cond: [{ $eq: ["$mode", "admin_override"] }, 1, 0] },
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

//  Replace multiple .find() with MongoDB aggregation pipeline (1 query instead of many)
//  Add caching (Redis)
//  Add monthly + department analytics




