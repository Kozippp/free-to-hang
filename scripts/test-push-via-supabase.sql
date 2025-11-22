-- 🧪 Test Push Notifications Otse Supabase'ist
-- Kopeeri see Supabase SQL Editor'isse ja käivita

-- 1. ESITEKS: Vaata, millised tokenid on andmebaasis
SELECT 
  user_id,
  expo_push_token,
  device_type,
  active,
  last_used_at
FROM push_tokens
WHERE active = true
ORDER BY created_at DESC;

-- 2. SEEJÄREL: Loo test notification (asenda USER_ID oma kasutaja ID'ga)
-- See loob notification andmebaasis
INSERT INTO notifications (
  user_id,
  type,
  title,
  body,
  data,
  read
) VALUES (
  'ASENDA_SIIN_USER_ID',  -- 👈 ASENDA SEE OMA USER ID'GA!
  'plan_invite',
  '🧪 Test Notification',
  'Kui sa seda näed, siis in-app notifications töötavad!',
  '{"test": true, "screen": "Home"}',
  false
);

-- 3. Kontrolli, kas notification loodi
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  created_at,
  read
FROM notifications
WHERE type = 'plan_invite'
ORDER BY created_at DESC
LIMIT 5;

-- 4. KUI NÄED NOTIFICATION'IT APP'IS:
-- In-app notifications töötavad! ✅
-- Nüüd peame push notifications tööle saama.

-- 5. Kontrolli notification preferences
SELECT 
  user_id,
  push_enabled,
  plan_notifications,
  chat_notifications,
  friend_notifications
FROM notification_preferences
WHERE user_id IN (
  SELECT user_id FROM push_tokens WHERE active = true
);

-- 6. Kui push_enabled = false, lülita see SISSE:
UPDATE notification_preferences
SET 
  push_enabled = true,
  plan_notifications = true,
  chat_notifications = true,
  friend_notifications = true
WHERE user_id = 'ASENDA_SIIN_USER_ID';  -- 👈 ASENDA SEE!

