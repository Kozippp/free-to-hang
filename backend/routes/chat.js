const express = require('express');
const router = express.Router();

// Use global supabase instance
const supabase = global.supabase;

// Select anon key based on active project (fallback to base var)
const ACTIVE = (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];
const supabaseAnonKey = resolveEnv(`SUPABASE_ANON_KEY_${ACTIVE}`, 'SUPABASE_ANON_KEY');

if (!supabaseAnonKey) {
  console.warn('⚠️ SUPABASE_ANON_KEY environment variable is missing');
  console.warn('🚨 JWT authentication will be disabled');
}

// ============================================
// AUTHENTICATION HELPERS
// ============================================

// Helper function to get user from token
const getUserFromToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  console.log('🔑 Chat Auth - Token received:', token ? 'Yes' : 'No');
  if (!token) return null;
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    if (!supabaseAnonKey) {
      console.log('🔑 No anon key available, cannot validate JWT');
      return null;
    }
    
    const supabaseUrl = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');
    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { user }, error } = await clientSupabase.auth.getUser(token);
    console.log('🔑 Chat Auth - Validation:', error ? 'Failed' : 'Success');
    if (error) console.log('🔑 Chat Auth Error:', error.message);
    if (user) console.log('🔑 Chat User:', user.id, user.email);
    
    return error ? null : user;
  } catch (error) {
    console.log('🔑 Chat Auth Exception:', error.message);
    return null;
  }
};

