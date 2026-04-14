// models/TokenBlacklist.js
import mongoose from "mongoose";

const tokenBlacklistSchema = new mongoose.Schema({
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// auto delete after expiry
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("TokenBlacklist", tokenBlacklistSchema);
