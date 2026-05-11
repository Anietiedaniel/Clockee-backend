// export const authorizeSuperAdmin = (req, res, next) => {
//   if (!Array.isArray(req.user.role) || !req.user.role.includes("super_admin")) {
//     return res.status(403).json({ message: "Super admin access required" });
//   }
//   next();
// };


// export const authorizeSuperAdmin = (
//   req,
//   res,
//   next
// ) => {
//   console.log(
//     "AUTHORIZE SUPER ADMIN HIT:",
//     req.method,
//     req.originalUrl
//   );

//   if (
//     !Array.isArray(req.user.role) ||
//     !req.user.role.includes(
//       "super_admin"
//     )
//   ) {
//     return res.status(403).json({
//       message:
//         "Super admin access required!!",
//     });
//   }

//   next();
// };

// 🔥 TEMP DEBUG VERSION
// Replace ENTIRE authorizeSuperAdmin middleware with this EXACT code

// export const authorizeSuperAdmin = (
//   req,
//   res,
//   next
// ) => {
//   console.log(
//     "🚨 AUTHORIZE SUPER ADMIN HIT",
//     {
//       method: req.method,
//       url: req.originalUrl,
//       user: req.user,
//     }
//   );

//   // 🔥 TEMPORARY BYPASS TO TRACE SOURCE
//   return next();
// };

export const authorizeSuperAdmin = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const roles = Array.isArray(
    req.user.role
  )
    ? req.user.role
    : [req.user.role];

  if (
    !roles.includes("super_admin")
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Super admin access required!!",
    });
  }

  next();
};