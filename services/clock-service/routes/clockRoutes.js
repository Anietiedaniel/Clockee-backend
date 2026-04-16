import { protect,checkInstitutionActive } from "@clockee/shared";
import { clockAttendance,getUserWorkSchedule, getStaffDashboardOverview, getAttendanceHistory,syncOfflineLogs, adminOverrideClock, getRealTimeStatus, getDashboardSummary  } from "../controllers/clockController.js";
import express from "express";
import { isAdmin } from "../middleware/authMiddleware.js";
// import {requireCompleteProfile} from "../../auth-service/middleware/profileComplete.js"
import { checkClockInPolicy } from "../middleware/clockPolicy.js";





const router = express.Router();

router.post("/admin/override", protect, isAdmin, adminOverrideClock);

router.post("/clock", protect, checkInstitutionActive, clockAttendance);

router.get("/history", protect, getAttendanceHistory);
router.post("/sync", protect, syncOfflineLogs);
router.get("/realtime/status", protect, isAdmin, getRealTimeStatus);
router.get("/dashboard/summary", protect, isAdmin, getDashboardSummary);
router.get("/staff/summary",protect,getStaffDashboardOverview)
router.get("/shedule", protect,getUserWorkSchedule)
export default router;
