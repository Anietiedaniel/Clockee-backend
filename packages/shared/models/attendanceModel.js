import mongoose from "../db/mongoose.js";

const gpsSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
  },
  { _id: false } // prevents extra _id for subdocument
);

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

    // OPTIONAL (supports remote companies)
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    // OPTIONAL (policy decides if required)
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },

    // "clock-in" or "clock-out"
    actionType: {
      type: String,
      enum: ["clock-in", "clock-out"],
      required: true,
    },

    // Clock-in mode
    mode: {
      type: String,
      enum: ["qr", "totp", "silent", "backup_code", "admin_override"],
      required: true,
    },

    // OPTIONAL (policy decides)
    gps: {
      type: gpsSchema,
      default: null,
    },

    // User action time (source of truth)
    timestamp: {
      type: Date,
      required: true,
    },

    // Normalized date (for queries & indexing)
    date: {
      type: String,
      required: true,
      index: true,
    },

    // Server receive time
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
      ],
      default: "accepted",
    },

    /* ================= ATTENDANCE STATUS ================= */

    status: {
      type: String,
      enum: ["on-time", "late", "absent", "present"],
      default: "present", // 🔥 FIXED
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


// ================= INDEXES =================

// Fast user history lookup
attendanceLogSchema.index({ userId: 1, timestamp: -1 });

// Branch-based queries (optional branch)
attendanceLogSchema.index({ branchId: 1, timestamp: -1 });

// Institution filtering
attendanceLogSchema.index({ institutionId: 1 });

// Mode filtering
attendanceLogSchema.index({ mode: 1 });

// QR type filtering
attendanceLogSchema.index({ qrType: 1 });

// Sync tracking
attendanceLogSchema.index({ syncStatus: 1 });

// Validation tracking
attendanceLogSchema.index({ validationResult: 1 });

// Soft delete filtering
attendanceLogSchema.index({ isActive: 1 });

// 🔥 IMPORTANT: daily queries
attendanceLogSchema.index({ userId: 1, date: 1 });

// 🔥 CRITICAL: prevent duplicate clock-in/out
attendanceLogSchema.index(
  { userId: 1, date: 1, actionType: 1 },
  { unique: true }
);

export default mongoose.model("AttendanceLog", attendanceLogSchema);
