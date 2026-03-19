import mongoose from "../db/mongoose.js";

const shiftSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },

    // Shift name:  Morning, Night
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Start and End times (24hr format)
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]\d|2[0-3]):([0-5]\d)$/, // HH:mm
    },

    endTime: {
      type: String,
      required: true,
      match: /^([0-1]\d|2[0-3]):([0-5]\d)$/, // HH:mm
    },

    // Grace period for lateness (in minutes)
    gracePeriod: {
      type: Number,
      default: 10,
    },

    // repeat pattern for future expansion
    repeatDays: {
      type: [String], 
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },

    // Assigned Users
    assignedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Active or archived
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for performance
shiftSchema.index({ institutionId: 1 });
shiftSchema.index({ branchId: 1 });
shiftSchema.index({ startTime: 1 });
shiftSchema.index({ endTime: 1 });

export default mongoose.model("Shift", shiftSchema);
