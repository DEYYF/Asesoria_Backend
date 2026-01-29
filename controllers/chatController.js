const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const { Types } = require('mongoose');

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
    let { asesorId, clienteId, recipientAsesorId, type, participantId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role; // 'asesor' or 'admin' or undefined? Check authMiddleware

    // Handle simplified request from frontend { participantId }
    if (participantId) {
      // Logic: If I am an advisor, I am initiating chat with a Client (participantId)
      // Or maybe another advisor?
      // For now, assume simple 'Advisor -> Client' flow as requested for Client Dashboard
      // TODO: Improve role check if needed.
      
      // If we are an Advisor (default assumption for dashboard usage)
      type = 'advisor-client';
      asesorId = userId;
      clienteId = participantId;
      recipientAsesorId = null;
    }

    // Safety: only participants involved can create/find
    const isParticipant = userId === asesorId || userId === clienteId || userId === recipientAsesorId;
    // Allow if we just composed it correctly above
    if (!isParticipant) {
       // Check if we are the inferred one
       if (userId !== asesorId && userId !== clienteId) {
          return res.status(403).json({ error: 'Not authorized' });
       }
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

    console.log('[getContacts] Debug:', { userId, isClient, reqUser: req.user });

    if (isClient) {
      return res.status(403).json({ error: 'Only advisors can browse contacts' });
    }

    // 1. Get assigned clients
    const clients = await Cliente.find({ 
      asesorId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId 
    }, 'nombre email _id');
    console.log('[getContacts] Clients found:', clients.length);
    
    // 2. Get other advisors
    const advisors = await Usuario.find({ 
      _id: { $ne: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId } 
    }, 'nombre email _id');
    console.log('[getContacts] Advisors found:', advisors.length);

    res.json({
      clients,
      advisors
    });
  } catch (error) {
    console.error('[getContacts] Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get total unread count for the user
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all conversations where the user is a participant
    const conversations = await Conversation.find({
      $or: [
        { asesorId: userId },
        { clienteId: userId },
        { recipientAsesorId: userId }
      ]
    });

    let totalUnread = 0;
    
    conversations.forEach(conv => {
      if (conv.unreadCounts && conv.unreadCounts.has(userId)) {
        totalUnread += conv.unreadCounts.get(userId);
      }
    });

    res.json({ count: totalUnread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark conversation as read for the current user
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id; // user ID from token

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Initialize or get map
    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }

    // Reset count for this user
    conversation.unreadCounts.set(userId, 0);

    await conversation.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Authorization: Only sender can delete (or admin, but let's stick to sender for now)
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    const conversationId = message.conversationId;
    await Message.findByIdAndDelete(messageId);

    // Update Conversation's lastMessage if needed
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
        // Check if we need to update the last message cache
        // We just fetch the latest message now
        const lastMsg = await Message.findOne({ conversationId })
            .sort({ createdAt: -1 });
        
        if (lastMsg) {
            conversation.lastMessage = lastMsg.text;
            conversation.lastMessageAt = lastMsg.createdAt;
        } else {
            conversation.lastMessage = '';
            conversation.lastMessageAt = conversation.createdAt; // or null
        }
        await conversation.save();
    }

    // Attempt to emit socket event if io is available on app
    const io = req.app.get('io');
    if (io) {
        const participants = [
            conversation.asesorId?.toString(),
            conversation.clienteId?.toString(),
            conversation.recipientAsesorId?.toString()
        ].filter(id => id); // Filter out null/undefined

        participants.forEach(participantId => {
            io.to(participantId).emit('messageDeleted', { messageId, conversationId });
        });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
};
