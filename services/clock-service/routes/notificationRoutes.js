import express from "express";
import { protect } from "@clockee/shared";
// import {  isAdmin } from "../middleware/authMiddleware.js";
import {createNotification,getUserNotifications,markAsRead} from "../controllers/notificationController.js";

const router = express.Router();

// accessible via internal service calls or admin API
router.post("/notifications", createNotification);

// user endpoints
router.get("/notifications", protect, getUserNotifications);
router.patch("/notifications/:id/read", protect, markAsRead);

export default router;
