// authorizeAdmin.js
export const authorizeAdmin = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      middleware: "authorizeAdmin",
      route: req.originalUrl,
      method: req.method,
      message: "Unauthorized",
    });
  }

  const allowedRoles = [
    "admin",
    "super_admin",
  ];

  const userRoles = Array.isArray(
    req.user.role
  )
    ? req.user.role
    : [req.user.role];

  const hasAccess = userRoles.some(
    (role) =>
      allowedRoles.includes(role)
  );

  /* 🔥 DEBUG RESPONSE */
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      middleware: "authorizeAdmin",
      route: req.originalUrl,
      method: req.method,
      debug: {
        userRoles,
        allowedRoles,
        hasAccess,
      },
      message:
        "Admin access required",
    });
  }

  /* 🔥 TEMP DEBUG SUCCESS */
  return res.status(200).json({
    success: true,
    middleware: "authorizeAdmin",
    route: req.originalUrl,
    method: req.method,
    debug: {
      userRoles,
      allowedRoles,
      hasAccess,
    },
    message:
      "authorizeAdmin passed",
  });

  // next(); // 🔥 Re-enable after testing
};