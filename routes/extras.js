const express = require("express");
const router = express.Router();
const controller = require("../controllers/extrasController");

router.post("/", controller.crearExtra);
router.get("/", controller.obtenerExtras);
router.put("/:id", controller.actualizarExtra);
router.delete("/:id", controller.eliminarExtra);

module.exports = router;
