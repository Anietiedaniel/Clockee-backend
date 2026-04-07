import { protect,checkInstitutionActive } from "@clockee/shared";
import { clockIn, clockOut, getAttendanceHistory,syncOfflineLogs, adminOverrideClock, getRealTimeStatus, getDashboardSummary  } from "../controllers/clockController.js";
import express from "express";
import { isAdmin } from "../middleware/authMiddleware.js";
// import {requireCompleteProfile} from "../../auth-service/middleware/profileComplete.js"
import { checkClockInPolicy } from "../middleware/clockPolicy.js";





const router = express.Router();

router.post("/admin/override", protect, isAdmin, adminOverrideClock);
// router.post("/in", protect, checkInstitutionActive,requireCompleteProfile,checkClockInPolicy, clockIn);

router.post("/in", protect, checkInstitutionActive, clockIn);
router.post("/out", protect, checkClockInPolicy, clockOut);
router.get("/history", protect, getAttendanceHistory);
router.post("/sync", protect, syncOfflineLogs);
router.get("/realtime/status", protect, isAdmin, getRealTimeStatus);
router.get("/dashboard/summary", protect, isAdmin, getDashboardSummary);

export default router;
