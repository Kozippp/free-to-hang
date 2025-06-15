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
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (usernameError) return res.status(500).json({ error: usernameError.message });
  if (existing) return res.status(409).json({ error: 'Kasutajanimi on juba võetud' });

  // Lisa uus profiil
  const { data, error } = await supabase
    .from('profiles')
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