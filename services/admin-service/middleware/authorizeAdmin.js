export const authorizeAdmin = (req, res, next) => {
  console.log("DEBUG req.user:", req.user); 

  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const allowedRoles = ["admin", "super_admin"];

  // Ensure req.user.role is array
  const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
  console.log("DEBUG userRoles:", userRoles); 

  // Check if user has at least one allowed role
  const hasAccess = userRoles.some(role => allowedRoles.includes(role));
  console.log("DEBUG hasAccess:", hasAccess); // <--- add this

  if (!hasAccess) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};