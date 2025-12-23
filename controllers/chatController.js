const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');

// Get all conversations for the logged-in user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      $or: [
        { asesorId: userId },
        { clienteId: userId },
        { recipientAsesorId: userId }
      ]
    })
      .populate('asesorId', 'nombre email')
      .populate('clienteId', 'nombre email')
      .populate('recipientAsesorId', 'nombre email')
      .sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single conversation by ID
exports.getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId)
      .populate('asesorId', 'nombre email')
      .populate('clienteId', 'nombre email')
      .populate('recipientAsesorId', 'nombre email');

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const isParticipant =
      conversation.asesorId._id.toString() === userId ||
      (conversation.clienteId && conversation.clienteId._id.toString() === userId) ||
      (conversation.recipientAsesorId && conversation.recipientAsesorId._id.toString() === userId);

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get message history for a specific conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    // Verify access
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const isParticipant = 
      conversation.asesorId.toString() === userId || 
      (conversation.clienteId && conversation.clienteId.toString() === userId) ||
      (conversation.recipientAsesorId && conversation.recipientAsesorId.toString() === userId);

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Find or Create a conversation
exports.findOrCreateConversation = async (req, res) => {
  try {
    const { asesorId, clienteId, recipientAsesorId, type } = req.body;
    const userId = req.user.id;

    // Safety: only participants involved can create/find
    const isParticipant = userId === asesorId || userId === clienteId || userId === recipientAsesorId;
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let query = { type, asesorId };
    if (type === 'advisor-client') {
      query.clienteId = clienteId;
    } else {
      query.recipientAsesorId = recipientAsesorId;
    }

    let conversation = await Conversation.findOne(query);
    
    if (!conversation) {
      conversation = new Conversation({ type, asesorId, clienteId, recipientAsesorId });
      await conversation.save();
    }

    // Populate for response
    await conversation.populate('asesorId', 'nombre email');
    if (conversation.clienteId) await conversation.populate('clienteId', 'nombre email');
    if (conversation.recipientAsesorId) await conversation.populate('recipientAsesorId', 'nombre email');

    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get available contacts for an advisor
exports.getContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const isClient = req.user.type === 'client';

    if (isClient) {
      return res.status(403).json({ error: 'Only advisors can browse contacts' });
    }

    // 1. Get assigned clients
    const clients = await Cliente.find({ asesorId: userId }, 'nombre email _id');
    
    // 2. Get other advisors
    const advisors = await Usuario.find({ _id: { $ne: userId } }, 'nombre email _id');

    res.json({
      clients,
      advisors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
