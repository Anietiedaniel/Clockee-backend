import express from "express";
import { protect } from "@clockee/shared";
import { authorizeSuperAdmin } from "../middleware/authorizeSuperAdmin.js";


import {
  getAllInstitutions,
  toggleInstitutionStatus,
  assignInstitutionAdmin,getAllInstitutionOwners,
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
  "/register", authorizeSuperAdmin,
  createInstitutionWithOwner
);

router.post("/create/:id/admin", authorizeSuperAdmin,  superCreateAdmin);
router.get("/institutions",authorizeSuperAdmin, getAllInstitutions);
router.patch("/institutions/:id/status",authorizeSuperAdmin, toggleInstitutionStatus);
router.patch("/institutions/:id/admin", authorizeSuperAdmin,  assignInstitutionAdmin);
router.get("/users",protect,authorizeSuperAdmin,  getAllUsersPlatform);
router.get("/admins",protect,authorizeSuperAdmin, getAllAdminsPlatform)
router.patch(
  "/users/:id/role",authorizeSuperAdmin,
  updateUserRole
);
router.get("/onboard", authorizeSuperAdmin, adminOnboardStatus);
router.get(
  "/institution/owners",authorizeSuperAdmin, getAllInstitutionOwners
);

export default router;
