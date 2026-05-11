export const authorizeAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - no user found",
      });
    }

    const allowedRoles = ["admin", "super_admin"];

    // ensure roles is always an array
    const userRoles = Array.isArray(req.user.role)
      ? req.user.role
      : [req.user.role];

    const hasAccess = userRoles.some((role) =>
      allowedRoles.includes(role)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
        debug: {
          userRoles,
          allowedRoles,
          hasAccess,
        },
      });
    }

    next();
  } catch (error) {
    console.error("authorizeAdmin error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error in authorization",
    });
  }
};