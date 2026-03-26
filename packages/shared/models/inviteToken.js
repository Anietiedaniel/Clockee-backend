// models/InviteToken.js
import mongoose from "../db/mongoose.js";

const inviteTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },

    role: {
    type: [String],
    required: true
    
  },

    departmentOrUnit: { type: String },
    studentOrStaffId: { type: String },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // auto delete
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

type: {
  type: String,
  enum: ["public_onboarding", "direct"],
  required: true
},


  creatorName: String
  },
  { timestamps: true }
);

export default mongoose.model("InviteToken", inviteTokenSchema);
