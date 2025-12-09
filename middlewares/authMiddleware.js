// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    req.user = payload; // { _id, role, ... }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
