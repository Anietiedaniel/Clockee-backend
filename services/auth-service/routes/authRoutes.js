
import express from "express";
import {
  registerUser,
  registerViaQrInvite,
  registerVisitor,
  loginUser,
  verifyToken,
  getProfile,
  generateBackupCodes,
  useBackupCode,
  forgotPassword,
  resetPassword,
  registerWithInvite, 
   updateProfile,
  registerViaPublicOnboardingLink,
  
  
} from "../controllers/authController.js";

import { protect, User} from "@clockee/shared";

const router = express.Router();

/* ========== AUTH ROUTES ========== */
router.get('/debug/users', async (req, res) => {
  const users = await User.find();
  res.json('route exist');
});
router.post("/register", registerUser);
router.post("/visitor/register", registerVisitor);
router.post("/login", loginUser); 
router.get("/verify-token", protect, verifyToken);
router.post("/register/invite", registerWithInvite);
// register via public invite when submit is hit
router.post(
  "/onboard/register",
  registerViaPublicOnboardingLink
);



router.post("/register/invite/:token", registerViaQrInvite);


router.get("/profile", protect, getProfile);
router.patch("/update" , protect, updateProfile);

/* ========== BACKUP CODES ========== */

router.post("/backup-codes/generate", protect, generateBackupCodes);
router.post("/backup-codes/use", useBackupCode);

/* ========== PASSWORD RESET ========== */

router.post("/forgot-password", forgotPassword);
router.patch("/reset-password/:token", resetPassword);

export default router;
