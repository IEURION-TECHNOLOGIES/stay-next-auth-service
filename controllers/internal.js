import User from "../models/User.js";


export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    console.log("Fetched user:", user);
    if (!user) return res.status(404).json({ message: "User not found" })

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
};


export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
};


export const getUsersBatch = async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ message: "ids required and must be an array" });
  }

  try {
    const users = await User.find({ _id: { $in: ids } }).lean();
    res.status(200).json({ users });
  } catch (err) {
    console.error("getUsersBatch error:", err);
    res.status(500).json({ message: "Failed to fetch users", error: err.message });
  }
};



export const updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    if (!role) return res.status(400).json({ message: "Role is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isNewUser) return res.status(400).json({ message: "Role already set" });

    user.role = role;
    user.isNewUser = false;
    await user.save();

    res.status(200).json({
      message: "User role updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isNewUser: user.isNewUser,
      },
    });
  } catch (err) {
    console.error("🔥 updateUserRole error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};