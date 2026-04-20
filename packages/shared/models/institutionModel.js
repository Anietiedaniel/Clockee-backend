import mongoose from "../db/mongoose.js";

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["school", "company"],
      required: true,
    },

    address: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
    },

     state: {
      type: String,
      trim: true,
    },

     city: {
      type: String,
      trim: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    status: {
      type: String,
      enum: [
        "active",       // normal working user
        "suspended",    // temporarily blocked
        "inactive",     // not yet approved / disabled
        "deleted"       // soft deleted (hidden from system)
      ],
      default: "active",
    },

    statusHistory: [
  {
    status: {
      type: String,
      enum: ["active", "suspended", "inactive", "deleted"],
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reason: {
      type: String,
      default: null,
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
]

    

    // The admin that registered or manages this institution
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // metadata e.g. industry, departments, branches count
    meta: {
      industry: { type: String },
      totalBranches: { type: Number, default: 0 },
      totalUsers: { type: Number, default: 0 },
    },

    // Institution status
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);



// Indexes
institutionSchema.index({ name: 1 });
institutionSchema.index({ type: 1 });
institutionSchema.index({ isActive: 1 });

export default mongoose.model("Institution", institutionSchema);
