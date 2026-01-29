const express = require('express');
const router = express.Router();
const facturaController = require('../controllers/facturaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// CRUD básico
router.post('/', facturaController.createFactura);
router.get('/', facturaController.getFacturas);
router.get('/stats', facturaController.getFacturasStats);
router.get('/:id', facturaController.getFacturaById);
router.put('/:id/estado', facturaController.updateFacturaEstado);
router.delete('/:id', facturaController.deleteFactura);

// Acciones especiales
router.get('/:id/pdf', facturaController.generateFacturaPDF);
router.post('/:id/send', facturaController.sendFacturaEmail);

module.exports = router;
