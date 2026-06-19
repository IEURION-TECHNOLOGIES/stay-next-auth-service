// controllers/auth.js
import cloudinary from "../config/cloudinaryConfig.js";
import streamifier from "streamifier";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { sendEmail } from "../utils/sendEmail.js";
import { emailTemplate } from "../utils/emailTemplates.js";
import { generateToken } from "../utils/jwt.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const isProduction = process.env.NODE_ENV === "production";

// 🛠️ Helper function to isolate the correct client URL from your comma-separated list
const getClientUrl = () => {
  if (!process.env.CLIENT_URL) return "https://stay-next-frontend.vercel.app";
  
  const urls = process.env.CLIENT_URL.split(",").map(url => url.trim());
  
  // In development, pick the first URL (localhost). In production, pick the second URL (Vercel).
  return process.env.NODE_ENV === "development" ? urls[0] : (urls[1] || urls[0]);
};

// =======================
// REGISTER
// =======================
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "visitor",
      isGoogleUser: false,
      isNewUser: true,
      isVerified: false,
    });

    // Verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(verificationToken).digest("hex");

    user.verifyEmailToken = hashedToken;
    user.verifyEmailExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save({ validateBeforeSave: false });

    // Send verification email via Brevo
    // 💡 Uses helper function to build clean single link target
    const currentClientUrl = getClientUrl();
    const verificationLink = `${currentClientUrl}/verify-email?token=${verificationToken}`;
    
    await sendEmail(
      user.email,
      "Verify Your Email",
      emailTemplate("verifyEmail", user, null, { verificationLink })
    );

    res.status(201).json({
      message: "Registration successful. Please verify your email.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isNewUser: user.isNewUser,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error("🔥 Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// VERIFY EMAIL
// =======================
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Invalid or missing token" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      verifyEmailToken: hashedToken,
      verifyEmailExpire: { $gt: Date.now() },
    });

    if (!user) {
      const alreadyVerifiedUser = await User.findOne({ isVerified: true, verifyEmailToken: hashedToken });
      if (alreadyVerifiedUser)
        return res.status(200).json({ message: "Email already verified", userId: alreadyVerifiedUser._id });

      return res.status(400).json({ message: "Token invalid or expired" });
    }

    user.isVerified = true;
    user.verifyEmailToken = undefined;
    user.verifyEmailExpire = undefined;
    await user.save();

    // Temporary JWT for logged-in state (5 min)
    const tempToken = generateToken(user);
    res.cookie("token", tempToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 5 * 60 * 1000,
    });

    res.status(200).json({ message: "Email verified successfully", userId: user._id });
  } catch (err) {
    console.error("🔥 Verify email error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// LOGIN
// =======================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    if (!user.isVerified) return res.status(403).json({ message: "Please verify your email first" });

    const token = generateToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        token: token,
        name: user.name,
        email: user.email,
        role: user.role,
        isNewUser: false,
      },
    });
  } catch (err) {
    console.error("🔥 Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// GOOGLE LOGIN
// =======================
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token missing" });

    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const { name, email, picture, sub } = ticket.getPayload();
    console.log("check: ", ticket.audience)
    let user = await User.findOne({ email });
    if (!user) {
      const hashed = await bcrypt.hash(sub + "_google", 10);
      user = await User.create({
        name,
        email,
        password: hashed,
        profileImage: picture,
        role: "visitor",
        isGoogleUser: true,
        isNewUser: true,
        isVerified: true,
      });
    }

    const jwtToken = generateToken(user);
    res.cookie("token", jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Google login successful",
      user: {
        id: user._id,
        token: jwtToken,
        name: user.name,
        email: user.email,
        role: user.role,
        isNewUser: user.isNewUser,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error("🔥 Google Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// LOGOUT
// =======================
export const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
  });
  res.status(200).json({ message: "Logged out successfully" });
};

// =======================
// UPLOAD PROFILE IMAGE (Cloudinary)
// =======================
export const uploadProfileImage = async (req, res) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "mysecret");
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Upload to Cloudinary using memory buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "profile_images",
        public_id: `user_${user._id}`,
        overwrite: true,
      },
      async (error, result) => {
        if (error) {
          console.error("🔥 Cloudinary upload error:", error);
          return res.status(500).json({ message: "Cloud upload failed" });
        }

        user.profileImage = result.secure_url;
        await user.save();

        res.status(200).json({
          message: "Profile image updated successfully",
          profileImage: user.profileImage,
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (err) {
    console.error("🔥 Upload profile image error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/export const getMe = async (req, res) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "mysecret");
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (err) {
    console.error("🔥 getMe error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// =======================
// FORGOT PASSWORD
// =======================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    user.resetPasswordToken = hashed;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 min
    await user.save({ validateBeforeSave: false });

    // 💡 Uses helper function to build clean single link target
    const currentClientUrl = getClientUrl();
    const resetLink = `${currentClientUrl}/reset-password/${token}`;
    
    await sendEmail(
      user.email,
      "Password Reset Request",
      emailTemplate("resetPassword", user, null, { resetLink })
    );

    res.status(200).json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("🔥 Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// RESET PASSWORD
// =======================
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Token invalid or expired" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error("🔥 Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// SET ROLE
// =======================
export const setRole = async (req, res) => {
  try {
    const userId = req.user.userId; // from protect middleware
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: "Role is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isNewUser) return res.status(400).json({ message: "Role already set" });

    user.role = role;
    user.isNewUser = false;
    await user.save();

    res.status(200).json({
      message: "Role updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isNewUser: user.isNewUser,
      },
    });
  } catch (err) {
    console.error("🔥 Set role error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const settings = async (req, res) => {
  try {
    const userId = req.user.userId; // from protect middleware
    const { name, notification, profileImage, resetPassword } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (name) user.name = name;
    if (notification !== undefined) user.notifications = notification;
    if (profileImage) user.profileImage = profileImage;
    if (resetPassword) {
      user.password = await bcrypt.hash(resetPassword, 10);
    }
    await user.save();

    res.status(200).json({
      message: "Settings updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        notifications: user.notifications
      },
    });
  } catch (err) {
    console.error("🔥 Settings error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
