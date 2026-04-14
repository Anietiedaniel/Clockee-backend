import { User } from "@clockee/shared";

export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-passwordHash -backupCodes");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        institutionName: user.institutionName,
        institutionType: user.institutionType,
        departmentOrUnit: user.departmentOrUnit,
        studentOrStaffId: user.studentOrStaffId,
        address: user.address,
        phone: user.phone,
        clockMode: user.clockMode,
        remoteAccess: user.remoteAccess,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

  } catch (error) {
    console.error("Error fetching profile:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    /* ================= VALIDATION ================= */

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    /* ================= GET USER ================= */

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* ================= VERIFY CURRENT PASSWORD ================= */

    const isMatch = await verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    /* ================= PREVENT REUSING SAME PASSWORD ================= */

    const isSamePassword = await verifyPassword(
      newPassword,
      user.passwordHash
    );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    /* ================= SAVE NEW PASSWORD ================= */

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const { name, phoneNumber, address } = req.body;

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (address !== undefined) updates.address = address;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-passwordHash -backupCodes");

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: user,
    });

  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
