import express from "express";
import { protect } from "@clockee/shared";
import { authorizeAdmin } from "../middleware/authorizeAdmin.js";

import {
  createHoliday,
  getHolidays,
  updateHoliday,
  deactivateHoliday,
} from "../controllers/holidaysController.js";

const router = express.Router();

/* ================= HOLIDAYS ================= */

// POST /admin/holidays
router.post(
  "/holidays",
  protect,
  authorizeAdmin,
  createHoliday
);

// GET /admin/holidays
router.get(
  "/holidays",
  protect,
  authorizeAdmin,
  getHolidays
);

// PATCH /admin/holidays/:id
router.patch(
  "/holidays/:id",
  protect,
  authorizeAdmin,
  updateHoliday
);

// DELETE /admin/holidays/:id
router.delete(
  "/holidays/:id",
  protect,
  authorizeAdmin,
  deactivateHoliday
);

export default router;