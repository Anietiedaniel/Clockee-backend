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
      unique: true,
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

    remoteAccess: {
      allowed: {
        type: Boolean,
        default: false,
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approvedAt: Date,
    },

    // ================= INSTITUTION =================
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
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

    // ================= SESSION CONTROL (NEW) =================
    activeSession: {
      sessionId: { type: String },     // unique per login
      deviceInfo: { type: String },    // optional (phone name, OS, etc.)
      lastLogin: { type: Date },
    },

    // ================= STATUS =================
    isActive: { 
      type: Boolean, 
      default: true 
    },
  },
  { timestamps: true }
);

// ================= INDEXES =================

// Faster lookup by institution
userSchema.index({ institutionId: 1 });

// Role index
userSchema.index({ role: 1 });

// Compound index
userSchema.index({ institutionId: 1, role: 1 });

// Unique student/staff ID per institution
userSchema.index(
  { institutionId: 1, studentOrStaffId: 1 },
  { unique: true, sparse: true }
);

// 🔥 NEW: session index for fast validation
userSchema.index({ "activeSession.sessionId": 1 });

export default mongoose.model("User", userSchema);