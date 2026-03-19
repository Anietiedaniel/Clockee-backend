import mongoose from "../db/mongoose.js";

const notificationSchema = new mongoose.Schema(
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

    // Type of notification
    type: {
      type: String,
      enum: [
        "success",
        "failure",
        "warning",
        "info",
        "sync",
        "admin_alert",
      ],
      required: true,
    },

    // Title and message
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // link to the related attendance log
    attendanceLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendanceLog",
    },

    // Whether the user has read the message
    isRead: { type: Boolean, default: false },

    // Delivery channel future expansion
    channel: {
      type: String,
      enum: ["in-app", "push", "email", "sms"],
      default: "in-app",
    },

    // Timestamp
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes for performance
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ institutionId: 1 });
notificationSchema.index({ type: 1 });

export default mongoose.model("Notification", notificationSchema);
