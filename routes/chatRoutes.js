const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/conversations', authMiddleware, chatController.getConversations);
router.get('/unread-count', authMiddleware, chatController.getUnreadCount);
router.get('/conversations/:conversationId', authMiddleware, chatController.getConversationById);
router.post('/conversations', authMiddleware, chatController.findOrCreateConversation);
router.get('/contacts', authMiddleware, chatController.getContacts);
router.get('/messages/:conversationId', authMiddleware, chatController.getMessages);
router.delete('/messages/:messageId', authMiddleware, chatController.deleteMessage);
router.put('/conversations/:conversationId/read', authMiddleware, chatController.markAsRead);

module.exports = router;
