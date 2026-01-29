// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    
    // Normalize user object to ensure compatibility with both req.user._id and req.user.id
    const userId = payload.id || payload._id;
    req.user = { 
      ...payload, 
      _id: userId,
      id: userId,
      role: payload.role || 'advisor' 
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
