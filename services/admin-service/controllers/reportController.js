import { User, AttendanceLog } from "@clockee/shared";
import { Parser } from "json2csv";

export const getDailyReport = async (req, res) => {
  try {
    const { branchId, date } = req.query;
    const { institutionId, role } = req.user;

    if (!["admin", "super_admin"].includes(role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Target date (default: today)
    const targetDate = date ? new Date(date) : new Date();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch users
    const userQuery = { institutionId };
    if (branchId) userQuery.branchId = branchId;

    const users = await User.find(userQuery).select(
      "_id name studentOrStaffId departmentOrUnit"
    );

    // Fetch attendance logs for the day
    const logs = await AttendanceLog.find({
      institutionId,
      branchId: branchId || { $exists: true },
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      actionType: { $in: ["clock-in", "auto-mark"] },
    }).lean();

    // Map logs by userId
    const logMap = {};
    for (const log of logs) {
      logMap[log.userId?.toString()] = log;
    }

    // Build report
    const report = users.map((user) => {
      const log = logMap[user._id.toString()];

      return {
        userId: user._id,
        name: user.name,
        studentOrStaffId: user.studentOrStaffId,
        departmentOrUnit: user.departmentOrUnit,
        status: log ? log.status : "absent",
        time: log ? log.timestamp : null,
      };
    });

    // Summary
    const summary = {
      totalUsers: report.length,
      present: report.filter((r) => r.status === "on-time").length,
      late: report.filter((r) => r.status === "late").length,
      absent: report.filter((r) => r.status === "absent").length,
    };

    res.status(200).json({
      message: "Daily report generated successfully.",
      date: startOfDay.toISOString().split("T")[0],
      summary,
      report,
    });
  } catch (err) {
    console.error("Error generating daily report:", err);
    res.status(500).json({ message: "Server error generating report." });
  }
};

export const getWeeklyReport = async (req, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;
    const { institutionId, role } = req.user;

    if (!["admin", "super_admin"].includes(role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Define date range (default: last 7 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(end.getDate() - 7));

    // Fetch users under branch/institution
    const userQuery = { institutionId };
    if (branchId) userQuery.branchId = branchId;
    const users = await User.find(userQuery).select("_id name studentOrStaffId departmentOrUnit");

    // Fetch logs in range
    const logs = await AttendanceLog.find({
      institutionId,
      branchId: branchId || { $exists: true },
      timestamp: { $gte: start, $lte: end },
      actionType: { $in: ["clock-in", "auto-mark"] },
    }).lean();

    // Group logs by user
    const userStats = {};
    for (const user of users) {
      userStats[user._id] = {
        name: user.name,
        id: user._id,
        studentOrStaffId: user.studentOrStaffId,
        departmentOrUnit: user.departmentOrUnit,
        present: 0,
        late: 0,
        absent: 0,
      };
    }

    for (const log of logs) {
      const user = userStats[log.userId?.toString()];
      if (!user) continue;

      if (log.status === "on-time") user.present++;
      else if (log.status === "late") user.late++;
      else if (log.status === "absent") user.absent++;
    }

    // For users with no logs (completely absent)
    for (const user of users) {
      const stat = userStats[user._id];
      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const totalMarked =
        stat.present + stat.late + stat.absent;

      if (totalMarked < totalDays) {
        stat.absent += totalDays - totalMarked;
      }
    }

    // Convert to array
    const report = Object.values(userStats);

    // Summary totals
    const summary = {
      totalUsers: report.length,
      totalPresent: report.reduce((sum, r) => sum + r.present, 0),
      totalLate: report.reduce((sum, r) => sum + r.late, 0),
      totalAbsent: report.reduce((sum, r) => sum + r.absent, 0),
    };

    res.status(200).json({
      message: "Weekly report generated successfully.",
      dateRange: {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      },
      summary,
      report,
    });
  } catch (err) {
    console.error("Error generating weekly report:", err);
    res.status(500).json({ message: "Server error generating report." });
  }
};

export const getMonthlyReport = async (req, res) => {
  try {
    const { branchId, month, year } = req.query;
    const { institutionId, role } = req.user;

    if (!["admin", "super_admin"].includes(role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Default: current month
    const now = new Date();
    const targetYear = year ? Number(year) : now.getFullYear();
    const targetMonth = month ? Number(month) - 1 : now.getMonth();

    const start = new Date(targetYear, targetMonth, 1);
    const end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    // Fetch users
    const userQuery = { institutionId };
    if (branchId) userQuery.branchId = branchId;

    const users = await User.find(userQuery).select(
      "_id name studentOrStaffId departmentOrUnit"
    );

    // Fetch attendance logs
    const logs = await AttendanceLog.find({
      institutionId,
      branchId: branchId || { $exists: true },
      timestamp: { $gte: start, $lte: end },
      actionType: { $in: ["clock-in", "auto-mark"] },
    }).lean();

    // Init stats
    const userStats = {};
    for (const user of users) {
      userStats[user._id] = {
        userId: user._id,
        name: user.name,
        studentOrStaffId: user.studentOrStaffId,
        departmentOrUnit: user.departmentOrUnit,
        present: 0,
        late: 0,
        absent: 0,
      };
    }

    // Process logs
    for (const log of logs) {
      const stat = userStats[log.userId?.toString()];
      if (!stat) continue;

      if (log.status === "on-time") stat.present++;
      else if (log.status === "late") stat.late++;
      else if (log.status === "absent") stat.absent++;
    }

    // Calculate absences for missing days
    const totalDaysInMonth = end.getDate();

    for (const stat of Object.values(userStats)) {
      const markedDays = stat.present + stat.late + stat.absent;
      if (markedDays < totalDaysInMonth) {
        stat.absent += totalDaysInMonth - markedDays;
      }
    }

    const report = Object.values(userStats);

    // Summary
    const summary = {
      totalUsers: report.length,
      totalPresent: report.reduce((s, r) => s + r.present, 0),
      totalLate: report.reduce((s, r) => s + r.late, 0),
      totalAbsent: report.reduce((s, r) => s + r.absent, 0),
    };

    res.status(200).json({
      message: "Monthly report generated successfully.",
      month: start.toLocaleString("default", { month: "long" }),
      year: targetYear,
      summary,
      report,
    });
  } catch (err) {
    console.error("Error generating monthly report:", err);
    res.status(500).json({ message: "Server error generating report." });
  }
};

export const exportMonthlyReportCSV = async (req, res) => {
  try {
    
    req.query.format = "csv";

    const reportData = await generateMonthlyReport(req); 
    // generateMonthlyReport is extracted from getMonthlyReport logic

    const fields = [
      "name",
      "studentOrStaffId",
      "departmentOrUnit",
      "present",
      "late",
      "absent",
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(reportData.report);

    res.header("Content-Type", "text/csv");
    res.attachment("monthly-attendance-report.csv");
    return res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ message: "Failed to export CSV" });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const { institutionId } = req.user;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const logs = await AttendanceLog.find({
      institutionId,
      timestamp: { $gte: start, $lte: end },
    }).lean();

    const summary = {
      present: 0,
      late: 0,
      absent: 0,
    };

    for (const log of logs) {
      if (log.status === "on-time") summary.present++;
      else if (log.status === "late") summary.late++;
      else if (log.status === "absent") summary.absent++;
    }

    const totalUsers = await User.countDocuments({
      institutionId,
      role: { $in: ["staff", "student"] },
      isActive: true,
    });

    res.status(200).json({
      date: start.toISOString().split("T")[0],
      totalUsers,
      ...summary,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ message: "Failed to load dashboard summary" });
  }
};

export const getAttendanceFlags = async (req, res) => {
  try {
    const { institutionId } = req.user;

    const daysBack = 7;
    const start = new Date();
    start.setDate(start.getDate() - daysBack);

    const logs = await AttendanceLog.find({
      institutionId,
      timestamp: { $gte: start },
    })
      .sort({ timestamp: -1 })
      .lean();

    const streaks = {};

    for (const log of logs) {
      const userId = log.userId?.toString();
      if (!userId) continue;

      if (!streaks[userId]) {
        streaks[userId] = { late: 0 };
      }

      if (log.status === "late") {
        streaks[userId].late += 1;
      }
    }

    const flaggedUsers = [];

    for (const [userId, stat] of Object.entries(streaks)) {
      if (stat.late >= 3) {
        const user = await User.findById(userId).select("name email");
        if (user) {
          flaggedUsers.push({
            userId,
            name: user.name,
            lateStreak: stat.late,
          });
        }
      }
    }

    res.status(200).json({
      rule: "Late 3+ times in last 7 days",
      count: flaggedUsers.length,
      users: flaggedUsers,
    });
  } catch (err) {
    console.error("Attendance flags error:", err);
    res.status(500).json({ message: "Failed to compute attendance flags" });
  }
};

