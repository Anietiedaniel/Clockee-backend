import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.ALERT_EMAIL_FROM, // ✅ updated
    pass: process.env.ALERT_EMAIL_PASS?.replace(/\s+/g, ""), // ✅ remove spaces automatically
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// 🔍 Verify connection once (optional but recommended)
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP ERROR:", error);
  } else {
    console.log("✅ SMTP server is ready");
  }
});

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Clockee" <${process.env.ALERT_EMAIL_FROM}>`, // ✅ updated
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.response);
    return info;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    throw err;
  }
};
