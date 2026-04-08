import mongoose from "../db/mongoose.js";

// ================= BACKUP CODES =================
const backupCodeSchema = new mongoose.Schema({
  code: { type: String, required: true },
  used: { type: Boolean, default: false },
});

// ================= USER SCHEMA =================
const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    email: {
      type: String,
      required: true,
      unique: true, // creates index automatically
      lowercase: true,
      trim: true,
    },

    address: { 
      type: String, 
      trim: true 
    },

    phone: { 
      type: String, 
      trim: true 
    },

    passwordHash: { 
      type: String, 
      required: true 
    },

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    // ================= ROLE =================
    role: {
      type: [String],
      enum: [
        "super_admin",
        "admin",
        "staff",
        "student",
        "pending",
        "rejected",
      ],
      default: ["staff"],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "User must have at least one role",
      },
    },

    clockMode: {
      type: String,
      enum: ["onsite", "remote", "hybrid", "field"],
      default: "onsite",
    },

    // ================= INSTITUTION =================
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true, // better than separate index call
    },

    institutionName: { type: String },
    institutionType: { 
      type: String, 
      enum: ["school", "company"] 
    },

    departmentOrUnit: { type: String },

    // ================= STAFF/STUDENT ID =================
    studentOrStaffId: {
      type: String,
      trim: true,
      sparse: true, 
      // IMPORTANT:
      // sparse prevents duplicate null errors
      // without sparse, Mongo will allow only ONE null
    },

    // ================= CREATOR =================
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    creatorName: {
      type: String,
      trim: true,
    },

    // ================= SECURITY =================
    backupCodes: [backupCodeSchema],

    // ================= STATUS =================
    isActive: { 
      type: Boolean, 
      default: true 
    },
  },
  { timestamps: true }
);


// ================= INDEXES =================

// Email index already created by `unique: true`

// Faster lookup by institution
userSchema.index({ institutionId: 1 });

// Role array index (good for querying admins, staff etc)
userSchema.index({ role: 1 });

// Compound index for institution + role (VERY USEFUL)
userSchema.index({ institutionId: 1, role: 1 });

// Unique student/staff ID per institution (BETTER DESIGN)
userSchema.index(
  { institutionId: 1, studentOrStaffId: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model("User", userSchema);