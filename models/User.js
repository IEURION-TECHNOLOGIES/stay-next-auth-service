import mongoose from "mongoose";

// =========================
// 🧩 User Schema Definition
// =========================
const userSchema = new mongoose.Schema(
  {
    // 👤 Basic User Info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: { type: String },
    whatsapp: { type: String },

    // 🔐 Authentication
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    isGoogleUser: {
      type: Boolean,
      default: false, // true if registered via Google OAuth
    },

    // 🎭 Role Management
    role: {
      type: String,
      enum: ["superadmin", "admin", "agent", "serviceprovider", "visitor", "agency", "professional", "hotel"], 
      default: "visitor",
    },
    isNewUser: {
      type: Boolean,
      default: true, // true until the user selects their role for the first time
    },

    // 🖼️ Profile
    profileImage: {
      type: String,
      default: "", // Cloudinary or local image URL
    },
    notifications: {
      type: Boolean,
      default: true, // whether to receive notifications or not
    },

    // 🌐 Google OAuth Tokens (if user logged in with Google)
    google: {
      access_token: { type: String },
      refresh_token: { type: String },
      expiry_date: { type: Number },
    },

    // ✉️ Email Verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifyEmailToken: String,
    verifyEmailExpire: Date,

    // 🔄 Password Reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

// =========================
// 📦 Model Export
// =========================
const User = mongoose.model("User", userSchema);
export default User;
