import Holiday from "../models/holiday.js";

export const validateAttendanceDay = async ({
  now,
  institutionId,
  branchId,
  settings,
}) => {
  /* ================= TODAY NAME ================= */
  const todayName = now.format("ddd");

  /* ================= WORKING DAY CHECK ================= */
  if (
    !settings.workingDays.includes(todayName)
  ) {
    return {
      allowed: false,
      reason: "NON_WORKING_DAY",
      message: `${todayName} is not a scheduled working day.`,
    };
  }

  /* ================= HOLIDAY CHECK ================= */
  const holiday = await Holiday.findOne({
    institutionId,
    isActive: true,
    $or: [
      {
        date: {
          $gte: now.clone().startOf("day").toDate(),
          $lte: now.clone().endOf("day").toDate(),
        },
      },
    ],
  });

  if (
    holiday &&
    !settings.allowHolidayClocking
  ) {
    return {
      allowed: false,
      reason: "PUBLIC_HOLIDAY",
      message: `Today is a holiday: ${holiday.name}`,
    };
  }

  return {
    allowed: true,
  };
};