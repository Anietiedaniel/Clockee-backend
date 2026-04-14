// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import morgan from "morgan";
import cors from "cors";
import {connectDB} from "@clockee/shared";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
console.log("MONGO_URI:", process.env.MONGO_URI);

const PORT = process.env.PORT || 4000;

async function start() {
  // JWT secret check
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing");
    process.exit(1);
  }



  try {
    // Connect to MongoDB first, before routes
    await connectDB(process.env.MONGO_URI);
    console.log("Database connected");
  } catch (err) {
    console.error("Failed to connect to DB. Exiting...");
    process.exit(1);
  }

  const app = express();

  app.set("trust proxy", true);

  if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  // Health routes
  app.get("/", (req, res) => res.send("working perfectly"));
  app.get("/health", (req, res) => res.json({ status: "ok", service: "auth-service" }));

  // Mount auth routes
  app.use("/auth", authRouter);
  app.use("/user", userRouter);

  // Global error handler
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  });

  app.listen(PORT, () => console.log(`Auth service listening on port ${PORT}`));
}

start();