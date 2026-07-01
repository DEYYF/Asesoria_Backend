const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const {
  createMealTemplateSchema,
  updateMealTemplateSchema,
} = require('../validators/mealTemplateSchemas');
const ctrl = require('../controllers/mealTemplateController');

router.get('/', auth, ctrl.list);
router.post('/', auth, validate(createMealTemplateSchema), ctrl.create);
router.put('/:id', auth, validate(updateMealTemplateSchema), ctrl.update);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
