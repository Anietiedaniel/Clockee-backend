import express from "express";
import { protect } from "@clockee/shared";
import {  isAdmin } from "../middleware/authMiddleware.js";
import {
  getInstitutionSettings,
  updateInstitutionSettings, createInstitutionSettings
} from "../controllers/institutionSettingController.js";

const router = express.Router();

router.post("/institution/:id/settings", protect, isAdmin, createInstitutionSettings)

// View current settings
router.get("/institution/:id/settings", protect, isAdmin, getInstitutionSettings);

// Update or create settings
router.patch("/institution/:id/settings", protect, isAdmin, updateInstitutionSettings);

export default router;
