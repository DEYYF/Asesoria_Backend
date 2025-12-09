const Extra = require("../models/Extra");
const cache = require("../utils/cache");

const CACHE_KEY = "extras:all";

exports.crearExtra = async (req, res) => {
  try {
    const extra = await Extra.create(req.body);
    cache.clear(CACHE_KEY); // Invalidar cache
    res.status(201).json(extra);
  } catch (err) {
    res.status(500).json({ message: "Error creando extra." });
  }
};

exports.obtenerExtras = async (req, res) => {
  try {
    // Intentar obtener del cache
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    // Si no está en cache, consultar DB
    const extras = await Extra.find({ activo: true }).sort({ nombre: 1 }).lean();
    
    // Guardar en cache
    cache.set(CACHE_KEY, extras);
    
    res.json(extras);
  } catch (err) {
    res.status(500).json({ message: "Error obteniendo extras." });
  }
};

exports.actualizarExtra = async (req, res) => {
  try {
    const extra = await Extra.findByIdAndUpdate(req.params.id, req.body, { new: true });
    cache.clear(CACHE_KEY); // Invalidar cache
    res.json(extra);
  } catch (err) {
    res.status(500).json({ message: "Error actualizando extra." });
  }
};

exports.eliminarExtra = async (req, res) => {
  try {
    await Extra.findByIdAndUpdate(req.params.id, { activo: false });
    cache.clear(CACHE_KEY); // Invalidar cache
    res.json({ message: "Extra desactivado." });
  } catch (err) {
    res.status(500).json({ message: "Error eliminando extra." });
  }
};

