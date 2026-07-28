import express from "express";
import { protect } from "@clockee/shared";
import { authorizeSuperAdmin } from "../middleware/authorizeSuperAdmin.js";

import {
  getAllInstitutions,
  toggleInstitutionStatus,
  assignInstitutionAdmin,getAllInstitutionOwners,  getSuperAdminDashboardOverview,
  getAllUsersPlatform, updateUserRole,adminOnboardStatus,
  superCreateAdmin, createInstitutionWithOwner, getAllAdminsPlatform,
} from "../controllers/superAdminController.js";

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
      status: "ok superAdminRoute",
      service: "admin-service working",
      timestamp: new Date().toISOString(),
    })
});


router.post(
  "/register",protect, authorizeSuperAdmin,
  createInstitutionWithOwner
);

router.get(
  "/dashboard/overview",
  verifyToken,
  getSuperAdminDashboardOverview
);

router.post("/create/:id/admin",protect, authorizeSuperAdmin,  superCreateAdmin);
router.get("/institutions",protect,authorizeSuperAdmin, getAllInstitutions);
router.patch("/institutions/:id/status",protect,authorizeSuperAdmin, toggleInstitutionStatus);
router.patch("/institutions/:id/admin", protect, authorizeSuperAdmin,  assignInstitutionAdmin);
router.get("/users",protect,authorizeSuperAdmin,  getAllUsersPlatform);
router.get("/admins",protect,authorizeSuperAdmin, getAllAdminsPlatform)
router.patch(
  "/users/:id/role",protect,authorizeSuperAdmin,
  updateUserRole
);
router.get("/onboard", protect, authorizeSuperAdmin, adminOnboardStatus);
router.get(
  "/institution/owners",protect,authorizeSuperAdmin, getAllInstitutionOwners
);

export default router;
