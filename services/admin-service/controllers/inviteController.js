import crypto from "crypto";
import {InviteToken} from "@clockee/shared";

// general qr code registration
export const generateQrInvite = async (req, res) => {
  try {
    
    const {
      institutionId: targetInstitutionId,
    } = req.body;

    const { institutionId: adminInstitutionId, userId, name, role:requesterRole} = req.user;
    
    
    const expiresInDays = 7
    // Resolve institution scope
    const institutionId =
      requesterRole === "super_admin"
        ? targetInstitutionId
        : adminInstitutionId;

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");

    // Create new invite
    const invite = await InviteToken.create({
      institutionId,
      token,
      role:requesterRole,
      creatorName:name,
      createdBy: userId,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    });

    // Build invite URL (frontend handles QR rendering)
    const inviteUrl = `${process.env.FRONTEND_URL}/register/invite/${token}`;

    res.status(201).json({
      success: true,
      inviteUrl,
      creatorName:name,
      createdBy: userId,
      institutionId,
      token,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error("QR invite error:", err);
    res.status(500).json({ message: "Failed to generate QR invite" });
  }
};