# 🔔 Push Notifications Debug & Testing Guide

**Viimati uuendatud:** 22.11.2025  
**Eesmärk:** Käivitada push notifications kahel päris iPhone'is

---

## 🎯 Praegune Olukord

- ✅ Backend töötab: https://free-to-hang-production.up.railway.app/api
- ✅ Push notification kood on backend'is olemas
- ✅ Mobile app registreerib push tokeneid
- ❌ Notificationid ei jõua iPhone'idesse kui app on suletud

---

## 📋 Samm-sammult Testimine

### 1. SAMM: Kontrolli Push Tokenite Salvestamist

#### iPhone'is (mõlemad seadmed):

1. Ava app ja logi sisse
2. Luba notificationid kui küsitakse
3. Ava **Safari** Mac'is
4. Mine Safari → Develop → [Sinu iPhone nimi] → Free to Hang
5. Vaata konsooli logisid, peaks nägema:

```
🔔 Starting push notification registration for user: [user-id]
✅ Running on physical device
📋 Checking notification permissions...
Current permission status: granted
✅ Notification permissions granted
🆔 Using Expo project ID: 18a79a9c-af0a-4fb5-a752-3831e49d89ba
🎟️ Getting Expo push token...
🔔 Push token received: ExponentPushToken[xxxxxxxxxxxxxx]
💾 Saving push token to database...
✅ Push token saved to database successfully
```

**KUI SA EI NÄE NEID LOGISID:**
- Mine iPhone Settings → Free to Hang → Notifications
- Veendu, et "Allow Notifications" on sisse lülitatud
- Kustuta app ja installi uuesti
- Logi uuesti sisse

---

### 2. SAMM: Kontrolli Andmebaasis

1. Mine Supabase Dashboard'i: https://supabase.com
2. Vali oma projekt
3. Mine **Table Editor** → **push_tokens**
4. Kontrolli järgmist:

| Kontroll | Oodatav Tulemus |
|----------|----------------|
| **Ridade arv** | Peaks olema 2 rida (üks iga iPhone kohta) |
| **expo_push_token** | Peaks algama "ExponentPushToken[" |
| **active** | Peaks olema `true` |
| **user_id** | Peaks olema mõlema kasutaja ID |
| **device_type** | Peaks olema "ios" |

**PROBLEEMID JA LAHENDUSED:**

❌ **Tokeneid pole andmebaasis:**
- Kontrolli, kas app saab ühendust Supabase'iga
- Vaata Safari Web Inspector logisid vigu kohta
- Veendu, et `push_tokens` tabel eksisteerib

❌ **Tokenid on olemas, aga `active` on `false`:**
```sql
UPDATE push_tokens 
SET active = true 
WHERE user_id = '[sinu-user-id]';
```

---

### 3. SAMM: Testi Push Notificationeid Otse

#### Test 1: Saada endale test notification

Kasuta **curl** või **Postman**:

```bash
# Asenda [YOUR_TOKEN] oma JWT tokeniga ja [YOUR_USER_ID] oma user ID'ga

curl -X POST https://free-to-hang-production.up.railway.app/api/notifications/test-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -d '{
    "title": "Test",
    "body": "Kas sa näed seda?"
  }'
```

**Kuidas saada JWT token:**
1. Ava Safari Web Inspector app'is
2. Vali **Network** tab
3. Tee mingi API kutse (näiteks värskenda friends listi)
4. Kliki päringu peale
5. Vaata **Request Headers** → **Authorization**
6. Kopeeri Bearer token

**Oodatav tulemus:**
- Backend vastab: `{ "success": true, "message": "Test push notification sent..." }`
- 5-10 sekundi pärast peaksid nägema notification'i iPhone'is

#### Test 2: Saada notification teisele kasutajale

```bash
curl -X POST https://free-to-hang-production.up.railway.app/api/notifications/test-push/[TARGET_USER_ID] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -d '{
    "title": "Test teiselt kasutajalt",
    "body": "Tere!"
  }'
```

---

### 4. SAMM: Kontrolli Backend'i Logisid

1. Mine Railway Dashboard'i: https://railway.app
2. Vali oma backend projekt
3. Vaata **Logs** tab'i
4. Otsi järgmisi logisid:

**Edukas notification saatmine:**
```
ℹ️ No push tokens found for user: [user-id]  ❌ PROBLEEM!
```
VÕI
```
⚠️ Invalid Expo push token, skipping: [token]  ❌ PROBLEEM!
```
VÕI
```
(puuduvad logid)  ✅ HAKKAB SAATMA
```

---

### 5. SAMM: Testi Plaani Loomisega

1. **iPhone A:** Ava app ja jää sellele ekraanile
2. **iPhone B:** 
   - Loo uus plan
   - Lisa iPhone A kasutaja invited friends listi
   - Create plan
3. **Sulge app iPhone A's** (swipe up ja sulge täielikult)
4. Oota 10-15 sekundit
5. **Kontrolli iPhone A'd:** Peaks tulema notification

**KUI NOTIFICATION EI TULE:**

Vaata Railway logisid:
```
✅ Notified user [user-id] about plan [plan-id]
```

Kui seda logi pole:
- Backend ei saatunud notification'it
- Kontrolli, kas plaani loomine õnnestus
- Kontrolli, kas invited users lisati õigesti

Kui log on olemas, aga notification ei tule:
- **Push token on vale** → Mine tagasi SAMM 1 ja 2 juurde
- **Expo push service ei tööta** → Mine SAMM 6 juurde

