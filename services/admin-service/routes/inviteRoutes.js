import express from "express";
import { protect } from "@clockee/shared";
import { authorizeAdmin, } from "../middleware/authorizeAdmin.js";
import {
  generateQrInvite,
} from "../controllers/inviteController.js";

const router = express.Router();

// GET /institution/profile
router.post(
  "/invite/qr",
  protect,
  authorizeAdmin,
  generateQrInvite
);