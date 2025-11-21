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

module.exports = router;