---

### 6. SAMM: Testi Expo Push Service'i Otse

Mine: https://expo.dev/notifications

1. Sisesta oma **Expo Push Token** (SAMM 2 andmebaasist)
2. Sisesta test message
3. Vajuta "Send a Notification"

**Tulemus:**

✅ **Kui notification tuleb:**
- Expo service töötab
- Probleem on backend'i notification saatmise koodis

❌ **Kui notification ei tule:**
- Push token on vale või aegunud
- Expo project ID on vale
- Device registratsioon on katki

---

## 🔧 Levinumad Probleemid ja Lahendused

### Probleem 1: "ℹ️ No push tokens found for user"

**Põhjus:** Push tokeneid pole andmebaasis või need on `active = false`

**Lahendus:**
1. Kontrolli SAMM 2
2. Kustuta app mõlemast iPhone'ist
3. Builda ja installi uuesti:
   ```bash
   cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang
   npx expo run:ios --device
   ```
4. Logi sisse mõlemas seadmes
5. Luba notifications

---

### Probleem 2: "⚠️ Invalid Expo push token"

**Põhjus:** Token on vales formaadis või kasutab valet Expo project ID'd

**Lahendus:**
1. Kontrolli `app.json`:
   ```json
   "extra": {
     "eas": {
       "projectId": "18a79a9c-af0a-4fb5-a752-3831e49d89ba"
     }
   }
   ```
2. Veendu, et see on õige projekt
3. Rebuild app

---

### Probleem 3: Notifications tulevad, kui app on avatud, aga mitte kui suletud

**Põhjus:** iOS ei ole lubatud background notifications

**Lahendus:**
1. Kontrolli `app.json` → `ios` sektsioon
2. Lisa kui puudu:
   ```json
   "ios": {
     "infoPlist": {
       "UIBackgroundModes": ["remote-notification"]
     }
   }
   ```
3. Rebuild app

---

### Probleem 4: Backend ei saada notification'it (puuduvad logid)

**Põhjus:** `sendPlanInviteNotifications` ei käivitu või failib

**Lahendus:**
1. Kontrolli Railway logides, kas plaani loomine õnnestub
2. Kontrolli, kas `notificationService` on õigesti importitud
3. Lisa debug log plaani loomise endpoint'i:
   ```javascript
   console.log('🔔 About to send plan invite notifications');
   await sendPlanInviteNotifications(plan.id, userId, invitedFriends);
   console.log('🔔 Plan invite notifications sent');
   ```

---

## 🧪 Kiire Diagnostika Script

Kasuta seda terminalis, et saada kõik info korraga:

```bash
# Asenda [YOUR_TOKEN] ja [YOUR_USER_ID]

echo "=== TESTING PUSH NOTIFICATIONS ==="
echo ""
echo "1. Checking backend health..."
curl https://free-to-hang-production.up.railway.app/

echo ""
echo "2. Checking your push tokens..."
curl https://free-to-hang-production.up.railway.app/api/notifications/debug/tokens \
  -H "Authorization: Bearer [YOUR_TOKEN]"

echo ""
echo "3. Sending test notification..."
curl -X POST https://free-to-hang-production.up.railway.app/api/notifications/test-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -d '{"title": "Test", "body": "Testing push notifications"}'

echo ""
echo "=== CHECK YOUR PHONE IN 10 SECONDS ==="
```

---

## 📱 Development vs Production

**Development (Expo Go):**
- ❌ Push notifications **EI TÖÖTA** iOS simulaatoris
- ⚠️ Expo Go app'is võib olla limiteeritud
- ✅ Tuleb testida päris seadmes

**Production (TestFlight / App Store):**
- ✅ Push notifications töötavad täielikult
- ✅ Background notifications töötavad
- ✅ Badge counts töötavad

---

## 🎯 Järgmised Sammud Kui Midagi Ei Tööta

1. **Sulge app täielikult mõlemas iPhone'is**
2. **Ava Safari Web Inspector mõlema seadme jaoks**
3. **Ava app esimeses iPhone'is** ja jälgi logisid
4. **Kontrolli SAMM 1 ja SAMM 2** - veendu, et tokenid salvestatakse
5. **Käivita SAMM 3 curl command** - kas notification tuleb?
6. **Kui jah** → Backend töötab, probleem on plan creation flow'ga
7. **Kui ei** → Token või Expo projekt ID on vale
8. **Tee SAMM 6** Expo.dev test - kas token on üldse valid?

---

## 📞 Kui Kõik Ebaõnnestub

**Kontrolli Environment Variables Railway'l:**

Vajalikud muutujad:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `NODE_ENV=production`

**Kontrolli Supabase Row Level Security:**

Push_tokens tabel peab lubama:
- INSERT authenticated kasutajatele
- SELECT authenticated kasutajatele oma tokeneid
- UPDATE authenticated kasutajatele oma tokeneid

---

## ✅ Checklist Enne Live Minemist

- [ ] Mõlemad iPhone'id saavad push tokenid
- [ ] Tokenid on andmebaasis ja `active = true`
- [ ] Test notification endpoint töötab
- [ ] Expo.dev test töötab mõlema tokeniga
- [ ] Plan invitation notification tuleb kui app on suletud
- [ ] Badge count uueneb õigesti
- [ ] Notification tap avab õige screeni

---

**Edu testimisega!** 🚀

Kui leiad probleemi, kontrolli Railway logisid ja Safari Web Inspector'i. 
Kõik peamised debug logid on nüüd paigal!

