const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const verifyToken = require('../middleware/verifyToken');

// Supabase ühendus (kasuta olemasolevat või loo uus)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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