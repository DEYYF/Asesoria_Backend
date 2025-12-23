const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Get all conversations for the logged-in user (Advisor or Client)
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role; // Based on your auth payload

    let query = {};
    if (role === 'asesor') {
      query = { asesorId: userId };
    } else {
      query = { clienteId: userId };
    }

    const conversations = await Conversation.find(query)
      .populate('asesorId', 'nombre email')
      .populate('clienteId', 'nombre email')
      .sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get message history for a specific conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;

    // Verify access
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const isAdvisor = role === 'asesor' && conversation.asesorId.toString() === userId;
    const isClient = role === 'cliente' && conversation.clienteId.toString() === userId;

    if (!isAdvisor && !isClient) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
