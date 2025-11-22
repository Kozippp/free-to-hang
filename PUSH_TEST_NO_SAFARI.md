# 🚀 Push Notifications Test (Ilma Safari Web Inspector'ita)

## ✅ Kiire Sammud

### 1. Rebuildi App (AINULT ÜKSKERDIT)

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang
npx expo run:ios --device
```

⏰ Võtab 5-10 minutit. Ühenda **mõlemad iPhone'd USB kaudu**.

---

### 2. Leia Oma User ID'd Supabase'is

1. Mine: https://supabase.com
2. Vali oma projekt
3. Mine **SQL Editor**
4. Kopeeri see query:

```sql
SELECT 
  id,
  email,
  name
FROM users
ORDER BY created_at DESC
LIMIT 10;
```

5. Kopeeri **mõlema kasutaja `id`** (see on pikk string nagu `123e4567-...`)

---

### 3. Kontrolli Push Tokeneid

Supabase SQL Editor:

```sql
SELECT 
  user_id,
  expo_push_token,
  device_type,
  active,
  last_used_at
FROM push_tokens
WHERE active = true
ORDER BY created_at DESC;
```

**Oodatav tulemus:**
- ✅ 2 rida (üks iga iPhone kohta)
- ✅ `expo_push_token` algab `ExponentPushToken[`
- ✅ `active` on `true`

**Kui tokeneid POLE:**
1. Ava app mõlemas iPhone'is
2. Logi sisse
3. Luba notifications
4. Oota 30 sekundit
5. Käivita query uuesti

**Kui ikka pole:**
```sql
-- Kontrolli, kas app üldse salvestab midagi
SELECT * FROM push_tokens ORDER BY created_at DESC LIMIT 5;
```

Kui tokenid on olemas aga `active = false`:
```sql
UPDATE push_tokens SET active = true WHERE user_id = 'SINU_USER_ID';
```

---

### 4. Lülita Notifications Seaded SISSE

Supabase SQL Editor:

```sql
-- Kontrolli preferences
SELECT * FROM notification_preferences 
WHERE user_id IN (
  SELECT user_id FROM push_tokens WHERE active = true
);

-- Kui push_enabled = false või puudub, lülita SISSE:
UPDATE notification_preferences
SET 
  push_enabled = true,
  plan_notifications = true,
  chat_notifications = true,
  friend_notifications = true
WHERE user_id = 'SINU_USER_ID_1';

-- Tee sama teise kasutaja jaoks:
UPDATE notification_preferences
SET 
  push_enabled = true,
  plan_notifications = true,
  chat_notifications = true,
  friend_notifications = true
WHERE user_id = 'SINU_USER_ID_2';
```

---

### 5. Saada Test Notification (Terminal'ist)

Nüüd KÕIGE LIHTSAM viis:

```bash
# Asenda USER_ID oma kasutaja ID'ga
curl -X POST https://free-to-hang-production.up.railway.app/api/notifications/simple-test-push/USER_ID \
  -H "Content-Type: application/json" \
  -d '{"title": "🧪 Test", "body": "Kas sa näed seda iPhone'is?"}'
```

**Oodatud:**
- ✅ Backend vastab: `{"success": true}`
- ✅ 5-10 sekundi pärast tuleb notification iPhone'i

**Kui notification EI TULE:**

#### Kontrolli A: Railway Logid

1. Mine: https://railway.app
2. Vali "free-to-hang-production"
3. **Logs** tab
4. Otsi:
```
🧪 Simple test: sending push to user...
✅ Simple test notification sent
```

**Kui logis on ERROR:**
- Vaata, mis error on
- Tõenäoliselt push token on invalid või Expo service ei tööta

#### Kontrolli B: Test Expo Push Service'i Otse

1. Mine: https://expo.dev/notifications
2. Sisesta oma `expo_push_token` (Supabase'ist)
3. Sisesta test message
4. Vajuta "Send"

**Kui notification tuleb:**
- ✅ Token on OK
- ❌ Probleem on backend'is

**Kui notification EI TULE:**
- ❌ Token on vale või aegunud
- Lahendus: Rebuildi app uuesti

---

### 6. Testi Päris Plaani Loomist

**iPhone A:**
- Ava app
- Mine Notifications tab'i

**iPhone B:**
- Loo uus plan
- Invite iPhone A kasutaja
- Create plan

**Tulemus iPhone A's:**
- ✅ Peaks nägema notification'it Notifications tab'is (in-app)
- **Sulge app täielikult**
- ✅ Peaks tulema push notification

**Kui in-app notification tuleb, aga push ei tule:**

Kontrolli Railway logisid:
```
✅ Notified user [user-id] about plan [plan-id]
```

Kui seda logi pole → Backend ei saatunud notification'it

Kui log on olemas → Probleem on push tokeniga

---

## 🔍 Troubleshooting Checklist

### ❌ Tokeneid pole andmebaasis

**Võimalikud põhjused:**
1. App pole veel käivitatud mõlemas iPhone'is
2. Supabase ühendus ei tööta
3. `push_tokens` tabel puudub

**Lahendus:**
```sql
-- Kontrolli, kas tabel eksisteerib
SELECT * FROM push_tokens LIMIT 1;

-- Kui annab errori, loo tabel:
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

-- Lisa RLS policy
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tokens"
ON push_tokens
FOR ALL
USING (auth.uid() = user_id);
```

### ❌ "Invalid Expo push token"

**Lahendus:**
1. Kontrolli `app.json` → `extra.eas.projectId`
2. Peab olema: `18a79a9c-af0a-4fb5-a752-3831e49d89ba`
3. Rebuildi app

### ❌ Backend annab errori "Failed to send test push"

**Lahendus:**
Kontrolli Railway environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=production`

### ❌ Notification tuleb in-app, aga mitte kui app on suletud

**Põhjus:** iOS background mode pole õigesti seadistatud

**Lahendus:**
Kontrolli `app.json`:
```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["remote-notification"]
  }
}
```

Rebuildi app.

---

## 📊 Success Checklist

- [ ] App on rebuildi'd mõlemas iPhone'is
- [ ] Push tokenid on andmebaasis (`active = true`)
- [ ] Notification preferences on `push_enabled = true`
- [ ] Test curl command töötab
- [ ] In-app notifications töötavad
- [ ] Push notifications töötavad (app suletud)
- [ ] Plan invitation notification töötab

---

## 🎯 Kui Kõik Muud Ebaõnnestub

### Viimane Päästmine: Terminal Logid

Käivita terminal'is:
```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang
npx expo run:ios --device
```

Jälgi terminal'i outputi. Peaksid nägema:
```
🔔 Starting push notification registration for user: [id]
✅ Push token saved to database successfully
```

Kui neid logisid pole → App ei suuda tokenit salvestada.

**Võimalikud põhjused:**
1. Supabase credentials on valed
2. Network ühendus on katki
3. RLS policies blokeerivad insert'i

**Testimiseks:**
Supabase SQL Editor:
```sql
-- Proovi manuaalselt lisada token
INSERT INTO push_tokens (
  user_id,
  expo_push_token,
  device_type,
  active
) VALUES (
  'SINU_USER_ID',
  'ExponentPushToken[test123]',
  'ios',
  true
);
```

Kui see ei tööta → RLS policy probleem.

---

**Edu!** 🚀

Alusta SAMM 1'st ja töö läbi sammud järjest.
Railway logid on sinu parim sõber!

