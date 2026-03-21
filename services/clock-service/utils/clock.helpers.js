import { Branch, Shift } from "@clockee/shared";
import { getInstitutionPolicy } from "./institutionPolicy.helper.js";
import moment from "moment-timezone";

export const validateBranch = async ({ branchId, institutionId }) => {
  // Case 1: Institution has no branches (allowed)
  if (!branchId) {
    return null;
  }

  if (!institutionId) {
    throw {
      status: 400,
      message: "Institution context is required.",
    };
  }

  const branch = await Branch.findById(branchId);

  if (!branch) {
    throw {
      status: 404,
      message: "Branch not found.",
    };
  }

  // Ensure branch belongs to institution
  if (branch.institutionId.toString() !== institutionId.toString()) {
    throw {
      status: 403,
      message: "Branch does not belong to your institution.",
    };
  }

  // Optional but strongly recommended
  if (branch.isActive === false) {
    throw {
      status: 403,
      message: "This branch is currently inactive.",
    };
  }

  return branch;
};


export const checkGeofence = ({
  gps,
  branch,
  attendancePolicy,
  strict = true, // true = block, false = warn only
}) => {
  if (!attendancePolicy?.enforceGeofence) {
    return "accepted";
  }

  if (!gps || typeof gps.lat !== "number" || typeof gps.lng !== "number") {
    throw {
      status: 400,
      message: "Valid GPS location is required.",
    };
  }

  const { gpsRadius } = attendancePolicy;

  if (!gpsRadius) {
    throw {
      status: 500,
      message: "GPS radius policy misconfigured.",
    };
  }

  const referenceGps = branch?.gps;
  if (!referenceGps) {
    throw {
      status: 500,
      message: "Branch GPS coordinates not configured.",
    };
  }

  /* ================= HAVERSINE ================= */
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371e3; // meters

  const dLat = toRad(gps.lat - referenceGps.lat);
  const dLon = toRad(gps.lng - referenceGps.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(referenceGps.lat)) *
      Math.cos(toRad(gps.lat)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  /* ================= VALIDATION ================= */
  if (distance > gpsRadius) {
    if (strict) {
      throw {
        status: 400,
        message: "You are outside the permitted clock-in radius.",
        validationResult: "out_of_zone",
      };
    }

    return "out_of_zone";
  }

  return "accepted";
};




export const checkDuplicateClockIn = async ({
  userId,
  institutionId,
  branchId = null,
}) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const query = {
    userId,
    institutionId,
    actionType: "clock-in",
    timestamp: { $gte: startOfDay },
  };

  // Only filter by branch if branch exists
  if (branchId) {
    query.branchId = branchId;
  } else {
    query.branchId = null;
  }

  const existing = await AttendanceLog.findOne(query).lean();

  if (existing) {
    throw {
      status: 400,
      message: "You have already clocked in today.",
      code: "DUPLICATE_CLOCK_IN",
    };
  }

  return true;
};

// export const detectShiftAndStatus = async ({
//   userId,
//   branch,
//   policy,
// }) => {
//   let shift = null;
//   let status = "on-time";

//   // No branch = no shift logic
//   if (!branch) {
//     return { shift, status };
//   }

//   //  Find assigned shift
//   shift = await Shift.findOne({
//     assignedUsers: userId,
//     branchId: branch._id,
//   });

//   // Fallback to branch default shift
//   if (!shift && branch.defaultShiftId) {
//     shift = await Shift.findById(branch.defaultShiftId);
//   }

//   if (!shift || !shift.startTime) {
//     return { shift, status };
//   }

//   //  Time calculation (institution timezone)
//   const timezone = policy?.timezone || "UTC";
//   const now = moment().tz(timezone);

//   const [h, m] = shift.startTime.split(":").map(Number);
//   const shiftStart = moment(now)
//     .hour(h)
//     .minute(m)
//     .second(0);

//   const graceMinutes = policy?.gracePeriodMinutes ?? 0;

//   if (now.isAfter(shiftStart.add(graceMinutes, "minutes"))) {
//     status = "late";
//   }

//   return { shift, status };
// };


export const detectShiftAndStatus = async ({
  userId,
  branch,
  policy,
}) => {
  let shift = null;
  let status = "on-time";

  /* ================= NO BRANCH ================= */
  if (!branch) {
    return { shift, status };
  }

  /* ================= FIND SHIFT ================= */
  shift = await Shift.findOne({
    assignedUsers: userId,
    branchId: branch._id,
  });

  if (!shift && branch.defaultShiftId) {
    shift = await Shift.findById(branch.defaultShiftId);
  }

  if (!shift || !shift.startTime) {
    return { shift, status };
  }

  /* ================= TIME CALCULATION ================= */
  const timezone =
    typeof policy?.timezone === "string"
      ? policy.timezone
      : "UTC";

  const now = moment().tz(timezone);

  const [hour, minute] = shift.startTime.split(":").map(Number);

  // Anchor shift start to today
  const shiftStart = moment
    .tz(timezone)
    .year(now.year())
    .month(now.month())
    .date(now.date())
    .hour(hour)
    .minute(minute)
    .second(0)
    .millisecond(0);

  const graceMinutes =
    Number.isFinite(policy?.gracePeriodMinutes)
      ? policy.gracePeriodMinutes
      : 0;

  const latestOnTime = shiftStart.clone().add(graceMinutes, "minutes");

  if (now.isAfter(latestOnTime)) {
    status = "late";
  }

  return { shift, status };
};

export const resolveAttendancePolicy = ({
  institutionPolicy,
  branch,
  shift,
}) => {
  if (!institutionPolicy) {
    throw {
      status: 500,
      message: "Institution policy not found.",
    };
  }

  /* ================= GPS RADIUS ================= */
  const gpsRadius =
    Number.isFinite(institutionPolicy.gpsRadiusMeters)
      ? institutionPolicy.gpsRadiusMeters
      : Number.isFinite(branch?.gps?.radius)
      ? branch.gps.radius
      : null;

  if (!gpsRadius) {
    throw {
      status: 400,
      message: "GPS radius is not configured for this institution.",
    };
  }

  /* ================= GEOFENCE ENFORCEMENT ================= */
  const enforceGeofence = Boolean(gpsRadius);

  /* ================= GRACE PERIOD ================= */
  const gracePeriodMinutes =
    Number.isFinite(institutionPolicy.gracePeriodMinutes)
      ? institutionPolicy.gracePeriodMinutes
      : Number.isFinite(shift?.gracePeriod)
      ? shift.gracePeriod
      : 0;

  return {
    gpsRadius,
    enforceGeofence,
    gracePeriodMinutes,
  };
};



// export const calculateDistanceMeters = (from, to) => {
//   const toRad = (v) => (v * Math.PI) / 180;
//   const R = 6371e3;

//   const dLat = toRad(from.lat - to.lat);
//   const dLon = toRad(from.lng - to.lng);

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(to.lat)) *
//       Math.cos(toRad(from.lat)) *
//       Math.sin(dLon / 2) ** 2;

//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return R * c;
// };
export const validateInstitutionPolicy = async ({
  institutionId,
  branchId,
  mode,
}) => {
  const policy = await getInstitutionPolicy(institutionId);

  /* ================= BRANCH REQUIREMENT ================= */
  if (policy.hasDepartments && !branchId) {
    throw {
      status: 400,
      message: "Branch selection is required to clock in.",
    };
  }

  /* ================= OFFLINE CLOCKING ================= */
  if (mode === "offline" && !policy.allowOfflineClocking) {
    throw {
      status: 403,
      message: "Offline clocking is not allowed for this institution.",
    };
  }

  return policy;
};

