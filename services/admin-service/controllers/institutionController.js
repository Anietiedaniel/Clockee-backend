import QRCode from "qrcode";
import { Institution,  Branch, User} from "@clockee/shared";




export const updateBranchLocation = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { lat, lng, radius } = req.body;
    const { institutionId } = req.user;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const branch = await Branch.findOne({
      _id: branchId,
      institutionId,
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    branch.location = {
      type: "Point",
      coordinates: [lng, lat],
    };

    if (radius) {
      branch.radiusMeters = radius;
    }

    await branch.save();

    return res.status(200).json({
      success: true,
      message: "Branch location updated successfully",
      data: branch.location,
    });

  } catch (error) {
    console.error("Update branch location error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update branch location",
    });
  }
};





// both admin and supper admin can do it
export const getInstitutionProfile = async (req, res) => {
  try {
    const { institutionId:adminInstitutionId, role:requesterRole } = req.user;
    const {institutionId:targetInstitutionId} = req.body
    
    const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    
    const institution = await Institution.findById(institutionId)
      .select("-__v")
      .lean();

      if (!institution) {
      return res.status(404).json({ message: "Institution not found" });
    }

    res.status(200).json({
      success: true,
      institution,
    });
  } catch (err) {
    console.error("Error fetching institution profile:", err);
    res.status(500).json({ message: "Server error", error:err.message });
  }
};

// both admin and supper admin can do it
export const createBranch = async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;
    const { institutionId, _id: adminId } = req.user;

    // Generate a unique QR data string
    const qrData = JSON.stringify({
      branchName: name,
      institutionId,
      timestamp: Date.now(),
    });

    // Generate QR code image
    const qrCodeUrl = await QRCode.toDataURL(qrData);

    const branch = await Branch.create({
      institutionId,
      name,
      address,
      latitude,
      longitude,
      qrCodeUrl,
      createdBy: adminId,
    });

    res.status(201).json({
      message: "Branch created successfully",
      branch,
    });
  } catch (err) {
    console.error("Error creating branch:", err);
    res.status(500).json({ message: "Server error" });
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
      role: requesterRole,
      institutionId: adminInstitutionId,
    } = req.user;

    const { institutionId: targetInstitutionId, ...updates } = req.body;

    // Decide which institution can be updated
    const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    if (!institutionId) {
      return res.status(400).json({
        message: "Institution ID is required",
      });
    }

    const institution = await Institution.findByIdAndUpdate(
      institutionId,
      updates,
      { new: true }
    );

    if (!institution) {
      return res.status(404).json({
        message: "Institution not found",
      });
    }

    res.status(200).json({
      message: "Institution updated successfully",
      institution,
    });
  } catch (err) {
    console.error("Error updating institution:", err);
    res.status(500).json({ message: "Server error" });
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


