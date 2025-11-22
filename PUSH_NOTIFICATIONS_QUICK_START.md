# 🚀 Push Notifications - Kiire Start

## ⚡ Kõige Kiirem Viis Testimiseks

### 1. Rebuildi App (KOHUSTUSLIK!)

Kuna muutsime `app.json` faili (lisasime iOS background notifications), pead rebuildimine:

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang
npx expo run:ios --device
```

**⚠️ TÄHTIS:** Ühenda iPhone USB kaudu Mac'iga!

### 2. Käivita App ja Kontrolli Logisid

1. Ava **Safari** Mac'is
2. Safari → **Develop** → **[Sinu iPhone]** → **Free to Hang**
3. Vaata konsoolis neid logisid:

```
🔔 Starting push notification registration...
✅ Push token saved to database successfully
```

Kui neid pole, midagi läks valesti!

### 3. Võta JWT Token

Safari Web Inspector'is:
1. **Network** tab
2. Tee mingi API request (värskenda friends listi)
3. Kliki request'i peale
4. **Request Headers** → **Authorization**
5. Kopeeri token (ilma "Bearer " osata)

### 4. Käivita Test Script

```bash
./test-push-notifications.sh [SINU_JWT_TOKEN]
```

Näide:
```bash
./test-push-notifications.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Mis script teeb:**
- ✅ Kontrollib backend'i ühendust
- ✅ Kontrollib push tokeneid andmebaasis
- ✅ Saadab test notification'i
- ✅ Annab täpse feedback'i

### 5. Kontrolli iPhone'd

10 sekundi jooksul peaksid nägema notification'i!

---

## ❌ Kui Notification Ei Tule

### Kontrolli #1: iOS Notifications Seaded

iPhone'is:
- **Settings** → **Free to Hang** → **Notifications**
- Veendu, et kõik on lubatud

### Kontrolli #2: Push Tokenid

Käivita test script - see näitab, kas tokenid on andmebaasis.

Kui tokenid puuduvad:
1. Kustuta app
2. Rebuildi: `npx expo run:ios --device`
3. Installi uuesti
4. Logi sisse

### Kontrolli #3: Backend Töötab?

```bash
curl https://free-to-hang-production.up.railway.app/
```

Peaksid nägema: `"supabase": "Connected"`

---

## 🧪 Testi Kahe iPhone'i Vahel

### iPhone A:
1. Võta JWT token (nagu SAMM 3)
2. Võta user ID Supabase'ist või app logidest

### iPhone B:
1. Logi sisse teise kasutajana
2. Loo uus plan
3. Invite iPhone A kasutaja
4. Create plan

### iPhone A:
**Sulge app täielikult** ja oota...

Peaksid 10 sekundi jooksul saama notification'i! 🎉

---

## 📖 Täielik Juhend

Kui midagi ei tööta või tahad sügavamat debug'imist:

👉 **[PUSH_NOTIFICATIONS_DEBUG_GUIDE.md](./PUSH_NOTIFICATIONS_DEBUG_GUIDE.md)**

Seal on:
- ✅ Samm-sammult troubleshooting
- ✅ Kõik võimalikud vead ja lahendused
- ✅ Backend logs juhend
- ✅ Supabase andmebaasi kontrollimise juhend
- ✅ Expo.dev testimine

---

## 🆘 Abi Vaja?

**Kõige tavalisemad probleemid:**

1. **"No push tokens found"**
   → Rebuildi app ja logi uuesti sisse

2. **"Invalid Expo push token"**
   → Kontrolli `app.json` project ID'd

3. **Notification tuleb kui app on avatud, aga mitte kui suletud**
   → Rebuildi app (lisasime iOS background mode)

4. **Backend ei saada notification'it**
   → Vaata Railway logisid: https://railway.app

---

**Edu! 🚀**

