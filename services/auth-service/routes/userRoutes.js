import express from "express";
import {
  getMyProfile,
  updateMyProfile,
  changePassword,
} from "../controllers/userController.js";

import { protect} from "@clockee/shared";


const router = express.Router();

router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateMyProfile);
router.post("/change-password", protect, changePassword);

export default router;
