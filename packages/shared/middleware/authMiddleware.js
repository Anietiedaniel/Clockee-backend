import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";
import User from "../models/userModel.js"

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to protect routes
export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    // ✅ 1. VERIFY FIRST
    const decoded = jwt.verify(token, JWT_SECRET);

    // ✅ 2. THEN check blacklist
    const blacklisted = await TokenBlacklist.findOne({ token });

    if (blacklisted) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    // ✅ 3. Fetch user
    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = {
      userId: user._id,
      role: Array.isArray(user.role) ? user.role : [user.role],
      institutionId: user.institutionId,
      email: user.email,
      name: user.name,
    };

    next();
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
}

