import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";
import User from "../models/userModel.js"
import TokenBlacklist from "../models/tokenBlackList.js";

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to protect routes
export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    /* ===============================
       1️⃣ CHECK AUTH HEADER
    =============================== */
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1]?.trim();

    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    /* ===============================
       2️⃣ VERIFY TOKEN FIRST
    =============================== */
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("JWT verification failed:", err.name, err.message);

      if (err.name === "TokenExpiredError") {
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

    /* ===============================
       3️⃣ CHECK BLACKLIST
    =============================== */
    const blacklisted = await TokenBlacklist.findOne({ token });

    if (blacklisted) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    /* ===============================
       4️⃣ FETCH USER (SOURCE OF TRUTH)
    =============================== */
     const user = await User.findById(decoded.userId || decoded.id);


    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    /* ===============================
       5️⃣ ATTACH CLEAN USER TO REQUEST
    =============================== */
    req.user = {
      userId: user._id,
      role: Array.isArray(user.role) ? user.role : [user.role],
      institutionId: user.institutionId,
      email: user.email,
      name: user.name,
    };

    next();

  } catch (error) {
    console.error("Protect middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

