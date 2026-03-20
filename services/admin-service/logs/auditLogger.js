
import AuditLog from "../model/auditLog.js";

export const logAdminAction = async ({
  action,
  admin,
  targetUser,
  metadata = {},
}) => {
  await AuditLog.create({
    action,
    performedBy: admin._id,
    institutionId: admin.institutionId,
    targetUserId: targetUser?._id,
    metadata,
  });
};