import mongoose from "../db/mongoose.js";

const gpsSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  radius: { type: Number, default: 50 }, // in meters
});

const branchSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
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

    gps: {
      type: gpsSchema,
      required: true,
    },

    // Secret key used for generating dynamic QR or TOTP tokens
    qrSecret: {
      type: String,
      required: true,
    },

    // shift link (branch default)
    defaultShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
    },

    // Metadata
    totalUsers: { type: Number, default: 0 },
    totalAttendanceLogs: { type: Number, default: 0 },

    // Active status
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for optimization
branchSchema.index({ institutionId: 1 });
branchSchema.index({ name: 1 });
branchSchema.index({ "gps.lat": 1, "gps.lng": 1 });

export default mongoose.model("Branch", branchSchema);
