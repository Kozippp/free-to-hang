const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
// Use global supabase instance initialised in backend/index.js
const supabase = global.supabase;



// POST /friends/request - Send friend request
router.post('/request', verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id } = req.body;
    
    if (!receiver_id) {
      return res.status(400).json({ error: 'receiver_id is required' });
    }
    
    if (senderId === receiver_id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }
    
    // Check if request already exists (in either direction)
    const { data: existingRequest, error: checkError } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${senderId})`)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw checkError;
    }
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already exists or you are already friends' });
    }
    
    // Create new friend request
    const { data, error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiver_id,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      message: 'Friend request sent successfully',
      request: data
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /friends/requests/incoming - Get incoming friend requests
router.get('/requests/incoming', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .rpc('get_incoming_requests', { user_id: userId });
    
    if (error) throw error;
    
    res.json({ requests: data || [] });
  } catch (error) {
    console.error('Error fetching incoming requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /friends/requests/outgoing - Get outgoing friend requests
router.get('/requests/outgoing', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .rpc('get_outgoing_requests', { user_id: userId });
    
    if (error) throw error;
    
    res.json({ requests: data || [] });
  } catch (error) {
    console.error('Error fetching outgoing requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /friends - Get all friends (accepted requests)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .rpc('get_user_friends', { user_id: userId });
    
    if (error) throw error;
    
    res.json({ friends: data || [] });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /friends/request/accept - Accept friend request
router.post('/request/accept', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { request_id } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }
    
    // Update the request status to accepted
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', request_id)
      .eq('receiver_id', userId) // Only the receiver can accept
      .eq('status', 'pending') // Only pending requests can be accepted
      .select()
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Friend request not found or already processed' });
    }
    
    res.json({ 
      success: true, 
      message: 'Friend request accepted successfully',
      friendship: data
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /friends/request/decline - Decline friend request
router.post('/request/decline', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { request_id } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }
    
    // Delete the request (decline by deletion)
    const { data, error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', request_id)
      .eq('receiver_id', userId) // Only the receiver can decline
      .eq('status', 'pending') // Only pending requests can be declined
      .select()
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Friend request not found or already processed' });
    }
    
    res.json({ 
      success: true, 
      message: 'Friend request declined successfully'
    });
  } catch (error) {
    console.error('Error declining friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /friends/request/cancel - Cancel sent friend request
router.post('/request/cancel', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { receiver_id } = req.body;
    
    if (!receiver_id) {
      return res.status(400).json({ error: 'receiver_id is required' });
    }
    
    // Delete the request (cancel by deletion)
    const { data, error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', userId) // Only the sender can cancel
      .eq('receiver_id', receiver_id)
      .eq('status', 'pending') // Only pending requests can be cancelled
      .select()
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Friend request not found or already processed' });
    }
    
    res.json({ 
      success: true, 
      message: 'Friend request cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /friends/remove - Remove friend (delete accepted friendship)
router.post('/remove', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friend_id } = req.body;
    
    if (!friend_id) {
      return res.status(400).json({ error: 'friend_id is required' });
    }
    
    // Delete the friendship (works for both directions)
    const { data, error } = await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friend_id}),and(sender_id.eq.${friend_id},receiver_id.eq.${userId})`)
      .eq('status', 'accepted') // Only accepted friendships can be removed
      .select()
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Friendship not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /friends/status/:user_id - Get friendship status with specific user
router.get('/status/:user_id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { user_id } = req.params;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const { data, error } = await supabase
      .rpc('get_friendship_status', { 
        user1_id: userId, 
        user2_id: user_id 
      });
    
    if (error) throw error;
    
    res.json({ status: data || 'none' });
  } catch (error) {
    console.error('Error getting friendship status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /friends/search - Search users with relationship status
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.id;
    
    if (!query || query.length < 2) {
      return res.json({ users: [] });
    }
    
    // First get all users matching the search
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('id, name, username, avatar_url, bio, vibe')
      .or(`name.ilike.%${query}%, username.ilike.%${query}%`)
      .neq('id', userId)
      .limit(20);
    
    if (searchError) throw searchError;
    
    if (!users || users.length === 0) {
      return res.json({ users: [] });
    }
    
    // Get relationship status for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const { data: status, error: statusError } = await supabase
          .rpc('get_friendship_status', { 
            user1_id: userId, 
            user2_id: user.id 
          });
        
        if (statusError) {
          console.error('Error getting status for user', user.id, ':', statusError);
          return { ...user, relationshipStatus: 'none' };
        }
        
        return { ...user, relationshipStatus: status || 'none' };
      })
    );
    
    res.json({ users: usersWithStatus });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 