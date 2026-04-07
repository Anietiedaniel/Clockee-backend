import express from "express";
import { protect } from "@clockee/shared";
import { authorizeAdmin} from "../middleware/authorizeAdmin.js";
import { authorizeSuperAdmin } from "../middleware/authorizeSuperAdmin.js";
import {
  createBranch,
  getBranches,
  // getInstitution,
  updateInstitution, getInstitutionProfile,
  getDepartmentsOrUnits, updateRemotePolicy
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

// GET /admin/institutions
router.get(
  "/institutions",
  protect,
  authorizeSuperAdmin,

);



export default router;
