const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { handleFriendStatusChange } = require('../services/engagementService');

// Use global supabase instance initialised in backend/index.js
const supabase = global.supabase;

// GET /me
router.get('/me', verifyToken, async (req, res) => {
  const user = req.user;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /me - Update user profile
router.put('/me', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const { name, username, vibe, avatar_url } = req.body;
    
    // Validate input
    if (!name && !username && !vibe && !avatar_url) {
      return res.status(400).json({ error: 'Vähemalt üks väli peab olema uuendatud' });
    }

    // If username is being updated, check for uniqueness
    if (username) {
      const { data: existing, error: usernameError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', user.id) // Exclude current user
        .maybeSingle();
      
      if (usernameError) return res.status(500).json({ error: usernameError.message });
      if (existing) return res.status(409).json({ error: 'Kasutajanimi on juba võetud' });
    }

    // Prepare update object
    const updateData = {};
    if (name) updateData.name = name;
    if (username) updateData.username = username;
    if (vibe !== undefined) updateData.vibe = vibe;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    // Update user profile
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Kasutaja profiil ei leitud' });
    }

    res.json({ 
      message: 'Profiil uuendatud edukalt',
      user: data 
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Serveri viga profiili uuendamisel' });
  }
});

// PATCH /status - update availability + chain notifications
router.patch('/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_available, activity } = req.body || {};

    const available = Boolean(is_available);
    const normalizedActivity =
      available && typeof activity === 'string' ? activity.trim().slice(0, 120) : null;
    const now = new Date().toISOString();

    const { data: existingStatus, error: statusError } = await supabase
      .from('user_status')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (statusError) {
      console.error('❌ Error reading user_status row:', statusError);
      return res.status(500).json({ error: 'Failed to update status' });
    }

    if (existingStatus) {
      await supabase
        .from('user_status')
        .update({
          is_available: available,
          activity: normalizedActivity,
          last_active: now,
          updated_at: now
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('user_status')
        .insert({
          user_id: userId,
          is_available: available,
          activity: normalizedActivity,
          last_active: now,
          updated_at: now
        });
    }

    await supabase
      .from('users')
      .update({
        status: available ? 'available' : 'offline',
        current_activity: normalizedActivity,
        status_changed_at: now,
        last_seen_at: available ? null : now
      })
      .eq('id', userId);

    if (available) {
      await handleFriendStatusChange(userId, true);
    }

    res.json({
      success: true,
      status: {
        is_available: available,
        activity: normalizedActivity,
        last_active: now
      }
    });
  } catch (error) {
    console.error('❌ Error updating availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// POST /register-profile
router.post('/register-profile', verifyToken, async (req, res) => {
  const user = req.user;
  const { name, username, vibe, avatar_url } = req.body;
  if (!name || !username) {
    return res.status(400).json({ error: 'Nimi ja kasutajanimi on kohustuslikud' });
  }
  // Kontrolli, et username oleks unikaalne
  const { data: existing, error: usernameError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (usernameError) return res.status(500).json({ error: usernameError.message });
  if (existing) return res.status(409).json({ error: 'Kasutajanimi on juba võetud' });

  // Lisa uus profiil
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        id: user.id,
        name,
        username,
        vibe: vibe || null,
        avatar_url: avatar_url || null,
      },
    ])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router; 