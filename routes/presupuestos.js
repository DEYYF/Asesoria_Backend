const express = require("express");
const router = express.Router();
const controller = require("../controllers/presupuestosController");
const authMiddleware = require("../middlewares/authMiddleware");

router.use(authMiddleware);

router.post("/", controller.crearPresupuesto);
router.get("/", controller.obtenerPresupuestos);
router.get("/:id", controller.obtenerPresupuesto);
router.put("/:id", controller.actualizarPresupuesto);
router.put("/:id/extras", controller.actualizarExtrasPresupuesto);
router.delete("/:id", controller.eliminarPresupuesto);

module.exports = router;
