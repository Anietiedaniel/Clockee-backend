import mongoose from "mongoose";
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

    const userId = req.user.id;

    const userRoles = Array.isArray(req.user.role)
      ? req.user.role
      : [req.user.role];

    /* ===============================
       1️⃣ BASIC VALIDATION
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
       2️⃣ GPS VALIDATION (EARLY)
    =============================== */

    if (!gps || typeof gps.lat !== "number" || typeof gps.lng !== "number") {
      return res.status(400).json({
        success: false,
        message: "Valid GPS location is required",
      });
    }

    const { lat, lng } = gps;

    if (
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid GPS coordinates",
      });
    }

    /* ===============================
       3️⃣ MODE-SPECIFIC VALIDATION
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
       4️⃣ ADMIN OVERRIDE SECURITY
    =============================== */

    const isAdmin =
      userRoles.includes("admin") || userRoles.includes("super_admin");

    if (mode === "admin_override") {
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Not authorized for admin override",
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
       5️⃣ FETCH USER
    =============================== */

    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    /* ===============================
       6️⃣ SETTINGS
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
      ...(institutionSetting ? institutionSetting.toObject() : {}),
    };

    /* ===============================
       7️⃣ REMOTE POLICY
    =============================== */

    const REMOTE_TYPES = ["remote", "hybrid", "field"];
    const isRemoteUser = REMOTE_TYPES.includes(user.clockMode);

    const userAllowsRemote = user.remoteAccess?.allowed === true;

    if (isRemoteUser && (!settings.allowRemoteClocking || !userAllowsRemote)) {
      return res.status(403).json({
        success: false,
        message: "Remote clocking not permitted",
      });
    }

    /* ===============================
       8️⃣ GEOFENCE VALIDATION
    =============================== */

    if (
      !isRemoteUser &&
      settings.enforceGeofence &&
      settings.officeLocation?.coordinates?.length === 2 &&
      mode !== "admin_override"
    ) {
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
      const distance = R * c;

      if (distance > settings.gpsRadiusMeters) {
        return res.status(403).json({
          success: false,
          message: "Outside allowed location",
        });
      }
    }

    /* ===============================
       9️⃣ DATE NORMALIZATION
    =============================== */

    const now = new Date();

    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    /* ===============================
       🔟 SAVE (DB handles duplicates)
    =============================== */

    const attendance = await AttendanceLog.create({
      userId,
      institutionId: user.institutionId,

      actionType,
      mode,

      gps: {
        type: "Point",
        coordinates: [lng, lat],
      },

      timestamp: now,
      date,

      validationResult: "accepted",
      status: "present",

      ipAddress: req.ip,
      deviceInfo: req.headers["user-agent"],

      ...(mode === "admin_override" && {
        adminOverrideBy: userId,
        overrideReason: "Admin override",
      }),

      ...(mode === "qr" && { qrCode }),
      ...(mode === "totp" && { totp }),
      ...(mode === "silent" && { token }),
      ...(mode === "backup_code" && { backupCode }),
    });

    return res.status(201).json({
      success: true,
      message: `${actionType} successful`,
      data: attendance,
    });

  } catch (error) {
    console.error("Clock attendance error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You already performed this action today",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to process attendance",
    });
  }
};


export const clockIn = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { branchId, gps, mode, qrCode, totp, token, backupCode } = req.body;
    const { userId, institutionId } = req.user;

    const now = new Date();


    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    /* ================= MODE VALIDATION ================= */

    const allowedModes = ["qr", "totp", "silent", "backup_code"];

    if (!allowedModes.includes(mode)) {
      throw { status: 400, message: "Invalid clock-in mode" };
    }

    if (mode === "qr" && !qrCode)
      throw { status: 400, message: "QR code is required" };

    if (mode === "totp" && !totp)
      throw { status: 400, message: "TOTP is required" };

    if (mode === "silent" && !token)
      throw { status: 400, message: "Token is required" };

    if (mode === "backup_code" && !backupCode)
      throw { status: 400, message: "Backup code is required" };

    /* ================= LOAD USER ================= */

    const user = await User.findById(userId).select("clockMode");

    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    /* ================= POLICY ================= */

    const policy = await validateInstitutionPolicy({
      institutionId,
      branchId: branchId || null,
      mode,
    });

    if (!policy) {
      throw { status: 400, message: "No policy configured" };
    }

    /* REMOTE ACCESS CONTROL CRITICAL */

    const REMOTE_MODES = ["totp", "silent", "backup_code"];
    const REMOTE_ALLOWED = ["remote", "hybrid", "field"];

    const isRemoteAttempt = REMOTE_MODES.includes(mode);

    if (isRemoteAttempt) {
      // Company-level restriction
      if (!policy.allowRemoteClocking) {
        throw {
          status: 403,
          message: "Remote clocking is disabled for this company",
        };
      }

      // User-level restriction
      if (!REMOTE_ALLOWED.includes(user.clockMode)) {
        throw {
          status: 403,
          message: "You are not allowed to clock in remotely",
        };
      }
    }

    /* ================= BRANCH (OPTIONAL) ================= */

    let branch = null;

    if (branchId) {
      branch = await validateBranch({
        branchId,
        institutionId,
      });
    }

    /* ================= DUPLICATE CHECK ================= */

    await checkDuplicateClockIn({
      userId,
      date,
      actionType: "clock-in",
    });

    /* ================= SHIFT (OPTIONAL) ================= */

    let shift = null;
    let status = "present";

    if (policy.requiresShift) {
      const result = await detectShiftAndStatus({
        userId,
        branch,
        policy,
      });

      shift = result.shift;
      status = result.status;

      if (!shift) {
        throw { status: 400, message: "No shift assigned" };
      }
    }

    /* ================= GEOFENCE (OPTIONAL) ================= */

    let validationResult = "accepted";

    if (policy.requiresGeofence) {
      if (!gps) {
        throw { status: 400, message: "GPS is required by policy" };
      }

      const geo = await checkGeofence({
        gps,
        branch,
        policy,
        strict: true,
      });

      validationResult = geo;
    }

    /* ================= START TRANSACTION ================= */

    session.startTransaction();

    /* ================= BUILD PAYLOAD ================= */

    const attendancePayload = {
      userId,
      institutionId,
      branchId: branch?._id || null,
      shiftId: policy.requiresShift ? shift._id : null,

      actionType: "clock-in",
      mode,

      gps: gps || null,

      timestamp: now,
      date,

      validationResult,
      status,

      syncStatus: "online",
    };

    // mode-specific fields
    if (mode === "qr") attendancePayload.qrCode = qrCode;
    if (mode === "totp") attendancePayload.totp = totp;
    if (mode === "silent") attendancePayload.token = token;
    if (mode === "backup_code") attendancePayload.backupCode = backupCode;

    /* ================= CREATE ATTENDANCE ================= */

    const [attendance] = await AttendanceLog.create(
      [attendancePayload],
      { session }
    );

    /* ================= OPTIONAL METRICS ================= */

    if (branch) {
      await Branch.findByIdAndUpdate(
        branch._id,
        { $inc: { totalAttendanceLogs: 1 } },
        { session }
      );
    }

    /* ================= COMMIT ================= */

    await session.commitTransaction();
    session.endSession();

    /* ================= RESPONSE ================= */

    return res.status(201).json({
      success: true,
      message: `Clock-in successful (${status})`,
      data: attendance,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already clocked in today",
      });
    }

    console.error("Clock-in error:", {
      message: err.message,
      userId: req.user?.userId,
      branchId: req.body?.branchId,
      mode: req.body?.mode,
    });

    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Server error during clock-in.",
    });
  }
};



