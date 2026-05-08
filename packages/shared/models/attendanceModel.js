// import mongoose from "../db/mongoose.js";

// /* ================= GEOJSON ================= */

// const gpsSchema = new mongoose.Schema(
//   {
//     type: {
//       type: String,
//       enum: ["Point"],
//       default: "Point",
//     },
//     coordinates: {
//       type: [Number], // [lng, lat]
//       validate: {
//         validator: function (value) {
//           if (!value || value.length !== 2) return false;

//           const [lng, lat] = value;

//           return (
//             lat >= -90 &&
//             lat <= 90 &&
//             lng >= -180 &&
//             lng <= 180
//           );
//         },
//         message: "Coordinates must be [lng, lat]",
//       },
//     },
//   },
//   { _id: false }
// );

// /* ================= MAIN SCHEMA ================= */

// const attendanceLogSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//       index: true,
//     },

//     institutionId: {
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//       index: true,
//     },

//     branchId: {
//       type: mongoose.Schema.Types.ObjectId,
//       default: null,
//     },

//     shiftId: {
//       type: mongoose.Schema.Types.ObjectId,
//       default: null,
//     },

//     actionType: {
//       type: String,
//       enum: ["clock-in", "clock-out"],
//       required: true,
//     },

//     mode: {
//       type: String,
//       enum: ["qr", "totp", "silent", "backup_code", "admin_override"],
//       required: true,
//     },

//     gps: {
//       type: gpsSchema,
//       default: null,
//     },

//     timestamp: {
//       type: Date,
//       required: true,
//       index: true,
//     },

//     date: {
//       type: Date, // 🔥 FIXED
//       required: true,
//       index: true,
//     },

//     distanceFromOffice: {
//   type: Number, // in meters
//   default: null,
// },


//     validationResult: {
//       type: String,
//       enum: [
//         "accepted",
//         "rejected",
//         "out_of_zone",
//         "invalid_totp",
//         "invalid_backup",
//         "remote_not_allowed",
//       ],
//       default: "accepted",
//       index: true,
//     },

//     status: {
//       type: String,
//       enum: ["present", "late", "absent"],
//       default: "present",
//     },

//     clockInStatus: {
//   type: String,
//   enum: ["too-early", "early", "on-time", "late", "very-late"],
//   default: "on-time",
// },

// clockOutStatus: {
//   type: String,
//   enum: ["completed", "early_exit", "overtime"],
// },


// minutesLate: {
//   type: Number,
//   default: 0,
// },


//     syncStatus: {
//       type: String,
//       enum: ["online", "offline_pending"],
//       default: "online",
//       index: true,
//     },

//     ipAddress: String,
//     deviceInfo: String,

//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true,
//     },
//   },
//   { timestamps: true }
// );

// /* ================= INDEXES ================= */

// // Geo index
// attendanceLogSchema.index(
//   { gps: "2dsphere" },
//   { partialFilterExpression: { gps: { $exists: true } } }
// );

// // Prevent duplicate per day
// attendanceLogSchema.index(
//   { userId: 1, date: 1, actionType: 1 },
//   {
//     unique: true,
//     partialFilterExpression: { isActive: true },
//   }
// );

// // Query performance
// attendanceLogSchema.index({ userId: 1, timestamp: -1 });
// attendanceLogSchema.index({ institutionId: 1, date: 1 });

// export default mongoose.model("AttendanceLog", attendanceLogSchema);


/* =========================================================
   ATTENDANCE LOG SCHEMA (UPDATED FOR OFFLINE + ONLINE)
   ========================================================= */

import mongoose from "../db/mongoose.js";

/* ================= GEOJSON ================= */

const gpsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [lng, lat]
      validate: {
        validator: function (value) {
          if (!value || value.length !== 2) return false;

          const [lng, lat] = value;

          return (
            lat >= -180 &&
            lat <= 180 &&
            lng >= -90 &&
            lng <= 90
          );
        },
        message: "Coordinates must be [lng, lat]",
      },
    },
  },
  { _id: false }
);

/* ================= MAIN SCHEMA ================= */

const attendanceLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    /* ================= OFFLINE PROTECTION ================= */

    syncId: {
      type: String,
      default: null,
      sparse: true,
      trim: true,
    },

    offlineCreatedAt: {
      type: Date,
      default: null,
    },

    serverReceivedAt: {
      type: Date,
      default: null,
    },

    /* ================= ACTION ================= */

    actionType: {
      type: String,
      enum: ["clock-in", "clock-out"],
      required: true,
    },

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
    },

    gps: {
      type: gpsSchema,
      default: null,
    },

    timestamp: {
      type: Date, // actual attendance time
      required: true,
      index: true,
    },

    date: {
      type: Date, // startOfDay for grouping
      required: true,
      index: true,
    },

    distanceFromOffice: {
      type: Number,
      default: null,
    },

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

    status: {
      type: String,
      enum: ["present", "late", "absent"],
      default: "present",
    },

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
    },

    clockOutStatus: {
      type: String,
      enum: ["completed", "early_exit", "overtime"],
    },

    minutesLate: {
      type: Number,
      default: 0,
    },

    workDurationMinutes: {
      type: Number,
      default: 0,
    },

    productivityStatus: {
      type: String,
      enum: ["normal", "underworked"],
      default: "normal",
    },

    /* ================= SYNC ================= */

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

    ipAddress: String,
    deviceInfo: String,

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

// Geo index
attendanceLogSchema.index(
  { gps: "2dsphere" },
  {
    partialFilterExpression: {
      gps: { $exists: true },
    },
  }
);

// Prevent duplicate daily action
attendanceLogSchema.index(
  { userId: 1, date: 1, actionType: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

// Prevent duplicate sync retry
attendanceLogSchema.index(
  { userId: 1, syncId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      syncId: { $exists: true, $ne: null },
    },
  }
);

attendanceLogSchema.index({
  userId: 1,
  timestamp: -1,
});

attendanceLogSchema.index({
  institutionId: 1,
  date: 1,
});

export default mongoose.model(
  "AttendanceLog",
  attendanceLogSchema
);