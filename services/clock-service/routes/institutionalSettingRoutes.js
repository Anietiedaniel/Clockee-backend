import express from "express";
import { protect } from "@clockee/shared";
import {  isAdmin } from "../middleware/authMiddleware.js";
import {
  getInstitutionSettings,
  updateInstitutionSetting,  updateOfficeLocation
} from "../controllers/institutionSettingController.js";

const router = express.Router();

// View current settings
router.get("/:id/setting", protect, isAdmin, getInstitutionSettings);

// Update or create settings
router.patch("/:id/setting", protect, isAdmin, updateInstitutionSetting);


router.patch("/:id/location", protect, isAdmin, updateOfficeLocation);
export default router;
