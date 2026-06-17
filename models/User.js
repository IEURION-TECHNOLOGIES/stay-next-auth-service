import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String },
    whatsapp: { type: String },

    password: { type: String, required: true, minlength: 6 },
    isGoogleUser: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["superadmin", "admin", "agent", "serviceprovider", "visitor", "agency", "professional", "hotel"],
      default: "visitor",
    },
    isNewUser: { type: Boolean, default: true },

    profileImage: { type: String, default: "" },
    notifications: { type: Boolean, default: true },

    google: {
      access_token: { type: String },
      refresh_token: { type: String },
      expiry_date: { type: Number },
    },

    isVerified: { type: Boolean, default: false },
    verifyEmailToken: String,
    verifyEmailExpire: Date,

    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // ✅ NOW INSIDE the schema
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;