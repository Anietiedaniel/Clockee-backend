import express from "express";
import { protect } from "@clockee/shared";
import {
  createShift,
  getShifts,
  assignUsersToShift,
} from "../controllers/shiftController.js";

const router = express.Router();

router.post("/shifts", protect, createShift);
router.get("/shifts", protect, getShifts);
router.patch("/shifts/:id/assign", protect, assignUsersToShift);

export default router;