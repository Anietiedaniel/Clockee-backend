import mongoose from "mongoose";

export async function connectDB(mongoUri) {
  if (!mongoUri) throw new Error("MONGO_URI is required");

  try {
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB connected");
} catch (err) {
  console.error("FULL ERROR:", err);
}

}