// Middleware to require authentication
const requireAuth = async (req, res, next) => {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  next();
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Verify user is participant of the plan
const verifyPlanParticipant = async (userId, planId) => {
  const { data, error } = await supabase
    .from('plan_participants')
    .select('id')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .single();
  
  return !error && data;
};

// Get message with user info and reactions
const getMessageWithDetails = async (messageId) => {
  try {
    // Get message
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:users(id, name, username, avatar_url)
      `)
      .eq('id', messageId)
      .single();
    
    if (msgError) {
      console.error('Error fetching message:', msgError);
      return null;
    }
    
    // If there's a reply_to, fetch it separately
    if (message.reply_to_message_id) {
      const { data: replyData } = await supabase
        .from('chat_messages')
        .select(`
          id, 
          content, 
          type,
          user:users(id, name)
        `)
        .eq('id', message.reply_to_message_id)
        .single();
      
      if (replyData) {
        message.reply_to = replyData;
      }
    }
    
    // Get reactions
    const { data: reactions, error: reactError } = await supabase
      .from('chat_reactions')
      .select('user_id, emoji')
      .eq('message_id', messageId);
    
    if (reactError) {
      console.error('Error fetching reactions:', reactError);
    }
    
    // Format reactions as { userId: emoji }
    const reactionsMap = {};
    if (reactions) {
      reactions.forEach(r => {
        reactionsMap[r.user_id] = r.emoji;
      });
    }
    
    return {
      ...message,
      reactions: reactionsMap
    };
  } catch (error) {
    console.error('Error in getMessageWithDetails:', error);
    return null;
  }
};

// ============================================
// MESSAGE ENDPOINTS
// ============================================

// GET /api/chat/:planId/messages - Get messages for a plan
router.get('/:planId/messages', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const { limit = 50, before } = req.query; // before = message id for cursor pagination
    const userId = req.user.id;
    
    console.log(`📨 Fetching messages for plan ${planId}, user ${userId}`);
    
    // Verify user is participant
    const isParticipant = await verifyPlanParticipant(userId, planId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized to view this chat' });
    }
    
    // Build query
    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        user:users(id, name, username, avatar_url)
      `)
      .eq('plan_id', planId)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    // Cursor pagination
    if (before) {
      const { data: beforeMsg } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('id', before)
        .single();
      
      if (beforeMsg) {
        query = query.lt('created_at', beforeMsg.created_at);
      }
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
    }
    
    // Get reactions for all messages
    const messageIds = messages.map(m => m.id);
    const { data: reactions } = await supabase
      .from('chat_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);
    
    // Group reactions by message
    const reactionsByMessage = {};
    if (reactions) {
      reactions.forEach(r => {
        if (!reactionsByMessage[r.message_id]) {
          reactionsByMessage[r.message_id] = {};
        }
        reactionsByMessage[r.message_id][r.user_id] = r.emoji;
      });
    }
    
    // Fetch reply_to messages if any
    const replyToIds = messages
      .map(m => m.reply_to_message_id)
      .filter(id => id !== null);
    
    const replyToMap = {};
    if (replyToIds.length > 0) {
      const { data: replyMessages } = await supabase
        .from('chat_messages')
        .select(`
          id, 
          content, 
          type,
          user:users(id, name)
        `)
        .in('id', replyToIds);
      
      if (replyMessages) {
        replyMessages.forEach(msg => {
          replyToMap[msg.id] = msg;
        });
      }
    }
    
    // Add reactions and reply_to to messages and reverse order (oldest first for frontend)
    const messagesWithReactions = messages
      .map(msg => ({
        ...msg,
        reactions: reactionsByMessage[msg.id] || {},
        reply_to: msg.reply_to_message_id ? replyToMap[msg.reply_to_message_id] : undefined
      }))
      .reverse();
    
    console.log(`✅ Fetched ${messagesWithReactions.length} messages`);
    
    res.json({
      success: true,
      data: messagesWithReactions,
      meta: {
        count: messagesWithReactions.length,
        hasMore: messagesWithReactions.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error in get messages:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/chat/:planId/messages - Send a new message
router.post('/:planId/messages', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const { type, content, imageUrl, voiceUrl, voiceDuration, replyToMessageId } = req.body;
    const userId = req.user.id;
    
    console.log(`💬 Sending message to plan ${planId} from user ${userId}`);
    
    // Verify user is participant
    const isParticipant = await verifyPlanParticipant(userId, planId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized to send messages in this chat' });
    }
    
    // Validate message type
    const validTypes = ['text', 'image', 'voice', 'poll'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid message type' });
    }
    
    // Validate content
    if (type === 'text' && (!content || content.trim().length === 0)) {
      return res.status(400).json({ error: 'Text message cannot be empty' });
    }
    
    if (type === 'text' && content.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    // Verify reply_to message exists (if provided)
    if (replyToMessageId) {
      const { data: replyMsg, error: replyError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('id', replyToMessageId)
        .single();
      
      if (replyError || !replyMsg) {
        return res.status(400).json({ error: 'Reply message not found' });
      }
    }
    
    // Create message
    const messageData = {
      plan_id: planId,
      user_id: userId,
      type,
      content: content?.trim() || null,
      image_url: imageUrl || null,
      voice_url: voiceUrl || null,
      voice_duration: voiceDuration || null,
      reply_to_message_id: replyToMessageId || null,
      edited: false,
      deleted: false
    };
    
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating message:', error);
      return res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
    
    console.log(`✅ Message created: ${message.id}`);
    
    // Get message with full details
    const fullMessage = await getMessageWithDetails(message.id);
    
    res.status(201).json({
      success: true,
      data: fullMessage || message
    });
    
  } catch (error) {
    console.error('Error in send message:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// PUT /api/chat/messages/:messageId - Edit a message
router.put('/messages/:messageId', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    console.log(`✏️ Editing message ${messageId}`);
    
    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    // Get message and verify ownership
    const { data: existingMsg, error: fetchError } = await supabase
      .from('chat_messages')
      .select('user_id, type')
      .eq('id', messageId)
      .single();
    
    if (fetchError || !existingMsg) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    if (existingMsg.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this message' });
    }
    
    if (existingMsg.type !== 'text') {
      return res.status(400).json({ error: 'Only text messages can be edited' });
    }
    
    // Update message
    const { data: message, error } = await supabase
      .from('chat_messages')
      .update({
        content: content.trim(),
        edited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating message:', error);
      return res.status(500).json({ error: 'Failed to update message', details: error.message });
    }
    
    console.log(`✅ Message updated: ${messageId}`);
    
    // Get message with full details
    const fullMessage = await getMessageWithDetails(messageId);
    
    res.json({
      success: true,
      data: fullMessage || message
    });
    
  } catch (error) {
    console.error('Error in edit message:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /api/chat/messages/:messageId - Delete a message
router.delete('/messages/:messageId', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    console.log(`🗑️ Deleting message ${messageId}`);
    
    // Get message and verify ownership
    const { data: existingMsg, error: fetchError } = await supabase
      .from('chat_messages')
      .select('user_id')
      .eq('id', messageId)
      .single();
    
    if (fetchError || !existingMsg) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    if (existingMsg.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    // Soft delete: mark as deleted instead of removing
    const { error } = await supabase
      .from('chat_messages')
      .update({
        deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (error) {
      console.error('Error deleting message:', error);
      return res.status(500).json({ error: 'Failed to delete message', details: error.message });
    }
    
    console.log(`✅ Message deleted: ${messageId}`);
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in delete message:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================
// REACTION ENDPOINTS
// ============================================

// POST /api/chat/messages/:messageId/reactions - Add or update reaction
router.post('/messages/:messageId/reactions', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;
    
    console.log(`👍 Adding reaction ${emoji} to message ${messageId}`);
    
    // Validate emoji
    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Invalid emoji' });
    }
    
    // Verify message exists and user can access it
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .select('plan_id')
      .eq('id', messageId)
      .single();
    
    if (msgError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Verify user is participant
    const isParticipant = await verifyPlanParticipant(userId, message.plan_id);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized to react to this message' });
    }
    
    // Upsert reaction (insert or update if exists)
    const { data: reaction, error } = await supabase
      .from('chat_reactions')
      .upsert({
        message_id: messageId,
        user_id: userId,
        emoji
      }, {
        onConflict: 'message_id,user_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding reaction:', error);
      return res.status(500).json({ error: 'Failed to add reaction', details: error.message });
    }
    
    console.log(`✅ Reaction added: ${reaction.id}`);
    
    // Get all reactions for this message
    const { data: allReactions } = await supabase
      .from('chat_reactions')
      .select('user_id, emoji')
      .eq('message_id', messageId);
    
    const reactionsMap = {};
    if (allReactions) {
      allReactions.forEach(r => {
        reactionsMap[r.user_id] = r.emoji;
      });
    }
    
    res.json({
      success: true,
      data: {
        reaction,
        allReactions: reactionsMap
      }
    });
    
  } catch (error) {
    console.error('Error in add reaction:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /api/chat/messages/:messageId/reactions - Remove reaction
router.delete('/messages/:messageId/reactions', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    console.log(`👎 Removing reaction from message ${messageId}`);
    
    // Delete reaction
    const { error } = await supabase
      .from('chat_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error removing reaction:', error);
      return res.status(500).json({ error: 'Failed to remove reaction', details: error.message });
    }
    
    console.log(`✅ Reaction removed`);
    
    res.json({
      success: true,
      message: 'Reaction removed successfully'
    });
    
  } catch (error) {
    console.error('Error in remove reaction:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================
// READ RECEIPT ENDPOINTS
// ============================================

// POST /api/chat/:planId/read - Mark messages as read
router.post('/:planId/read', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const { lastReadMessageId } = req.body;
    const userId = req.user.id;
    
    console.log(`📖 Marking messages as read for plan ${planId}`);
    
    // Verify user is participant
    const isParticipant = await verifyPlanParticipant(userId, planId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }
    
    // Verify message exists
    if (lastReadMessageId) {
      const { data: message, error: msgError } = await supabase
        .from('chat_messages')
        .select('id, plan_id')
        .eq('id', lastReadMessageId)
        .single();
      
      if (msgError || !message) {
        return res.status(400).json({ error: 'Message not found' });
      }
      
      if (message.plan_id !== planId) {
        return res.status(400).json({ error: 'Message does not belong to this plan' });
      }
    }
    
    // Upsert read receipt
    const { data: receipt, error } = await supabase
      .from('chat_read_receipts')
      .upsert({
        plan_id: planId,
        user_id: userId,
        last_read_message_id: lastReadMessageId || null,
        last_read_at: new Date().toISOString()
      }, {
        onConflict: 'plan_id,user_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating read receipt:', error);
      return res.status(500).json({ error: 'Failed to update read receipt', details: error.message });
    }
    
    console.log(`✅ Read receipt updated`);
    
    res.json({
      success: true,
      data: receipt
    });
    
  } catch (error) {
    console.error('Error in mark as read:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/chat/:planId/read-receipts - Get read receipts for all users in plan
router.get('/:planId/read-receipts', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.id;

    console.log(`📖 Getting read receipts for plan ${planId}`);

    // Verify user is participant
    const isParticipant = await verifyPlanParticipant(userId, planId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    // Get all read receipts for the plan with user details
    const { data: receipts, error } = await supabase
      .from('chat_read_receipts')
      .select(`
        user_id,
        last_read_message_id,
        last_read_at,
        user:users(id, name, avatar_url)
      `)
      .eq('plan_id', planId);

    if (error) {
      console.error('Error fetching read receipts:', error);
      return res.status(500).json({ error: 'Failed to fetch read receipts', details: error.message });
    }

    // Format the response
    const formattedReceipts = {};
    if (receipts) {
      receipts.forEach(receipt => {
        formattedReceipts[receipt.user_id] = {
          userId: receipt.user_id,
          lastReadMessageId: receipt.last_read_message_id,
          lastReadAt: receipt.last_read_at,
          user: Array.isArray(receipt.user) ? receipt.user[0] : receipt.user
        };
      });
    }

    console.log(`✅ Fetched ${Object.keys(formattedReceipts).length} read receipts`);

    res.json({
      success: true,
      data: formattedReceipts
    });

  } catch (error) {
    console.error('Error in read receipts:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/chat/:planId/unread-count - Get unread message count
router.get('/:planId/unread-count', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.id;

    console.log(`🔢 Getting unread count for plan ${planId}`);

    // Verify user is participant
    const isParticipant = await verifyPlanParticipant(userId, planId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    // Get user's last read receipt
    const { data: receipt } = await supabase
      .from('chat_read_receipts')
      .select('last_read_at')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .single();

    // Count unread messages
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', planId)
      .eq('deleted', false)
      .neq('user_id', userId); // Don't count own messages

    if (receipt && receipt.last_read_at) {
      query = query.gt('created_at', receipt.last_read_at);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error counting unread messages:', error);
      return res.status(500).json({ error: 'Failed to count unread messages', details: error.message });
    }

    console.log(`✅ Unread count: ${count}`);

    res.json({
      success: true,
      data: {
        unreadCount: count || 0
      }
    });

  } catch (error) {
    console.error('Error in unread count:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;

