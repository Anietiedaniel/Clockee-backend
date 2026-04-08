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

router.use(protect, authorizeSuperAdmin);
router.post(
  "/register",
  createInstitutionWithOwner
);

router.post("/create/:id/admin", superCreateAdmin);
router.get("/institutions", getAllInstitutions);
router.patch("/institutions/:id/status", toggleInstitutionStatus);
router.patch("/institutions/:id/admin", assignInstitutionAdmin);
router.get("/users",protect,authorizeSuperAdmin,  getAllUsersPlatform);
router.get("/admins",protect,authorizeSuperAdmin, getAllAdminsPlatform)
router.patch(
  "/users/:id/role",
  updateUserRole
);
router.get("/onboard", adminOnboardStatus);
router.get(
  "/institution/owners",getAllInstitutionOwners
);

export default router;
