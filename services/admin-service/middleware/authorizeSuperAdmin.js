
export const authorizeSuperAdmin = (
  req,
  res,
  next
) => {
  try {
    /* ================= STEP 1 ================= */
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        debug: {
          step: "authorizeSuperAdmin",
          issue: "req.user missing",
          originalUrl: req.originalUrl,
          method: req.method,
          headers: {
            authorization:
              req.headers.authorization || null,
          },
        },
      });
    }

    /* ================= STEP 2 ================= */
    const roles = Array.isArray(
      req.user.role
    )
      ? req.user.role
      : [req.user.role];

    /* ================= STEP 3 ================= */
    if (
      !roles.includes("super_admin")
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Super admin access required!!",
        debug: {
          step: "role_check",
          reqUser: req.user,
          roles,
          hasSuperAdmin:
            roles.includes(
              "super_admin"
            ),
        },
      });
    }

    /* ================= SUCCESS ================= */
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Super admin authorization failed",
      debug: {
        step: "catch_block",
        error: error.message,
        stack: error.stack,
      },
    });
  }
};