import{ Holiday, Branch } from "@clockee/shared";

/* =========================================================
   CREATE HOLIDAY
   POST /admin/holidays
========================================================= */
export const createHoliday = async (req, res) => {
  try {
    const {
      role,
      institutionId,
      userId,
      isInstitutionOwner,
    } = req.user;

    const roles = Array.isArray(role)
      ? role
      : [role];

    const isAdmin =
      roles.includes("admin") ||
      roles.includes("super_admin");

    if (!isAdmin && !isInstitutionOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Admin or institution owner access required",
      });
    }

    const {
      name,
      date,
      branchId = null,
      isRecurringAnnual = false,
    } = req.body;

    /* ================= VALIDATION ================= */

    if (!name || !date) {
      return res.status(400).json({
        success: false,
        message: "Name and date are required",
      });
    }

    const holidayDate = new Date(date);

    if (isNaN(holidayDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid holiday date",
      });
    }

    /* ================= BRANCH VALIDATION ================= */

    if (branchId) {
      const branch = await Branch.findOne({
        _id: branchId,
        institutionId,
        isActive: true,
      });

      if (!branch) {
        return res.status(404).json({
          success: false,
          message:
            "Branch not found or invalid",
        });
      }
    }

    /* ================= DUPLICATE CHECK ================= */

    const existingHoliday =
      await Holiday.findOne({
        institutionId,
        branchId,
        name: name.trim(),
        date: holidayDate,
        isActive: true,
      });

    if (existingHoliday) {
      return res.status(400).json({
        success: false,
        message:
          "Holiday already exists for this date",
      });
    }

    /* ================= CREATE ================= */

    const holiday =
      await Holiday.create({
        institutionId,
        branchId,
        name: name.trim(),
        date: holidayDate,
        isRecurringAnnual,
        createdBy: userId,
      });

    return res.status(201).json({
      success: true,
      message:
        "Holiday created successfully",
      data: holiday,
    });
  } catch (error) {
    console.error(
      "Create holiday error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create holiday",
    });
  }
};

/* =========================================================
   GET HOLIDAYS
   GET /admin/holidays
========================================================= */
export const getHolidays = async (req, res) => {
  try {
    const {
      role,
      institutionId,
      isInstitutionOwner,
    } = req.user;

    const roles = Array.isArray(role)
      ? role
      : [role];

    const isAdmin =
      roles.includes("admin") ||
      roles.includes("super_admin");

    if (!isAdmin && !isInstitutionOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Admin or institution owner access required",
      });
    }

    const {
      branchId,
      year,
      active = "true",
    } = req.query;

    const query = {
      institutionId,
    };

    /* ================= ACTIVE FILTER ================= */

    if (active === "true") {
      query.isActive = true;
    }

    if (active === "false") {
      query.isActive = false;
    }

    /* ================= BRANCH FILTER ================= */

    if (branchId) {
      query.branchId = branchId;
    }

    /* ================= YEAR FILTER ================= */

    if (year) {
      const start = new Date(
        `${year}-01-01T00:00:00.000Z`
      );

      const end = new Date(
        `${year}-12-31T23:59:59.999Z`
      );

      query.date = {
        $gte: start,
        $lte: end,
      };
    }

    const holidays =
      await Holiday.find(query)
        .sort({ date: 1 })
        .populate(
          "createdBy",
          "name email"
        );

    return res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays,
    });
  } catch (error) {
    console.error(
      "Get holidays error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch holidays",
    });
  }
};

/* =========================================================
   UPDATE HOLIDAY
   PATCH /admin/holidays/:id
========================================================= */
export const updateHoliday = async (req, res) => {
  try {
    const {
      role,
      institutionId,
      isInstitutionOwner,
    } = req.user;

    const roles = Array.isArray(role)
      ? role
      : [role];

    const isAdmin =
      roles.includes("admin") ||
      roles.includes("super_admin");

    if (!isAdmin && !isInstitutionOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Admin or institution owner access required",
      });
    }

    const { id } = req.params;

    const holiday =
      await Holiday.findOne({
        _id: id,
        institutionId,
      });

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    const {
      name,
      date,
      branchId,
      isRecurringAnnual,
      isActive,
    } = req.body;

    /* ================= BRANCH VALIDATION ================= */

    if (branchId) {
      const branch = await Branch.findOne({
        _id: branchId,
        institutionId,
        isActive: true,
      });

      if (!branch) {
        return res.status(404).json({
          success: false,
          message:
            "Branch not found or invalid",
        });
      }
    }

    /* ================= UPDATE FIELDS ================= */

    if (name !== undefined) {
      holiday.name = name.trim();
    }

    if (date !== undefined) {
      const parsedDate =
        new Date(date);

      if (
        isNaN(parsedDate.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid holiday date",
        });
      }

      holiday.date = parsedDate;
    }

    if (branchId !== undefined) {
      holiday.branchId = branchId;
    }

    if (
      isRecurringAnnual !== undefined
    ) {
      holiday.isRecurringAnnual =
        isRecurringAnnual;
    }

    if (isActive !== undefined) {
      holiday.isActive = isActive;
    }

    await holiday.save();

    return res.status(200).json({
      success: true,
      message:
        "Holiday updated successfully",
      data: holiday,
    });
  } catch (error) {
    console.error(
      "Update holiday error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update holiday",
    });
  }
};

/* =========================================================
   DEACTIVATE HOLIDAY (SOFT DELETE)
   DELETE /admin/holidays/:id
========================================================= */
export const deactivateHoliday = async (
  req,
  res
) => {
  try {
    const {
      role,
      institutionId,
      isInstitutionOwner,
    } = req.user;

    const roles = Array.isArray(role)
      ? role
      : [role];

    const isAdmin =
      roles.includes("admin") ||
      roles.includes("super_admin");

    if (!isAdmin && !isInstitutionOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Admin or institution owner access required",
      });
    }

    const { id } = req.params;

    const holiday =
      await Holiday.findOne({
        _id: id,
        institutionId,
        isActive: true,
      });

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message:
          "Holiday not found or already inactive",
      });
    }

    holiday.isActive = false;

    await holiday.save();

    return res.status(200).json({
      success: true,
      message:
        "Holiday deactivated successfully",
      data: holiday,
    });
  } catch (error) {
    console.error(
      "Deactivate holiday error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to deactivate holiday",
    });
  }
};