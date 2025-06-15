const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const verifyToken = require('../middleware/verifyToken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /friends - Saab kõik sõbrad
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .rpc('get_user_relationships', { user_id: userId });
    
    if (error) throw error;
    
    res.json({
      friends: data.friends || [],
      friendRequests: data.friend_requests || [],
      sentRequests: data.sent_requests || [],
      blockedUsers: data.blocked_users || []
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /friends/request - Saada sõbrataotlus
router.post('/request', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    if (!friendId) {
      return res.status(400).json({ error: 'friendId on kohustuslik' });
    }
    
    const { error } = await supabase
      .rpc('upsert_relationship', {
        user1_id: userId,
        user2_id: friendId,
        new_status: 'pending_sent'
      });
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Sõbrataotlus saadetud' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /friends/accept - Nõustu sõbrataotlusega
router.post('/accept', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    if (!friendId) {
      return res.status(400).json({ error: 'friendId on kohustuslik' });
    }
    
    const { error } = await supabase
      .rpc('upsert_relationship', {
        user1_id: userId,
        user2_id: friendId,
        new_status: 'friends'
      });
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Sõbrataotlus vastu võetud' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /friends/:friendId - Eemalda sõber või keeldu taotlusest
router.delete('/:friendId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    
    const { error } = await supabase
      .rpc('remove_relationship', {
        user1_id: userId,
        user2_id: friendId
      });
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Suhe eemaldatud' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /friends/block - Blokeeri kasutaja
router.post('/block', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId on kohustuslik' });
    }
    
    const { error } = await supabase
      .rpc('upsert_relationship', {
        user1_id: userId,
        user2_id: targetUserId,
        new_status: 'blocked_by_a'
      });
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Kasutaja blokeeritud' });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /friends/search - Otsi kasutajaid
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.id;
    
    if (!query || query.length < 2) {
      return res.json({ users: [] });
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, avatar_url, bio, vibe')
      .or(`name.ilike.%${query}%, username.ilike.%${query}%`)
      .neq('id', userId)
      .limit(20);
    
    if (error) throw error;
    
    res.json({ users: data || [] });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 