import mongoose from "../db/mongoose.js";

/* =========================================================
   GEOJSON GPS SCHEMA
   IMPORTANT:
   GeoJSON coordinates MUST be:
   [longitude, latitude]
   ========================================================= */

const gpsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },

    coordinates: {
      type: [Number],

      validate: {
        validator: function (value) {
          if (!value || value.length !== 2) {
            return false;
          }

          const [lng, lat] = value;

          /*
            Longitude:
            -180 to 180

            Latitude:
            -90 to 90
          */

          return (
            typeof lng === "number" &&
            typeof lat === "number" &&
            lng >= -180 &&
            lng <= 180 &&
            lat >= -90 &&
            lat <= 90
          );
        },

        message:
          "Coordinates must be valid GeoJSON [longitude, latitude]",
      },
    },
  },
  {
    _id: false,
  }
);

/* =========================================================
   ATTENDANCE LOG SCHEMA
   ========================================================= */

const attendanceLogSchema = new mongoose.Schema(
  {
    /* =====================================================
       USER
       ===================================================== */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* =====================================================
       INSTITUTION
       ===================================================== */

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    },

    /* =====================================================
       BRANCH
       ===================================================== */

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },

    /* =====================================================
       SHIFT
       ===================================================== */

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    /* =====================================================
       OFFLINE SYNC PROTECTION
       ===================================================== */

    syncId: {
      type: String,
      default: null,
      sparse: true,
      trim: true,
      index: true,
    },

    offlineCreatedAt: {
      type: Date,
      default: null,
    },

    serverReceivedAt: {
      type: Date,
      default: null,
    },

    /* =====================================================
       ACTION
       ===================================================== */

    actionType: {
      type: String,
      enum: ["clock-in", "clock-out"],
      required: true,
      index: true,
    },

    /* =====================================================
       CLOCKING MODE
       ===================================================== */

    mode: {
      type: String,
      enum: [
        "qr",
        "totp",
        "silent",
        "backup_code",
        "admin_override",
        "offline",
      ],
      required: true,
      index: true,
    },

    /* =====================================================
       CLOCKING SOURCE

       Helps analytics and Super Admin dashboard understand
       how the attendance was recorded.
       ===================================================== */

    clockingSource: {
      type: String,
      enum: [
        "onsite",
        "remote",
        "field",
        "offline",
        "admin_override",
      ],
      default: "onsite",
      index: true,
    },

    /* =====================================================
       REMOTE CLOCKING

       true  = attendance was allowed as remote
       false = normal onsite/branch attendance
       ===================================================== */

    remoteClocking: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* =====================================================
       GPS LOCATION

       GeoJSON:
       [longitude, latitude]
       ===================================================== */

    gps: {
      type: gpsSchema,
      default: null,
    },

    /* =====================================================
       ATTENDANCE TIMESTAMP

       Actual time the employee clocked in/out.
       ===================================================== */

    timestamp: {
      type: Date,
      required: true,
      index: true,
    },

    /* =====================================================
       ATTENDANCE DATE

       Start of day in institution timezone.

       Used for daily attendance grouping and duplicate
       protection.
       ===================================================== */

    date: {
      type: Date,
      required: true,
      index: true,
    },

    /* =====================================================
       DISTANCE FROM OFFICE / BRANCH

       Distance in meters.

       null means:
       - remote clocking
       - no coordinates configured
       - GPS distance was not calculated
       ===================================================== */

    distanceFromOffice: {
      type: Number,
      default: null,
      min: 0,
    },

    /* =====================================================
       GEO / SECURITY VALIDATION RESULT
       ===================================================== */

    validationResult: {
      type: String,
      enum: [
        "accepted",
        "rejected",
        "out_of_zone",
        "invalid_totp",
        "invalid_backup",
        "remote_not_allowed",
      ],
      default: "accepted",
      index: true,
    },

    /* =====================================================
       ATTENDANCE STATUS
       ===================================================== */

    status: {
      type: String,
      enum: [
        "present",
        "late",
        "absent",
      ],
      default: "present",
      index: true,
    },

    /* =====================================================
       CLOCK-IN STATUS
       ===================================================== */

    clockInStatus: {
      type: String,
      enum: [
        "too-early",
        "early",
        "on-time",
        "late",
        "very-late",
      ],
      default: "on-time",
      index: true,
    },

    /* =====================================================
       CLOCK-OUT STATUS
       ===================================================== */

    clockOutStatus: {
      type: String,
      enum: [
        "completed",
        "early_exit",
        "overtime",
      ],
      default: undefined,
      index: true,
    },

    /* =====================================================
       MINUTES LATE
       ===================================================== */

    minutesLate: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* =====================================================
       WORK DURATION
       ===================================================== */

    workDurationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* =====================================================
       PRODUCTIVITY STATUS
       ===================================================== */

    productivityStatus: {
      type: String,
      enum: [
        "normal",
        "underworked",
      ],
      default: "normal",
      index: true,
    },

    /* =====================================================
       EXPECTED FOR ATTENDANCE

       This is useful for future attendance calculations.

       Example:
       true  = user was expected to attend that day
       false = user was not expected to attend

       This helps later with accurate absence calculations.
       ===================================================== */

    expectedForAttendance: {
      type: Boolean,
      default: true,
      index: true,
    },

    /* =====================================================
       OFFLINE / ONLINE SYNC STATUS
       ===================================================== */

    syncStatus: {
      type: String,
      enum: [
        "online",
        "offline_pending",
        "synced",
        "already_synced",
        "rejected_on_sync",
      ],
      default: "online",
      index: true,
    },

    /* =====================================================
       DEVICE / NETWORK INFORMATION
       ===================================================== */

    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },

    deviceInfo: {
      type: String,
      default: null,
      trim: true,
    },

    /* =====================================================
       RECORD STATUS

       Used for soft deactivation / data correction.
       ===================================================== */

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },

  {
    timestamps: true,
  }
);

