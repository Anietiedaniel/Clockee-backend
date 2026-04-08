// server.js
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import {connectDB} from "@clockee/shared";
import { startAbsentMarkingJob } from "./jobs/absentMarksJob.js";
import clockRoutes from "./routes/clockRoutes.js";
import institutionalSettingController from "./routes/institutionalSettingRoutes.js"


dotenv.config();

async function start() {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("Database connected");

    startAbsentMarkingJob(); // start job AFTER DB is ready
  } catch (err) {
    console.error("Failed to connect to DB. Exiting...");
    process.exit(1);
  }

  const app = express();

  app.use(morgan("dev"));
  app.use(express.json());
  app.use(cors());

  app.get("/", (req, res) => {
    res.send("clock-service running");
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "clock-service", timestamp: new Date() });
  });

  app.use("/clock", clockRoutes);
  app.use("/institutions", institutionalSettingController);

  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`clock service listening on port ${PORT}`);
  });
}

start();
