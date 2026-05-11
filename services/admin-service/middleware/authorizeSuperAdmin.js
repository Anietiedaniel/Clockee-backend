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

// export const authorizeSuperAdmin = (
//   req,
//   res,
//   next
// ) => {
//   if (!req.user) {
//     return res.status(401).json({
//       success: false,
//       message: "Unauthorized",
//     });
//   }

//   const roles = Array.isArray(
//     req.user.role
//   )
//     ? req.user.role
//     : [req.user.role];

//   if (
//     !roles.includes("super_admin")
//   ) {
//     return res.status(403).json({
//       success: false,
//       message:
//         "Super admin access required!!",
//     });
//   }

//   next();
// };


// authorizeSuperAdmin.js
export const authorizeSuperAdmin = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      middleware:
        "authorizeSuperAdmin",
      route: req.originalUrl,
      method: req.method,
      message: "Unauthorized",
    });
  }

  const roles = Array.isArray(
    req.user.role
  )
    ? req.user.role
    : [req.user.role];

  const hasAccess =
    roles.includes(
      "super_admin"
    );

  /* 🔥 DEBUG RESPONSE */
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      middleware:
        "authorizeSuperAdmin",
      route: req.originalUrl,
      method: req.method,
      debug: {
        userRoles: roles,
        requiredRole:
          "super_admin",
        hasAccess,
      },
      message:
        "Super admin access required!!",
    });
  }

  /* 🔥 TEMP DEBUG SUCCESS */
  return res.status(200).json({
    success: true,
    middleware:
      "authorizeSuperAdmin",
    route: req.originalUrl,
    method: req.method,
    debug: {
      userRoles: roles,
      requiredRole:
        "super_admin",
      hasAccess,
    },
    message:
      "authorizeSuperAdmin passed",
  });

  // next(); // 🔥 Re-enable after testing
};