// middlewares/validate.js
module.exports = (zodSchema) => (req, res, next) => {
  try {
    const parsed = zodSchema.parse(req.body);
    req.validatedBody = parsed;
    next();
  } catch (err) {
    return res.status(400).json({
      error: "ValidationError",
      details: err.errors?.map(e => ({ path: e.path, message: e.message })) || String(err)
    });
  }
};
