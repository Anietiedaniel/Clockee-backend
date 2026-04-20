import QRCode from "qrcode";
import { Institution,  Branch, User} from "@clockee/shared";
import mongoose from "mongoose";
import crypto from "crypto";

// both admin and supper admin can do it
export const getInstitutionProfile = async (req, res) => {
  try {
    const {
      institutionId: adminInstitutionId,
      role: requesterRoles,
      userId,
    } = req.user;

    const { institutionId: targetInstitutionId } = req.query;

    /* ================= NORMALIZE ROLES ================= */

    const roles = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= RESOLVE INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "institutionId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(institutionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID",
      });
    }

    /* ================= FETCH ================= */

    const institution = await Institution.findById(institutionId)
      .select("-__v")
      .lean();

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

    /* ================= OPTIONAL: ADD OWNER FLAG ================= */

    const ownerId = institution.owner?.toString();

    const isOwner =
      ownerId && ownerId === userId.toString();

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      data: {
        ...institution,
        isOwner: !!isOwner, // useful for frontend
      },
    });

  } catch (err) {
    console.error("Error fetching institution profile:", err.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// both admin and supper admin can do it
export const createBranch = async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;

    const {
      institutionId,
      userId,
      role,
    } = req.user;

    /* ================= ROLE CHECK ================= */

    const roles = Array.isArray(role) ? role : [role];

    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to create branch",
      });
    }

    /* ================= VALIDATION ================= */

    if (!name || !address) {
      return res.status(400).json({
        success: false,
        message: "Name and address are required",
      });
    }

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be numbers",
      });
    }

    /* ================= GENERATE QR DATA ================= */

    const qrToken = crypto.randomBytes(16).toString("hex");

    const qrData = JSON.stringify({
      branchId: null, // will update after creation
      institutionId,
      token: qrToken,
    });

    const qrCodeUrl = await QRCode.toDataURL(qrData);

    /* ================= CREATE BRANCH ================= */

    const branch = await Branch.create({
      institutionId,
      name: name.trim(),
      address: address.trim(),
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      qrCodeUrl,
      qrToken, // 🔥 store token for validation later
      createdBy: userId,
    });

    /* ================= UPDATE QR WITH REAL BRANCH ID ================= */

    const updatedQrData = JSON.stringify({
      branchId: branch._id,
      institutionId,
      token: qrToken,
    });

    const updatedQrCodeUrl = await QRCode.toDataURL(updatedQrData);

    branch.qrCodeUrl = updatedQrCodeUrl;
    await branch.save();

    /* ================= RESPONSE ================= */

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: branch,
    });

  } catch (err) {
    console.error("Create branch error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create branch",
      error: err.message
    });
  }
};

// both admin and supper admin can do it
export const getBranches = async (req, res) => {
  try {
    const { institutionId } = req.user;

    const branches = await Branch.find({ institutionId })
      .select("name address latitude longitude qrCodeUrl createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json(branches);
  } catch (err) {
    console.error("Error fetching branches:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// both admin and supper admin can do it
export const updateInstitution = async (req, res) => {
  try {
    const {
      role: requesterRoles,
      institutionId: adminInstitutionId,
      userId,
    } = req.user;

    const { institutionId: targetInstitutionId, ...body } = req.body;

    /* ================= NORMALIZE ROLES ================= */

    const roles = Array.isArray(requesterRoles)
      ? requesterRoles
      : [requesterRoles];

    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    /* ================= RESOLVE INSTITUTION ================= */

    const institutionId = isSuperAdmin
      ? targetInstitutionId
      : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(institutionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institution ID",
      });
    }

    /* ================= FETCH ================= */

    const institution = await Institution.findById(institutionId);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

    /* ================= OWNER CHECK ================= */

    const ownerId = institution.owner?.toString();

    const isOwner =
      ownerId && ownerId === userId.toString();

    // 🔥 Only owner or super admin can update institution
    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Only owner can update institution",
      });
    }

    /* ================= ALLOWED FIELDS ================= */

    const allowedFields = [
      "name",
      "address",
      "email",
      "phone",
      "website",
      "logo",
    ];

    /* ================= APPLY SAFE UPDATES ================= */

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        institution[field] = body[field];
      }
    });

    /* ================= SAVE ================= */

    await institution.save();

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      message: "Institution updated successfully",
      data: institution,
    });

  } catch (err) {
    console.error("Error updating institution:", err.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// both admin and supper admin can do it
export const getDepartmentsOrUnits = async (req, res) => {
  try {
    const { institutionId } = req.user;

    const aggregation = await User.aggregate([
      {
        $match: {
          institutionId,
          role: { $in: ["staff", "student"] },
          departmentOrUnit: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$departmentOrUnit",
          totalUsers: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          totalUsers: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    res.status(200).json({
      count: aggregation.length,
      departmentsOrUnits: aggregation,
    });
  } catch (err) {
    console.error("Error fetching departments/units:", err);
    res.status(500).json({ message: "Server error" });
  }
};


