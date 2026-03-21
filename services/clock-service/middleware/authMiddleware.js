export const isAdmin = (req, res, next) => {
  const allowedRoles = ["admin", "super_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
