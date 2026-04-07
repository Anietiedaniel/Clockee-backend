import mongoose from "../db/mongoose.js";
const branchSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    /* ================= GEO LOCATION ================= */

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    radiusMeters: {
      type: Number,
      default: 50,
      min: 1,
    },

    /* ================= SECURITY ================= */

    qrSecret: {
      type: String,
      required: true,
      select: false, // security
    },

    defaultShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
    },

    /* ================= METRICS ================= */

    totalUsers: {
      type: Number,
      default: 0,
    },

    totalAttendanceLogs: {
      type: Number,
      default: 0,
    },

    /* ================= STATUS ================= */

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

branchSchema.index({ institutionId: 1 });
branchSchema.index({ name: 1 });

// Geo index
branchSchema.index({ location: "2dsphere" });

export default mongoose.model("Branch", branchSchema);