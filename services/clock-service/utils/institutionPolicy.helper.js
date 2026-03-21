import { InstitutionSetting } from "@clockee/shared";

export const getInstitutionPolicy = async (institutionId) => {
  const setting = await InstitutionSetting.findOne({ institutionId });

  if (!setting) {
    throw {
      status: 404,
      message: "Institution settings not configured.",
    };
  }

  if (!setting.isActive) {
    throw {
      status: 403,
      message: "Institution is currently disabled.",
    };
  }

  // No `clocking.allowClocking` in the model
  // Presence + isActive === clocking allowed

  return setting;
};




export const validateInstitutionPolicy = async ({
  institutionId,
  branchId,
  mode,
}) => {
  const policy = await InstitutionSetting.findOne({
    institutionId,
    isActive: true,
  });

  if (!policy) {
    throw {
      status: 404,
      message: "Institution policy not found or inactive.",
    };
  }

  /* ================= BRANCH REQUIREMENT ================= */
  if (policy.hasDepartments && !branchId) {
    throw {
      status: 400,
      message: "Branch selection is required to clock in.",
    };
  }

  /* ================= OFFLINE CLOCKING ================= */
  if (mode === "offline" && !policy.allowOfflineClocking) {
    throw {
      status: 403,
      message: "Offline clocking is not allowed for this institution.",
    };
  }

  return policy;
};