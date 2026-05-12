import mongoose from "../db/mongoose.js";

const holidaySchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

        type: {
    type: String,
    enum: ["public", "institution", "branch"],
    default: "institution",
    },

    isRecurringAnnual: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

holidaySchema.index({
  institutionId: 1,
  date: 1,
});

export default mongoose.model(
  "Holiday",
  holidaySchema
);