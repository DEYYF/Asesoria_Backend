const express = require('express');
const router = express.Router();
const finanzasController = require('../controllers/finanzasController');

router.get('/resumen', finanzasController.obtenerResumen);
router.get('/movimientos', finanzasController.obtenerMovimientos);
router.get('/control-pagos', finanzasController.obtenerControlPagos);
router.get('/historico-grafico', finanzasController.obtenerHistoricoGrafico);
router.post('/movimientos', finanzasController.crearMovimientoManual);
router.delete('/movimientos/:id', finanzasController.eliminarMovimiento);

module.exports = router;
