import mongoose from "../db/mongoose.js";

// backup codes for login
const backupCodeSchema = new mongoose.Schema({
  code: { type: String, required: true },
  used: { type: Boolean, default: false },
});

// user info
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,           // unique already creates an index
      lowercase: true,
      trim: true,
    },
    address: { type: String,  trim: true },
    phone: { type: String,  trim: true },
    passwordHash: { type: String, required: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    
  role: {
  type: [String],
  enum: ["super_admin", "admin", "staff", "student", "pending","rejected"],
  default: ["staff"],
  validate: {
    validator: v => v.length > 0,
    message: "User must have at least one role"
  }
},
    
    clockMode: {
        type: String,
        enum: ["onsite", "remote", "hybrid", "field"],
        default: "onsite"
      },

    // Institution reference
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    // Cached fields for convenience
    institutionName: { type: String },
    institutionType: { type: String, enum: ["school", "company"] },

    // Department (school) or Unit (company)
    departmentOrUnit: { type: String },

  // Student or staff/employee ID
    
  studentOrStaffId: { 
  type: String,
  trim: true,
  unique: true, 
  
},

    createdBy:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
    },

    creatorName: {
    type: String,
    trim: true,
    },

    // Backup codes (for fallback clock-ins or logins)
    backupCodes: [backupCodeSchema],

    // Status fields
    isActive: { type: Boolean, default: true },
  },
 
  

  { timestamps: true }
);

// Additional indexes for faster queries
userSchema.index({ institutionId: 1 });
userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);
