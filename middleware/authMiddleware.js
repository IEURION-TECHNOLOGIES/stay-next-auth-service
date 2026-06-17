import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  let token = req.cookies?.token;

  // 🚀 FALLBACK: Check Authorization Header if cookie fails cross-origin mapping
  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    console.log("❌ AUTH FAILURE: No token found in cookies OR headers.");
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 🔍 LOGGING: See exactly what the backend sees inside your token!
    console.log("✅ AUTH SUCCESS. Token Decoded Payload:", decoded);
    
    req.user = decoded; // Contains structure: userId, role, etc.
    next();
  } catch (err) {
    console.error("❌ AUTH FAILURE: Token verification failed.", err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// 👑 Allow Admins OR Superadmins (Safety fallback for admin dashboard endpoints)
export const isAdmin = (req, res, next) => {
  console.log("🛡️ Checking Admin Permissions for User Role:", req.user?.role);
  
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
};

// 🔒 Allow ONLY Superadmins
export const isSuperAdmin = (req, res, next) => {
  console.log("👑 Checking Superadmin Permissions for User Role:", req.user?.role);

  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Forbidden: Superadmins only" });
  }
  next();
};
