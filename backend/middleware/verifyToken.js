const { createClient } = require('@supabase/supabase-js');

// Respect active project selection. Falls back to base env names if suffix ones are missing.
const ACTIVE = (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];

const SUPABASE_URL = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');
// Prefer anon key for JWT validation; fallback to service role if anon is missing
const SUPABASE_ANON_KEY = resolveEnv(`SUPABASE_ANON_KEY_${ACTIVE}`, 'SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = resolveEnv(`SUPABASE_SERVICE_ROLE_KEY_${ACTIVE}`, 'SUPABASE_SERVICE_ROLE_KEY');

// Create a lightweight client specifically for auth token verification
const authClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY
);

async function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header puudub või vale' });
  }
  const token = auth.split(' ')[1];
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Vigane või aegunud token' });
  }
  req.user = data.user;
  next();
}

module.exports = verifyToken; 