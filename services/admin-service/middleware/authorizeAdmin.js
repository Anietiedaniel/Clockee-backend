export const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const allowedRoles = ["admin", "super_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};