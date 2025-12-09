// utils/logMovimiento.js
const Movimiento = require('../models/Movimiento');

// Registra un movimiento en la base de datos
async function logMovimiento(req, descripcion) {
  try {
    const asesorId = req.user?._id || req.body.asesorId || req.query.asesorId;
    const Tipo = req.body?.tipo|| 'OTRO';
    if (!asesorId) return; // si no sabemos el asesor, no registramos
    await Movimiento.create({ asesorId, descripcion, fecha: new Date(), Tipo});
  } catch (e) {
    console.error('No se pudo registrar movimiento:', e.message);
  }
}

module.exports = { logMovimiento };
