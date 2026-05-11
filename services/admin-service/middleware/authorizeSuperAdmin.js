// export const authorizeSuperAdmin = (req, res, next) => {
//   if (!Array.isArray(req.user.role) || !req.user.role.includes("super_admin")) {
//     return res.status(403).json({ message: "Super admin access required" });
//   }
//   next();
// };


export const authorizeSuperAdmin = (
  req,
  res,
  next
) => {
  console.log(
    "AUTHORIZE SUPER ADMIN HIT:",
    req.method,
    req.originalUrl
  );

  if (
    !Array.isArray(req.user.role) ||
    !req.user.role.includes(
      "super_admin"
    )
  ) {
    return res.status(403).json({
      message:
        "Super admin access required!!",
    });
  }

  next();
};