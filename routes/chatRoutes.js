const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/conversations', authMiddleware, chatController.getConversations);
router.post('/conversations', authMiddleware, chatController.findOrCreateConversation);
router.get('/messages/:conversationId', authMiddleware, chatController.getMessages);

module.exports = router;
