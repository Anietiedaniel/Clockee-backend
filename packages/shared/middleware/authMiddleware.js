import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";
import User from "../models/User.js"; // ✅ adjust path if needed

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to protect routes
export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // 🔒 Check token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    // 🔒 Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 🔥 ALWAYS fetch user from DB (prevents missing fields like institutionId)
    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Normalize role to array (matches your schema)
    const roles = Array.isArray(user.role) ? user.role : [user.role];

    // ✅ Attach CLEAN and TRUSTED user object
    req.user = {
      userId: user._id,
      role: roles,
      institutionId: user.institutionId,
      email: user.email, // optional but useful
      name: user.name,   // optional
    };

    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}
