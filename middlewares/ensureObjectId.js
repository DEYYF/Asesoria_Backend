// middlewares/ensureObjectId.js
const { Types } = require("mongoose");

module.exports = (paramName = "id") =>
  (req, res, next, value) => {
    if (!Types.ObjectId.isValid(String(value))) {
      return res.status(400).json({ error: `${paramName} inválido` });
    }
    next();
  };
