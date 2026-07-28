import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./services/auth-service/routes/authRoutes.js";
import adminRoutes from "./services/admin-service/routes/adminRoutes.js";
import clockRoutes from "./services/clock-service/routes/clockRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/clock", clockRoutes);

// central error handler, 404 handler, etc. go here too

export default app;