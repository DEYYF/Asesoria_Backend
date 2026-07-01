const MealTemplate = require('../models/MealTemplate');

exports.list = async (req, res) => {
  try {
    const asesorId = req.user.id || req.user._id;
    const templates = await MealTemplate.find({ asesorId }).sort({ updatedAt: -1 }).lean();
    return res.json(templates);
  } catch (error) {
    console.error('Error listing meal templates:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const asesorId = req.user.id || req.user._id;
    const payload = req.validatedBody || req.body;

    const template = await MealTemplate.create({
      asesorId,
      nombre: payload.nombre,
      categoria: payload.categoria || 'General',
      comida: payload.comida,
    });

    return res.status(201).json(template);
  } catch (error) {
    console.error('Error creating meal template:', error);
    return res.status(400).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const asesorId = req.user.id || req.user._id;
    const { id } = req.params;
    const payload = req.validatedBody || req.body;

    const template = await MealTemplate.findOneAndUpdate(
      { _id: id, asesorId },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
    return res.json(template);
  } catch (error) {
    console.error('Error updating meal template:', error);
    return res.status(400).json({ error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const asesorId = req.user.id || req.user._id;
    const { id } = req.params;
    const result = await MealTemplate.deleteOne({ _id: id, asesorId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Plantilla no encontrada' });
    return res.json({ ok: true, deleted: id });
  } catch (error) {
    console.error('Error deleting meal template:', error);
    return res.status(400).json({ error: error.message });
  }
};
