
import express from "express";
import {
  loginUser,
  logoutUser,
  verifyToken,
  generateBackupCodes,
  useBackupCode,
  forgotPassword,
  resetPassword,
  
  
  
} from "../controllers/authController.js";

import { protect, User} from "@clockee/shared";

const router = express.Router();

/* ========== AUTH ROUTES ========== */
router.get('/debug/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

router.post("/login", loginUser); 
router.post("/logout", logoutUser); 
router.get("/verify-token", protect, verifyToken);


/* ========== BACKUP CODES ========== */

router.post("/backup-codes/generate", protect, generateBackupCodes);
router.post("/backup-codes/use", useBackupCode);

/* ========== PASSWORD RESET ========== */

router.post("/forgot-password", forgotPassword);
router.patch("/reset-password/:token", resetPassword);

export default router;
