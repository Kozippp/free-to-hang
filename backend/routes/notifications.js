const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

const supabase = global.supabase;

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

router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.json({ preferences: data });
  } catch (error) {
    console.error('❌ Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

router.patch('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body || {};

    const { data, error } = await supabase
      .from('notification_preferences')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
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

module.exports = router;

