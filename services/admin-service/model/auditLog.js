import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    metadata: { type: Object },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);