const Template = require('../models/Template');

const normalizeTemplateType = (value) => {
  const raw = String(value || '').trim().toLowerCase();

  if (['email', 'correo', 'mail', 'e-mail'].includes(raw)) return 'email';
  if (['chat', 'mensaje', 'message', 'mensajes', 'whatsapp'].includes(raw)) return 'chat';
  if (['both', 'ambos', 'todo', 'todos'].includes(raw)) return 'both';

  return 'both';
};

const normalizeCategories = (categories) => {
  const allowed = ['General', 'Dieta', 'Entreno', 'Seguimiento', 'Cobros', 'Otros'];

  const values = Array.isArray(categories)
    ? categories
    : typeof categories === 'string'
      ? [categories]
      : ['General'];

  const normalized = values
    .map((category) => String(category || '').trim())
    .filter(Boolean)
    .map((category) => {
      const match = allowed.find((allowedCategory) => allowedCategory.toLowerCase() === category.toLowerCase());
      return match || 'General';
    });

  return [...new Set(normalized.length ? normalized : ['General'])];
};

const getUserId = (req) => req.user?.id || req.user?._id;

// Get all templates for logged in advisor
exports.getTemplates = async (req, res) => {
  try {
    const asesorId = getUserId(req);
    const templates = await Template.find({ asesorId }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new template
exports.createTemplate = async (req, res) => {
  try {
    const { title, type, subject, content, categories } = req.body;
    const asesorId = getUserId(req);

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const newTemplate = new Template({
      asesorId,
      title: String(title).trim(),
      type: normalizeTemplateType(type),
      subject: subject == null ? '' : String(subject),
      content: String(content),
      categories: normalizeCategories(categories),
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
    const asesorId = getUserId(req);

    const template = await Template.findOne({ _id: id, asesorId });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    if (title !== undefined) template.title = String(title).trim();
    if (type !== undefined) template.type = normalizeTemplateType(type);
    if (subject !== undefined) template.subject = subject == null ? '' : String(subject);
    if (content !== undefined) template.content = String(content);
    if (categories !== undefined) template.categories = normalizeCategories(categories);

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
    const asesorId = getUserId(req);
    const result = await Template.deleteOne({ _id: id, asesorId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
