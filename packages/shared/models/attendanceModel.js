import mongoose from "../db/mongoose.js";

/* ================= GEOJSON GPS SCHEMA ================= */

const gpsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true,
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: function (value) {
          if (!value || value.length !== 2) return false;

          const [lng, lat] = value;

          if (lat < -90 || lat > 90) return false;
          if (lng < -180 || lng > 180) return false;

          return true;
        },
        message: "Coordinates must be [lng, lat] within valid range",
      },
    },
  },
  { _id: false }
);

/* ================= MAIN ATTENDANCE SCHEMA ================= */

const attendanceLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
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
      enum: ["qr", "totp", "silent", "backup_code", "admin_override"],
      required: true,
    },

    /* ================= GPS (ALWAYS REQUIRED) ================= */

    gps: {
      type: gpsSchema,
      required: true,
    },

    /* ================= TIME ================= */

    timestamp: {
      type: Date,
      required: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },

    serverReceivedAt: {
      type: Date,
      default: Date.now,
    },

    /* ================= MODE-SPECIFIC FIELDS ================= */

    qrCode: { type: String },

    qrType: {
      type: String,
      enum: ["static", "dynamic"],
    },

    qrExpiresAt: { type: Date },

    totp: { type: String },

    token: { type: String },

    backupCode: { type: String },

    /* ================= SYSTEM STATUS ================= */

    syncStatus: {
      type: String,
      enum: ["online", "offline_pending", "synced", "rejected_on_sync"],
      default: "online",
    },

    validationResult: {
      type: String,
      enum: [
        "accepted",
        "rejected",
        "out_of_zone",
        "qr_expired",
        "invalid_totp",
        "invalid_backup",
        "remote_not_allowed",
      ],
      default: "accepted",
    },

    /* ================= ATTENDANCE STATUS ================= */

    status: {
      type: String,
      enum: ["on-time", "late", "absent", "present"],
      default: "present",
    },

    /* ================= ADMIN CONTROL ================= */

    adminOverrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reason: { type: String },

    /* ================= META ================= */

    ipAddress: String,
    deviceInfo: String,

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

// 🔥 GEO INDEX (VERY IMPORTANT)
attendanceLogSchema.index({ gps: "2dsphere" });

// User history
attendanceLogSchema.index({ userId: 1, timestamp: -1 });

// Branch queries
attendanceLogSchema.index({ branchId: 1, timestamp: -1 });

// Institution filter
attendanceLogSchema.index({ institutionId: 1 });

// Mode filtering
attendanceLogSchema.index({ mode: 1 });

// QR filtering
attendanceLogSchema.index({ qrType: 1 });

// Sync tracking
attendanceLogSchema.index({ syncStatus: 1 });

// Validation tracking
attendanceLogSchema.index({ validationResult: 1 });

// Soft delete
attendanceLogSchema.index({ isActive: 1 });

// Daily queries
attendanceLogSchema.index({ userId: 1, date: 1 });

// 🚨 CRITICAL: prevent duplicate clock-in/out per day
attendanceLogSchema.index(
  { userId: 1, date: 1, actionType: 1 },
  { unique: true }
);

export default mongoose.model("AttendanceLog", attendanceLogSchema);