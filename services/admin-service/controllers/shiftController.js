import { Shift, Branch } from "@clockee/shared";

export const createShift = async (req, res) => {
  try {
    const { name, startTime, endTime, gracePeriod, branchId, repeatDays } = req.body;
    const { institutionId, role } = req.user;

    if (role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const branch = await Branch.findById(branchId);
    if (!branch || branch.institutionId.toString() !== institutionId.toString()) {
      return res.status(400).json({ message: "Invalid branch." });
    }

    const newShift = await Shift.create({
      institutionId,
      branchId,
      name,
      startTime,
      endTime,
      gracePeriod,
      repeatDays,
    });

    res.status(201).json({
      message: "Shift created successfully.",
      data: newShift,
    });
  } catch (err) {
    console.error("Error creating shift:", err);
    res.status(500).json({ message: "Server error creating shift." });
  }
};

export const getShifts = async (req, res) => {
  try {
    const { branchId } = req.query;
    const { institutionId, role } = req.user;

    if (role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const query = { institutionId };
    if (branchId) query.branchId = branchId;

    const shifts = await Shift.find(query).populate("assignedUsers", "name role").lean();

    res.status(200).json({
      message: "Shifts retrieved successfully.",
      total: shifts.length,
      data: shifts,
    });
  } catch (err) {
    console.error("Error fetching shifts:", err);
    res.status(500).json({ message: "Server error fetching shifts." });
  }
};

export const assignUsersToShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    const { institutionId, role } = req.user;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "No users provided." });
    }

    if (role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const shift = await Shift.findById(id);
    if (!shift || shift.institutionId.toString() !== institutionId.toString()) {
      return res.status(404).json({ message: "Shift not found or unauthorized." });
    }

    shift.assignedUsers = [...new Set([...shift.assignedUsers, ...userIds])];
    await shift.save();

    res.status(200).json({
      message: "Users assigned successfully.",
      data: shift,
    });
  } catch (err) {
    console.error("Error assigning users:", err);
    res.status(500).json({ message: "Server error assigning users." });
  }
};