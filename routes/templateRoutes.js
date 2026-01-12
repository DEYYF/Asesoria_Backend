const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, templateController.getTemplates);
router.post('/', authMiddleware, templateController.createTemplate);
router.put('/:id', authMiddleware, templateController.updateTemplate);
router.delete('/:id', authMiddleware, templateController.deleteTemplate);

module.exports = router;
