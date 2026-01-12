const Template = require('../models/Template');

// Get all templates for logged in advisor
exports.getTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ asesorId: req.user.id }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new template
exports.createTemplate = async (req, res) => {
  try {
    const { title, type, subject, content, categories } = req.body;
    
    const newTemplate = new Template({
      asesorId: req.user.id,
      title,
      type,
      subject,
      content,
      categories
    });

    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a template
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, subject, content, categories } = req.body;

    const template = await Template.findOne({ _id: id, asesorId: req.user.id });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    template.title = title || template.title;
    template.type = type || template.type;
    template.subject = subject; // Can be empty or null logic if needed, but here simple overwrite
    template.content = content || template.content;
    template.categories = categories || template.categories;

    await template.save();
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Template.deleteOne({ _id: id, asesorId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
