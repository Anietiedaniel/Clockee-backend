import mongoose from "../db/mongoose.js";

const gpsSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
});

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
      required: true,
    },

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
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

    // GPS coordinates
    gps: {
      type: gpsSchema,
      required: true,
    },

    // User action time
    timestamp: {
      type: Date,
      required: true,
    },

    // Server receive time
    serverReceivedAt: {
      type: Date,
      default: Date.now,
    },

    // Mode-specific fields
    qrCode: { type: String },
    qrType: {
      type: String,
      enum: ["static", "dynamic"],
    },
    qrExpiresAt: { type: Date }, // only for dynamic QR

    totp: { type: String },
    token: { type: String },
    backupCode: { type: String },

    // Sync status
    syncStatus: {
      type: String,
      enum: ["online", "offline_pending", "synced", "rejected_on_sync"],
      default: "online",
    },

    // Validation result
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

    // Attendance summary
    status: {
      type: String,
      enum: ["on-time", "late", "absent"],
      default: "on-time",
    },

    // Admin override
    adminOverrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reason: { type: String },

    ipAddress: String,
    deviceInfo: String,

    // Soft delete
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
attendanceLogSchema.index({ userId: 1, timestamp: -1 });
attendanceLogSchema.index({ branchId: 1, timestamp: -1 });
attendanceLogSchema.index({ institutionId: 1 });
attendanceLogSchema.index({ mode: 1 });
attendanceLogSchema.index({ qrType: 1 });
attendanceLogSchema.index({ syncStatus: 1 });
attendanceLogSchema.index({ validationResult: 1 });

export default mongoose.model("AttendanceLog", attendanceLogSchema);
