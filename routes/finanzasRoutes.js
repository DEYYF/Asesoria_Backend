const express = require('express');
const router = express.Router();
const finanzasController = require('../controllers/finanzasController');

router.get('/resumen', finanzasController.obtenerResumen);
router.get('/movimientos', finanzasController.obtenerMovimientos);
router.post('/movimientos', finanzasController.crearMovimientoManual);
router.delete('/movimientos/:id', finanzasController.eliminarMovimiento);

module.exports = router;
