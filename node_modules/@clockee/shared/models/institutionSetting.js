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
    // Days staff are allowed to clock in
    workingDays: {
      type: [String],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },

    /* ================= TIME & ATTENDANCE ================= */
    // Lateness grace period (minutes)
    gracePeriodMinutes: {
      type: Number,
      default: 10,
      min: 0,
    },

    // Allowed clock-in window relative to shift time
    clockingWindow: {
      earlyMinutes: {
        type: Number,
        default: 30, // allow clock-in 30 mins before shift
        min: 0,
      },
      lateMinutes: {
        type: Number,
        default: 120, // allow clock-in up to 2hrs after shift
        min: 0,
      },
    },

    /* ================= GPS / LOCATION ================= */
    // GPS tolerance radius (meters)
    gpsRadiusMeters: {
      type: Number,
      default: 50,
      min: 1,
    },

    // Enforce geofence strictly or just record GPS
    enforceGeofence: {
      type: Boolean,
      default: true,
    },

    /* ================= AUTH / MODES ================= */
    // QR code refresh interval (seconds)
    qrRefreshSeconds: {
      type: Number,
      default: 60,
      min: 10,
    },

    // Allow clock-in when offline
    allowOfflineClocking: {
      type: Boolean,
      default: true,
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

    /* ================= GOVERNANCE FLAGS ================= */
    hasDepartments: {
      type: Boolean,
      default: false,
    },

    // Require staffId before clock-in
    enforceStaffId: {
      type: Boolean,
      default: false,
    },
    
    allowRemoteClocking: {
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
          }

  },
  { timestamps: true }
);

export default mongoose.model(
  "InstitutionSetting",
  institutionSettingSchema
);
