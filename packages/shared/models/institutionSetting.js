import mongoose from "../db/mongoose.js";
const institutionSettingSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      unique: true,
      index: true,
    },

    /* ================= WORKING DAYS ================= */

    workingDays: {
      type: [String],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },

    /* ================= TIME & ATTENDANCE ================= */

    gracePeriodMinutes: {
      type: Number,
      default: 10,
      min: 0,
    },

    clockingWindow: {
      earlyMinutes: {
        type: Number,
        default: 30,
        min: 0,
      },
      lateMinutes: {
        type: Number,
        default: 120,
        min: 0,
      },
    },

    /* ================= MAIN OFFICE LOCATION (NEW) ================= */

    officeLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },

    gpsRadiusMeters: {
      type: Number,
      default: 50,
      min: 1,
    },

    enforceGeofence: {
      type: Boolean,
      default: true,
    },

    /* ================= AUTH / MODES ================= */

    qrRefreshSeconds: {
      type: Number,
      default: 60,
      min: 10,
    },

    allowOfflineClocking: {
      type: Boolean,
      default: true,
    },

    allowRemoteClocking: {
      type: Boolean,
      default: false,
    },

    /* ================= TIMEZONE ================= */

    timezone: {
      type: String,
      default: "Africa/Lagos",
    },

    /* ================= NOTIFICATIONS ================= */

    notifications: {
      enableLateAlerts: {
        type: Boolean,
        default: true,
      },
      enableOutOfZoneAlerts: {
        type: Boolean,
        default: true,
      },
    },

    /* ================= GOVERNANCE ================= */

    hasDepartments: {
      type: Boolean,
      default: false,
    },

    enforceStaffId: {
      type: Boolean,
      default: false,
    },

    /* ================= STATUS ================= */

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

          lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      lastUpdatedAt: {
        type: Date,
      },

  },
  { timestamps: true }
);



// Geo index for MongoDB geospatial queries
institutionSettingSchema.index(
  { officeLocation: "2dsphere" },
  {
    partialFilterExpression: {
      officeLocation: { $exists: true },
    },
  }
);


export default mongoose.model(
  "InstitutionSetting",
  institutionSettingSchema
);
