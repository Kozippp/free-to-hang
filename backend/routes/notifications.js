const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { notifyUser, NotificationTemplates } = require('../services/notificationService');

const supabase = global.supabase;

// POST /notifications/trigger-friend-request - Trigger notification after client sends friend request via Supabase
// Called by client after successful direct Supabase insert. Creates notification + push for receiver.
router.post('/trigger-friend-request', verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, request_id } = req.body;

    if (!receiver_id || !request_id) {
      return res.status(400).json({ error: 'receiver_id and request_id are required' });
    }

    // Verify the friend_request exists and caller is the sender
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('id', request_id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (request.sender_id !== senderId || request.receiver_id !== receiver_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' });
    }

    const { data: senderProfile } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', senderId)
      .single();

    const senderName = senderProfile?.name || 'Someone';
    const senderAvatar = senderProfile?.avatar_url || null;
    const template = NotificationTemplates.friend_request(senderName);
    await notifyUser({
      userId: receiver_id,
      ...template,
      data: {
        user_id: senderId,
        request_id,
        actorId: senderId,
        actorName: senderName,
        actorAvatarUrl: senderAvatar,
        imageUrl: senderAvatar
      },
      triggeredBy: senderId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error triggering friend request notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /notifications/trigger-friend-accepted - Trigger notification after client accepts via Supabase
// Called by client after successful direct Supabase update. Creates notification + push for original sender.
router.post('/trigger-friend-accepted', verifyToken, async (req, res) => {
  try {
    const receiverId = req.user.id; // The one who accepted (receiver of original request)
    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }

    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('id', request_id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (request.receiver_id !== receiverId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (request.status !== 'accepted') {
      return res.status(400).json({ error: 'Request is not accepted' });
    }

    const senderId = request.sender_id;
    const { data: receiverProfile } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', receiverId)
      .single();

    const receiverName = receiverProfile?.name || 'Your friend';
    const receiverAvatar = receiverProfile?.avatar_url || null;
    const template = NotificationTemplates.friend_accepted(receiverName);
    await notifyUser({
      userId: senderId,
      ...template,
      data: {
        user_id: receiverId,
        request_id,
        actorId: receiverId,
        actorName: receiverName,
        actorAvatarUrl: receiverAvatar,
        imageUrl: receiverAvatar
      },
      triggeredBy: receiverId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error triggering friend accepted notification:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ notifications: data || [] });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ notification: data });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.patch('/read-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

const NOTIFICATION_PREFERENCE_COLUMNS = new Set([
  'push_enabled',
  'plan_notifications',
  'chat_notifications',
  'friend_notifications',
  'status_notifications',
  'engagement_notifications',
  'quiet_hours_enabled',
  'quiet_hours_start',
  'quiet_hours_end'
]);

router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: created, error: insertError } = await supabase
        .from('notification_preferences')
        .insert({ user_id: userId })
        .select('*')
        .single();

      if (insertError) throw insertError;
      return res.json({ preferences: created });
    }

    res.json({ preferences: data });
  } catch (error) {
    console.error('❌ Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

router.patch('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const updates = {};

    for (const key of Object.keys(body)) {
      if (NOTIFICATION_PREFERENCE_COLUMNS.has(key)) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid preference fields to update' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ preferences: data });
  } catch (error) {
    console.error('❌ Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// 🧪 TEST ENDPOINT: Check push token status
router.get('/debug/tokens', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ 
      userId,
      tokens: tokens || [],
      count: tokens?.length || 0,
      hasActiveTokens: tokens?.some(t => t.active) || false
    });
  } catch (error) {
    console.error('❌ Error fetching debug tokens:', error);
    res.status(500).json({ error: 'Failed to fetch debug tokens' });
  }
});

// 🧪 TEST ENDPOINT: Send test push notification
router.post('/test-push', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title = 'Test Notification', body = 'This is a test message' } = req.body;

    console.log('🧪 Sending test push notification to user:', userId);

    const { sendPushNotification } = require('../services/notificationService');
    
    await sendPushNotification({
      userId,
      title,
      body,
      data: { test: true, screen: 'Home' }
    });

    console.log('✅ Test push notification sent');
    
    res.json({ 
      success: true,
      message: 'Test push notification sent. Check your device in 5-10 seconds.'
    });
  } catch (error) {
    console.error('❌ Error sending test push:', error);
    res.status(500).json({ 
      error: 'Failed to send test push',
      details: error.message 
    });
  }
});

// 🧪 TEST ENDPOINT: Send test notification to any user (for testing between devices)
router.post('/test-push/:targetUserId', verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const targetUserId = req.params.targetUserId;
    const { title = 'Test Notification', body = 'This is a test from another user' } = req.body;

    console.log(`🧪 User ${senderId} sending test push to ${targetUserId}`);

    const { sendPushNotification } = require('../services/notificationService');
    
    await sendPushNotification({
      userId: targetUserId,
      title,
      body,
      data: { test: true, screen: 'Home', from: senderId }
    });

    console.log('✅ Test push notification sent to target user');
    
    res.json({ 
      success: true,
      message: `Test push notification sent to user ${targetUserId}`
    });
  } catch (error) {
    console.error('❌ Error sending test push:', error);
    res.status(500).json({ 
      error: 'Failed to send test push',
      details: error.message 
    });
  }
});

// 🧪 SIMPLE TEST ENDPOINT: No auth required (REMOVE IN PRODUCTION!)
router.post('/simple-test-push/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { title = 'Simple Test', body = 'Testing without authentication' } = req.body;

    console.log(`🧪 Simple test: sending push to user ${userId}`);

    const { sendPushNotification } = require('../services/notificationService');
    
    await sendPushNotification({
      userId,
      title,
      body,
      data: { test: true, screen: 'Home' }
    });

    console.log('✅ Simple test notification sent');
    
    res.json({ 
      success: true,
      message: `Test push notification sent to user ${userId}`,
      note: '⚠️ This endpoint should be removed in production!'
    });
  } catch (error) {
    console.error('❌ Error in simple test:', error);
    res.status(500).json({ 
      error: 'Failed to send test push',
      details: error.message 
    });
  }
});

module.exports = router;

