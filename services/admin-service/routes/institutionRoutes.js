import express from "express";
import { protect } from "@clockee/shared";
import { authorizeAdmin} from "../middleware/authorizeAdmin.js";
import { authorizeSuperAdmin } from "../middleware/authorizeSuperAdmin.js";
import {
  createBranch,
  getBranches,
  // getInstitution,
  updateInstitution, getInstitutionProfile,
  getDepartmentsOrUnits, updateBranch, reactivateBranch, deactivateBranch,
  assignUserToBranch,
  getBranchStaff
} from "../controllers/institutionController.js";



const router = express.Router();

// GET /institution/profile
router.get(
  "/institution/profile",
  protect,
  authorizeAdmin,
  getInstitutionProfile
);

// update institution
router.patch("/institution/:id/update",protect, authorizeAdmin, updateInstitution);

// Branch routes
router.post("/institution/branches", protect, authorizeAdmin, createBranch);
router.get("/institution/branches", protect, authorizeAdmin, getBranches);

// GET /institution/departments
router.get(
  "/institution/departments",
  protect,
  authorizeAdmin,
  getDepartmentsOrUnits
);

router.get(
  "/institution/branches/:branchId/staff",
  protect,
  authorizeAdmin,
  getBranchStaff
);

// GET /admin/institutions
router.patch(
  "/institution/branches/update/:id",
  protect,
  authorizeSuperAdmin,
  updateBranch
);

router.patch(
  "/institution/branches/:institutionId/assign-user/:id",
  protect,
  authorizeSuperAdmin,
  assignUserToBranch
);

router.patch(
  "/institution/branches/reactivate/:id",
  protect,
  authorizeSuperAdmin,
  reactivateBranch
);

router.patch(
  "/institution/branches/deactivate/:id",
  protect,
  authorizeSuperAdmin,
  deactivateBranch
);



export default router;
