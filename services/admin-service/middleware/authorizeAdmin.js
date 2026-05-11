// export const authorizeAdmin = (req, res, next) => {
//   console.log("DEBUG req.user:", req.user); 

//   if (!req.user) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   const allowedRoles = ["admin", "super_admin"];

//   // Ensure req.user.role is array
//   const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
//   console.log("DEBUG userRoles:", userRoles); 

//   // Check if user has at least one allowed role
//   const hasAccess = userRoles.some(role => allowedRoles.includes(role));
//   console.log("DEBUG hasAccess:", hasAccess); // <--- add this

//   if (!hasAccess) {
//     return res.status(403).json({ message: "Admin access required" });
//   }

//   next();
// };

// 🔥 UPDATED authorizeAdmin
// Supports:
// - super_admin
// - admin
// - institution owner

export const authorizeAdmin = (
  req,
  res,
  next
) => {
  console.log(
    "DEBUG req.user:",
    req.user
  );

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  /* ================= ROLES ================= */

  const userRoles = Array.isArray(
    req.user.role
  )
    ? req.user.role
    : [req.user.role];

  const isSuperAdmin =
    userRoles.includes(
      "super_admin"
    );

  const isAdmin =
    userRoles.includes("admin");

  const isInstitutionOwner =
    req.user
      .isInstitutionOwner === true;

  console.log(
    "DEBUG userRoles:",
    userRoles
  );

  console.log(
    "DEBUG owner:",
    isInstitutionOwner
  );

  /* ================= ACCESS ================= */

  const hasAccess =
    isSuperAdmin ||
    isAdmin ||
    isInstitutionOwner;

  console.log(
    "DEBUG hasAccess:",
    hasAccess
  );

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message:
        "Admin, super admin, or institution owner access required",
    });
  }

  next();
};