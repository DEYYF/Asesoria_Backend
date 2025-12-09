const Dieta = require('../models/Dieta');
const Cliente = require('../models/Cliente');
const Movimiento = require('../models/Movimiento');

exports.obtenerMovimientos = async (req, res) => {
  try {
    const movimientos = await Movimiento.find({ asesor: req.user.id })
      .sort({ fecha: -1 })
      .limit(10);
    res.json(movimientos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener movimientos.' });
  }
};

exports.obtenerUltimaDieta = async (req, res) => {
  try {
    const ultima = await Dieta.findOne({ asesor: req.user.id }).sort({ fecha: -1 });
    res.json(ultima);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la última dieta.' });
  }
};
