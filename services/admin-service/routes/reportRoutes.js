import express from "express";
import { protect } from "@clockee/shared";
import { authorizeAdmin } from "../middleware/authorizeAdmin.js";
import { getWeeklyReport,getDailyReport, getMonthlyReport,exportMonthlyReportCSV,getDashboardSummary, getAttendanceFlags } from "../controllers/reportController.js";

const router = express.Router();
router.get(
  "/reports/daily",
  protect,
  authorizeAdmin,
  getDailyReport
);

router.get("/reports/weekly", protect, authorizeAdmin, getWeeklyReport);

router.get(
  "/reports/monthly",
  protect,
  authorizeAdmin,
  getMonthlyReport
);

router.get(
  "/reports/monthly/export",
  protect,
  authorizeAdmin,
  exportMonthlyReportCSV
);

router.get(
  "/dashboard/summary",
  protect,
  authorizeAdmin,
  getDashboardSummary
);

router.get(
  "/attendance/flags",
  protect,
  authorizeAdmin,
  getAttendanceFlags
);


export default router;