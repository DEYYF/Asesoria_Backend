const Tarifa = require("../models/Tarifa");
const cache = require("../utils/cache");

const CACHE_KEY = "tarifas:all";

exports.crearTarifa = async (req, res) => {
  try {
    const tarifa = await Tarifa.create(req.body);
    cache.clear(CACHE_KEY); // Invalidar cache
    res.status(201).json(tarifa);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando tarifa." });
  }
};

exports.obtenerTarifas = async (req, res) => {
  try {
    // Intentar obtener del cache
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    // Si no está en cache, consultar DB
    const tarifas = await Tarifa.find({ activo: true }).sort({ duracionDias: 1 }).lean();
    
    // Guardar en cache
    cache.set(CACHE_KEY, tarifas);
    
    res.json(tarifas);
  } catch (err) {
    res.status(500).json({ message: "Error obteniendo tarifas." });
  }
};

exports.actualizarTarifa = async (req, res) => {
  try {
    const tarifa = await Tarifa.findByIdAndUpdate(req.params.id, req.body, { new: true });
    cache.clear(CACHE_KEY); // Invalidar cache
    res.json(tarifa);
  } catch (err) {
    res.status(500).json({ message: "Error actualizando tarifa." });
  }
};

exports.eliminarTarifa = async (req, res) => {
  try {
    await Tarifa.findByIdAndUpdate(req.params.id, { activo: false });
    cache.clear(CACHE_KEY); // Invalidar cache
    res.json({ message: "Tarifa desactivada." });
  } catch (err) {
    res.status(500).json({ message: "Error eliminando tarifa." });
  }
};

