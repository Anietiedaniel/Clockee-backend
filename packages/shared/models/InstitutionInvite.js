import mongoose from "../db/mongoose.js";

const institutionInviteSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      unique: true, // one public link per institution
    },

    token: {
      type: String,
      required: true,
      unique: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin
    },
  },
  { timestamps: true }
);

export default mongoose.model("InstitutionInvite", institutionInviteSchema);
