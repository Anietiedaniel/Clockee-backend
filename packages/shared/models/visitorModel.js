// shared/models/visitorModel.js
import mongoose from "../db/mongoose.js";

const visitorSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, unique: true },

    companyName: { type: String },
    phone: { type: String },

    interest: {
      type: String,
      enum: ["school", "company", "personal", "other"],
    },

    // very limited role
    role: {
      type: String,
      default: "visitor",
      immutable: true,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Visitor", visitorSchema);
