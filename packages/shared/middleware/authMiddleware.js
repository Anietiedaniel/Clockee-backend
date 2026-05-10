import jwt from "jsonwebtoken";
import User from "../models/userModel.js";



// export async function protect(req, res, next) {
//   try {
//     const authHeader = req.headers.authorization;

//     /* ===============================
//        1️⃣ CHECK AUTH HEADER
//     =============================== */
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Authorization token missing",
//       });
//     }

//     const token = authHeader.split(" ")[1]?.trim();

//     if (!token || token === "undefined" || token === "null") {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token format",
//       });
//     }

//     /* ===============================
//        2️⃣ VERIFY TOKEN
//     =============================== */
//     let decoded;

//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET);
//     } catch (err) {
//       if (err.name === "TokenExpiredError") {
//         return res.status(401).json({
//           success: false,
//           message: "Token expired",
//         });
//       }

//       return res.status(401).json({
//         success: false,
//         message: "Invalid token",
//       });
//     }

//     /* ===============================
//        3️⃣ FETCH USER
//     =============================== */
//     const user = await User.findById(decoded.userId);

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "user not found",
//         debug: {
//       decoded,
//       userIdFromToken: decoded.userId,
//       institutionIdFromToken: decoded.institutionId,
//     },
//       });
//     }

//     /* ===============================
//        4️⃣ SINGLE DEVICE CHECK (NEW 🔥)
//     =============================== */
//     if (
//       !user.activeSession?.sessionId ||
//       user.activeSession.sessionId !== decoded.sessionId
//     ) {
//       return res.status(401).json({
//         success: false,
//         message: "Session expired or logged in on another device",
//       });
//     }

//     /* ===============================
//        5️⃣ ATTACH USER
//     =============================== */
//     req.user = {
//       userId: user._id,
//       role: Array.isArray(user.role) ? user.role : [user.role],
//       institutionId: user.institutionId,
//       email: user.email,
//       name: user.name,
//       sessionId: decoded.sessionId,
//     };

//     next();

//   } catch (error) {
//     console.error("Protect middleware error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// }


export async function protect(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization;

    /* ================= AUTH HEADER ================= */

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader
      .split(" ")[1]
      ?.trim();

    if (
      !token ||
      token === "undefined" ||
      token === "null"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    /* ================= VERIFY ================= */

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (err) {
      if (
        err.name ===
        "TokenExpiredError"
      ) {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    /* ================= USER ================= */

    const user = await User.findById(
      decoded.userId
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    /* ================= SESSION ================= */

    if (
      !user.activeSession?.sessionId ||
      user.activeSession.sessionId !==
        decoded.sessionId
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Session expired or logged in on another device",
      });
    }

    /* ================= REQUEST USER ================= */

    req.user = {
      userId: user._id,

      role: Array.isArray(user.role)
        ? user.role
        : [user.role],

      institutionId:
        decoded.institutionId ??
        user.institutionId ??
        null,

      branchId:
        decoded.branchId ??
        user.branchId ??
        null,

      email:
        decoded.email ??
        user.email,

      name:
        decoded.name ??
        user.name,

      sessionId:
        decoded.sessionId,

      isInstitutionOwner:
        decoded.isInstitutionOwner ??
        false,

      dashboardType:
        decoded.dashboardType ??
        "staff",
    };

    next();
  } catch (error) {
    console.error(
      "Protect middleware error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Server error",
    });
  }
}