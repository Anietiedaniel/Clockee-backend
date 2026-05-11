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