/* =========================================================
   GEO INDEX
   ========================================================= */

attendanceLogSchema.index(
  {
    gps: "2dsphere",
  },
  {
    partialFilterExpression: {
      "gps.coordinates": {
        $exists: true,
      },
    },
  }
);

/* =========================================================
   UNIQUE DAILY ATTENDANCE ACTION

   Prevents:

   Same user
   + same date
   + same action

   Example:

   User A
   2026-07-28
   clock-in

   cannot be inserted twice.
   ========================================================= */

attendanceLogSchema.index(
  {
    userId: 1,
    date: 1,
    actionType: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      isActive: true,
    },
  }
);

/* =========================================================
   OFFLINE SYNC DUPLICATE PROTECTION

   Prevents the same offline attendance event from being
   inserted multiple times during retry.
   ========================================================= */

attendanceLogSchema.index(
  {
    userId: 1,
    syncId: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      syncId: {
        $exists: true,
        $ne: null,
      },
    },
  }
);

/* =========================================================
   USER ATTENDANCE HISTORY

   Used for:

   - User attendance history
   - Latest clock-in
   - Latest clock-out
   ========================================================= */

attendanceLogSchema.index({
  userId: 1,
  timestamp: -1,
});

/* =========================================================
   INSTITUTION DAILY ATTENDANCE

   Very important for Super Admin dashboard.

   Used for:

   - Today's clock-ins
   - Today's late count
   - Daily attendance
   - Institution attendance
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  date: 1,
  actionType: 1,
});

/* =========================================================
   INSTITUTION ATTENDANCE TIMELINE

   Used for:

   - Weekly charts
   - Monthly charts
   - Attendance trends
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  timestamp: -1,
});

/* =========================================================
   INSTITUTION + USER + DATE

   Useful for checking a specific user's attendance
   within an institution.
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  userId: 1,
  date: 1,
});

/* =========================================================
   INSTITUTION + STATUS

   Useful for attendance analytics.

   Example:

   Count all late records for an institution.
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  status: 1,
  date: 1,
});

/* =========================================================
   INSTITUTION + CLOCK-IN STATUS

   Useful for:

   - On-time count
   - Late count
   - Very-late count
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  clockInStatus: 1,
  date: 1,
});

/* =========================================================
   INSTITUTION + REMOTE CLOCKING

   Useful for remote vs onsite analytics.
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  remoteClocking: 1,
  date: 1,
});

/* =========================================================
   INSTITUTION + BRANCH + DATE

   Useful for branch-level attendance dashboards.
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  branchId: 1,
  date: 1,
});

/* =========================================================
   INSTITUTION + SYNC STATUS

   Useful for monitoring offline attendance synchronization.
   ========================================================= */

attendanceLogSchema.index({
  institutionId: 1,
  syncStatus: 1,
  date: 1,
});

/* =========================================================
   MODEL
   ========================================================= */

export default mongoose.model(
  "AttendanceLog",
  attendanceLogSchema
);