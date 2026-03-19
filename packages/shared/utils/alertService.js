import nodemailer from "nodemailer";


export const sendAlert = async (service, level, message, endpoint) => {
  if (process.env.ENABLE_ALERTS !== "true") return;

  const alertText =
    `[${service}] ${level.toUpperCase()} ALERT\n\n` +
    `Message: ${message}\n` +
    (endpoint ? `Endpoint: ${endpoint}\n` : "") +
    `Time: ${new Date().toLocaleString()}`;

  try {
    // === EMAIL ALERT ===
    if (process.env.ALERT_EMAIL_FROM && process.env.ALERT_EMAIL_TO) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: true,
        auth: {
          user: process.env.ALERT_EMAIL_FROM,
          pass: process.env.ALERT_EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.ALERT_EMAIL_FROM,
        to: process.env.ALERT_EMAIL_TO,
        subject: `[${service}] Error Alert`,
        text: alertText,
      });
    }

  } catch (err) {
    console.error("Alert system failed:", err.message);
  }
};
