import express from "express";
import { protect } from "@clockee/shared";
import { authorizeAdmin } from "../middleware/authorizeAdmin.js";
import { generateQrInvite } from "../controllers/inviteController.js";
import { getPendingUsers,registerViaPublicOnboardingLink, updateUserApproval, getAllUsers,createInvite, adminCreateUser,resendInvite,registerWithTokenInvite, disableInstitutionInvite, getInstitutionInvite, bulkInvite,  deactivateUser,  updateUserRemoteAccess, getUserById,
  reactivateUser, rejectUser, generatePublicOnboardingLink, 
  promoteToAdmin, demoteAdmin,getAllAdmins} from "../controllers/adminController.js";

const upload = multer({ dest: "uploads/" });
import multer from "multer";

const router = express.Router();

// GET /admin/pending-users
router.get("/:id/pending-users", protect, authorizeAdmin, getPendingUsers);

// GET users
router.get("/institution/users", protect, authorizeAdmin, getAllUsers);

// get a specific user
router.get("/institution/user/:id", protect, authorizeAdmin, getUserById);


// GET admins
router.get("/institution/admins", protect, authorizeAdmin, getAllAdmins);


router.get("/public/invite", getInstitutionInvite );

router.post("/register/public-link",protect, authorizeAdmin, generatePublicOnboardingLink)

router.post("/invite", protect, authorizeAdmin, createInvite);

router.post("/register/token-link",  registerWithTokenInvite);

router.post("/register/public",registerViaPublicOnboardingLink)

// PATCH /admin/users/:id/approval
router.patch("/users/:id/approval", protect, authorizeAdmin, updateUserApproval);


router.patch(
  "/institution/:id/invite/disable",
  protect,
  authorizeAdmin,
  disableInstitutionInvite
);

router.get(
  "/institution/invite",
  protect,
  authorizeAdmin,
  getInstitutionInvite
);

router.post(
  "/invite/qr",
  protect,
  authorizeAdmin,
  generateQrInvite
);

router.post(
  "/invites/:id/resend",
  protect,                 // ensure user is logged in
  authorizeAdmin, // only admins
  resendInvite             // controller
);

router.post(
  "/invites/bulk",
  protect,
  authorizeAdmin,
  upload.single("file"), // field name in form-data
  bulkInvite
);
router.post("/institutions/:id/staff", protect, authorizeAdmin, adminCreateUser);

router.patch(
  "/users/:id/deactivate",
  protect,
  authorizeAdmin,
  deactivateUser
);

router.patch(
  "/users/:id/reactivate",
  protect,
  authorizeAdmin,
  reactivateUser
);

router.patch(
  "/users/:id/reject",
  protect,
  authorizeAdmin,
  rejectUser
);

router.patch("/users/:id/remote-access",
   protect, authorizeAdmin, updateUserRemoteAccess);

router.patch(
  "/users/:userId/demote-admin",
  protect,
  authorizeAdmin,
  promoteToAdmin
);

router.patch(
  "/users/:userId/demote-admin",
  protect,
  authorizeAdmin,
  demoteAdmin
);


export default router;

