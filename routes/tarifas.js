const express = require("express");
const router = express.Router();
const controller = require("../controllers/tarifasController");

// proteger rutas si usas middleware auth
// const { protect } = require("../middlewares/authMiddleware");

router.post("/", controller.crearTarifa);
router.get("/", controller.obtenerTarifas);
router.put("/:id", controller.actualizarTarifa);
router.delete("/:id", controller.eliminarTarifa);

module.exports = router;
