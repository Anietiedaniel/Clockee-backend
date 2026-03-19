import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to protect routes
export function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = decoded; // { userId, role, institutionId }
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
