export const isAdmin = (req, res, next) => {
  const allowedRoles = ["admin", "super_admin"];

  const userRoles = req.user?.role || [];

  const hasAccess = userRoles.some(role =>
    allowedRoles.includes(role)
  );

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
};