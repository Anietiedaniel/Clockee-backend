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
    
    /* ================= WORK SCHEDULE ================= */

workStartTime: {
  type: String, // "08:00"
  default: "08:00",
},

workEndTime: {
  type: String, // "17:00"
  default: "17:00",
},

expectedWorkHours: {
  type: Number, 
  default: 8,
},


    /* ================= MAIN OFFICE LOCATION ================= */

    officeLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        validate: {
          validator: function (value) {
            return !value || value.length === 2;
          },
          message: "Coordinates must be [lng, lat]",
        },
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

    useBranches: {
      type: Boolean,
      default: false,
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

    /* ================= HOLIDAY POLICY ================= */

    allowHolidayClocking: {
      type: Boolean,
      default: false,
    },
    
    holidayAppliesToBranches: {
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

/* ================= GEO INDEX ================= */

institutionSettingSchema.index(
  { officeLocation: "2dsphere" },
  {
    partialFilterExpression: {
      "officeLocation.coordinates": { $exists: true },
    },
  }
);

/* ================= GEO SAFETY VALIDATION ================= */

institutionSettingSchema.pre("validate", function (next) {
  if (this.officeLocation?.coordinates?.length === 2) {
    const [lng, lat] = this.officeLocation.coordinates;

    if (lat < -90 || lat > 90) {
      return next(new Error("Latitude must be between -90 and 90"));
    }

    if (lng < -180 || lng > 180) {
      return next(new Error("Longitude must be between -180 and 180"));
    }
  }

  next();
});

export default mongoose.model(
  "InstitutionSetting",
  institutionSettingSchema
);