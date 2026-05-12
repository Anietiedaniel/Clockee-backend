import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { sendEmail } from "../email-service/emailService.js";

import {connectDB} from "@clockee/shared";
import adminRoutes from "./routes/adminRoutes.js";
import institutionRoutes from "./routes/institutionRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";

import cron from "node-cron";
import fetch from "node-fetch"; // if not available natively



// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4001;
const NODE_ENV = process.env.NODE_ENV || "development";

// Validate required env vars
if (!process.env.MONGO_URI) {
  console.error("Missing required env variable: MONGO_URI");
  process.exit(1);
}

async function start() {
  //  Connect to MongoDB before creating app
  await connectDB(process.env.MONGO_URI);

  const URL = "https://clockee-admin.onrender.com/health"; // create this route

cron.schedule("*/10 * * * *", async () => {
  try {
    const res = await fetch(URL);
    console.log("Ping success:", res.status);
  } catch (err) {
    console.error("Ping failed:", err.message);
  }
});

  //  Create Express app
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "10kb" }));

  if (NODE_ENV === "development") app.use(morgan("dev"));

  // Health checks
  app.get("/", (req, res) => res.send("Admin service running"));
  app.get("/health", (req, res) =>
    res.json({
      status: "ok",
      service: "admin-service running",
      timestamp: new Date().toISOString(),
    })
  );

  app.get("/debug-env", (req, res) => {
  res.json({
    EMAIL: process.env.ALERT_EMAIL_FROM,
    PASS_EXISTS: !!process.env.ALERT_EMAIL_PASS,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
  });
});

app.get("/test-email", async (req, res) => {
  try {
    const result = await sendEmail({
      to: "cieosinstitute@gmail.com",
      subject: "Test Email",
      html: "<h1>Test</h1>",
    });

    res.json({ success: true, result });
  } catch (err) {
    res.json({
      success: false,
      error: err.message,
      stack: err.stack, // 👈 add this temporarily
    });
  }
});


 

app.use("/admin", institutionRoutes);
app.use("/admin", superAdminRoutes);
app.use("/admin", shiftRoutes);
app.use("/admin", reportRoutes);
app.use("/admin", adminRoutes);
app.use("/admin", holidayRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      path: req.originalUrl,
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
  console.error(" ERROR:", err); // important

  res.status(err.status || 500).json({
    success: false,
    message: err.message,   // show real error
    stack: err.stack       // TEMPORARY
  });
});
  // Start server
  app.listen(PORT, () =>
    console.log(`🚀 Admin service running on port ${PORT} (${NODE_ENV})`)
  );
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

start();