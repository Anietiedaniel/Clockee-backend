import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

import {connectDB} from "@clockee/shared";
import institutionRoutes from "./routes/institutionRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

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


 
app.use("/admin", superAdminRoutes);
app.use("/admin", institutionRoutes);
app.use("/admin", shiftRoutes);
app.use("/admin", reportRoutes);
app.use("/admin", adminRoutes);

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
    console.error("Unhandled Error:", err);
    res.status(err.status || 500).json({
      success: false,
      message:
        NODE_ENV === "production" ? "Internal server error" : err.message,
      ...(NODE_ENV !== "production" && { stack: err.stack }),
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