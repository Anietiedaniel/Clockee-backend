import cron from "node-cron";
import { Shift, AttendanceLog } from "@clockee/shared";

/**
 * Auto-mark absent users who didn't clock in by shift end time
 */
export const startAbsentMarkingJob = () => {
  // Runs every hour
  cron.schedule("0 * * * *", async () => {
    console.log("Running absent marking job...");

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      // Fetch all active shifts
      const shifts = await Shift.find({ isActive: true }).populate("assignedUsers");

      for (const shift of shifts) {
        // Check if shift has ended
        const [endHour, endMin] = shift.endTime.split(":").map(Number);
        const shiftEndTime = new Date();
        shiftEndTime.setHours(endHour, endMin, 0, 0);

        if (now < shiftEndTime) continue; // Not yet ended

        for (const user of shift.assignedUsers) {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          // Check if user clocked in today
          const alreadyClocked = await AttendanceLog.findOne({
            userId: user._id,
            shiftId: shift._id,
            actionType: "clock-in",
            timestamp: { $gte: startOfDay },
          });

          if (!alreadyClocked) {
            // Create absent record
            await AttendanceLog.create({
              userId: user._id,
              institutionId: shift.institutionId,
              branchId: shift.branchId,
              shiftId: shift._id,
              actionType: "auto-mark",
              mode: "system",
              timestamp: new Date(),
              validationResult: "no_clock_in",
              status: "absent",
              syncStatus: "online",
            });

            console.log(`Marked absent: ${user.name} (${shift.name})`);
          }
        }
      }
      console.log("Absent marking job completed.");
    } catch (err) {
      console.error("Absent marking job failed:", err);
    }
  });
};
