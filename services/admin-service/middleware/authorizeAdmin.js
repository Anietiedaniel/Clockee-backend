export const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const allowedRoles = ["admin", "super_admin"];

  // Ensure req.user.role is an array
  const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];

  // Check if user has at least one allowed role
  const hasAccess = userRoles.some(role => allowedRoles.includes(role));

  if (!hasAccess) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};