// routes/dietas.js
const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const { checkDietPermission } = require("../middleware/permissionsMiddleware");
const validate = require("../middlewares/validate");
const {
  createDietaSchema,
  updateDietaSchema,
  createRevisionSchema,
  restoreRevisionSchema,
} = require("../validators/dietaSchemas");
const ctrl = require("../controllers/dietaController");

// Listado (opcional: ?clienteId=...&asesorId=...&isCurrent=true|false|all)
router.get("/", auth, ctrl.list);

// Crear dieta (rev=1)
router.post("/", auth, validate(createDietaSchema), ctrl.create);

// Detalle
router.get("/:id", auth, ctrl.getById);

// Comidas de una dieta (compat con tu front actual)
router.get("/:id/comidas", auth, ctrl.getComidas);

// Shopping List
router.get("/:id/shopping-list", auth, ctrl.getShoppingList);

// Get last diet for a client
router.get("/cliente/:clienteId/ultima", auth, ctrl.getLastDietForClient);

// Guardar cambios => crea nueva revisión vigente (retrocompatible con tu editor)
router.put("/:id", auth, validate(updateDietaSchema), ctrl.putAsNewRevision);

// Borrar (soft por defecto, ?hard=1 para borrado real)
router.delete("/:id", auth, ctrl.remove);

// Historial de revisiones
router.get("/:id/revisions", auth, ctrl.listRevisions);

// Crear revisión explícita (desde front si quieres snapshot manual)
router.post("/:id/revision", auth, validate(createRevisionSchema), ctrl.createRevision);

// Restaurar revisión
router.post("/:id/restore/:rev", auth, validate(restoreRevisionSchema), ctrl.restoreRevision);

module.exports = router;
