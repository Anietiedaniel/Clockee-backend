import express from "express";
import { protect } from "@clockee/shared";
import { authorizeSuperAdmin } from "../middleware/authorizeSuperAdmin.js";


import {
  getAllInstitutions,
  toggleInstitutionStatus,
  assignInstitutionAdmin,
  getAllUsersPlatform, updateUserRole,adminOnboardStatus,
  superCreateAdmin, createInstitutionWithOwner
} from "../controllers/superAdminController.js";

const router = express.Router();





export default router;
