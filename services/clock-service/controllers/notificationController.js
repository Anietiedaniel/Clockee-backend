import Notification from "@clockee/shared";
// import { mailTransport } from "../utils/emailService.js";

// Create new notification (can be called internally)
export const createNotification = async (req, res) => {
  try {
    const { userId, institutionId, type, title, message, channel } = req.body;

    const notification = new Notification({
      userId,
      institutionId,
      type,
      title,
      message,
      channel,
    });

    await notification.save();

    // Send email if channel = email
    if (channel === "email") {
      await mailTransport.sendMail({
        from: `"Clockee Alerts" <${process.env.SMTP_EMAIL}>`,
        to: req.body.email,
        subject: title,
        text: message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Notification created successfully.",
      data: notification,
    });
  } catch (error) {
    console.error("Notification creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create notification.",
    });
  }
};

// Fetch notifications (for dashboard/inbox)
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications.",
    });
  }
};

// Mark as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { read: true });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification.",
    });
  }
};
