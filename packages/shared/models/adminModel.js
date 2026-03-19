import mongoose from "../db/mongoose.js";
const adminActionLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    // Target of the admin action
    targetType: {
      type: String,
      enum: ["User", "Branch", "Shift", "AttendanceLog", "Institution"],
      required: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Action performed
    actionType: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "manual_clockin",
        "manual_clockout",
        "assign_shift",
        "deactivate_user",
        "activate_user",
      ],
      required: true,
    },

    // reason or note
    reason: { type: String },

    // Timestamp
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
adminActionLogSchema.index({ adminId: 1 });
adminActionLogSchema.index({ institutionId: 1 });
adminActionLogSchema.index({ targetType: 1 });
adminActionLogSchema.index({ actionType: 1 });

export default mongoose.model("AdminActionLog", adminActionLogSchema);