export const clockOut = async (req, res) => {
  try {
    const { branchId, gps, mode, timestamp } = req.body;
    const { userId, role, institutionId } = req.user;

    /* ================= ROLE VALIDATION ================= */
    if (!["staff", "student", "admin"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only staff, students, or admins can clock out.",
      });
    }

    /* ================= INSTITUTION POLICY ================= */
    const policy = await InstitutionSetting.findOne({
      institutionId,
      isActive: true,
    });

    if (!policy) {
      return res.status(403).json({
        success: false,
        message: "Institution is inactive or not configured.",
      });
    }

    /* ================= GPS REQUIRED ================= */
    if (!gps) {
      return res.status(400).json({
        success: false,
        message: "GPS location is required to clock out.",
      });
    }

    /* ================= BRANCH (OPTIONAL) ================= */
    let branch = null;

    if (policy.hasBranches) {
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: "Branch selection is required to clock out.",
        });
      }

      branch = await Branch.findById(branchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Branch not found.",
        });
      }

      if (branch.institutionId.toString() !== institutionId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Branch does not belong to your institution.",
        });
      }

      /* ================= GEOFENCE CHECK ================= */
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
        return res.status(400).json({
          success: false,
          message: "You are outside the permitted clock-out radius.",
          validationResult: "out_of_zone",
        });
      }
    }

    /* ================= CLOCK-IN CHECK ================= */
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const lastClockIn = await AttendanceLog.findOne({
      userId,
      institutionId,
      actionType: "clock-in",
      timestamp: { $gte: startOfDay },
    }).sort({ timestamp: -1 });

    if (!lastClockIn) {
      return res.status(400).json({
        success: false,
        message: "No clock-in found for today.",
      });
    }

    const existingClockOut = await AttendanceLog.findOne({
      userId,
      institutionId,
      actionType: "clock-out",
      timestamp: { $gte: startOfDay },
    });

    if (existingClockOut) {
      return res.status(400).json({
        success: false,
        message: "You have already clocked out today.",
      });
    }

    /* ================= SHIFT STATUS ================= */
    let status = "completed";

    if (lastClockIn.shiftId) {
      const shift = await Shift.findById(lastClockIn.shiftId);

      if (shift) {
        const currentTime = new Date(timestamp || Date.now());
        const [endHour, endMin] = shift.endTime.split(":").map(Number);

        const shiftEnd = new Date();
        shiftEnd.setHours(endHour, endMin, 0, 0);

        if (currentTime < shiftEnd) status = "early_exit";
        if (currentTime > shiftEnd) status = "overtime";
      }
    }

    /* ================= SAVE CLOCK-OUT ================= */
    const attendanceOut = await AttendanceLog.create({
      userId,
      institutionId,
      branchId: branch?._id || null,
      shiftId: lastClockIn.shiftId || null,
      actionType: "clock-out",
      mode: mode || "silent",
      gps,
      timestamp: new Date(),
      validationResult: "accepted",
      status,
      syncStatus: "online",
    });

    if (branch) {
      await Branch.findByIdAndUpdate(branch._id, {
        $inc: { totalAttendanceLogs: 1 },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Clock-out recorded successfully.",
      data: attendanceOut,
    });
  } catch (error) {
    console.error("Clock-out error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during clock-out.",
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




