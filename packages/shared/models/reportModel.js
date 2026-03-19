import mongoose from "../db/mongoose.js";

const summarySchema = new mongoose.Schema({
  totalClockIns: { type: Number, default: 0 },
  totalClockOuts: { type: Number, default: 0 },
  onTime: { type: Number, default: 0 },
  late: { type: Number, default: 0 },
  absent: { type: Number, default: 0 },
  manualOverrides: { type: Number, default: 0 },
});

const reportSchema = new mongoose.Schema(
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

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Report time frame
    periodType: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    // Aggregated summary
    summary: { type: summarySchema, default: {} },

    // File export info (if downloaded/exported)
    exportFile: {
      format: { type: String, enum: ["excel", "pdf"], default: "excel" },
      url: { type: String }, // path to stored file (S3, Cloudinary, etc.)
    },

    // Metadata for analytics
    generatedAt: { type: Date, default: Date.now },
    totalUsersIncluded: { type: Number, default: 0 },

    // Status
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
  },
  { timestamps: true }
);

// Indexes
reportSchema.index({ institutionId: 1, periodType: 1, periodStart: 1 });
reportSchema.index({ branchId: 1 });
reportSchema.index({ generatedBy: 1 });

export default mongoose.model("Report", reportSchema);
