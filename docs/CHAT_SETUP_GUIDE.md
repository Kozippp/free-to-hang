# Chat System Setup Guide

## 📋 Kokkuvõte

Chat süsteem on nüüd täielikult implementeeritud! See juhend aitab sul chati kasutuselevõtul.

## ✅ Mis on Tehtud

### 1. Andmebaasi Skeemid
- ✅ `chat_messages` tabel sõnumite salvestamiseks
- ✅ `chat_reactions` tabel emoji reaktsioonide jaoks
- ✅ `chat_read_receipts` tabel lugemise staatuse jälgimiseks
- ✅ RLS (Row Level Security) poliitikad kõigile tabelitele
- ✅ Indeksid jõudluse parandamiseks
- ✅ Storage bucket `chat-images` piltide jaoks

### 2. Backend API
- ✅ `/backend/routes/chat.js` - Täielik API chat funktsionaalsuse jaoks
- ✅ Endpoints:
  - `GET /api/chat/:planId/messages` - Sõnumite päring
  - `POST /api/chat/:planId/messages` - Sõnumi saatmine
  - `PUT /api/chat/messages/:messageId` - Sõnumi muutmine
  - `DELETE /api/chat/messages/:messageId` - Sõnumi kustutamine
  - `POST /api/chat/messages/:messageId/reactions` - Reaktsiooni lisamine
  - `DELETE /api/chat/messages/:messageId/reactions` - Reaktsiooni eemaldamine
  - `POST /api/chat/:planId/read` - Sõnumite lugetuks märkimine
  - `GET /api/chat/:planId/unread-count` - Lugemata sõnumite arv

### 3. Frontend Integratsioon
- ✅ `store/chatStore.ts` uuendatud Supabase integratsiooniga
- ✅ Realtime subscriptions Supabase Realtime kasutades
- ✅ Optimistic updates kiirema UX jaoks
- ✅ `ChatView.tsx` uuendatud automaatse sõnumite laadimise ja realtime'iga

### 4. Funktsioonid
- ✅ Teksti sõnumid
- ✅ Pildi sõnumid
- ✅ Reply (vastamine sõnumitele)
- ✅ Emoji reaktsioonid
- ✅ Sõnumite muutmine (edit)
- ✅ Sõnumite kustutamine (unsend)
- ✅ Lugemise staatuse jälgimine
- ✅ Real-time uuendused

## 🚀 Kasutuselevõtt

### Samm 1: Andmebaasi Seadistamine

1. **Logi sisse Supabase Dashboard'i**
   - Mine aadressile: https://supabase.com/dashboard
   - Vali oma projekt

2. **Käivita SQL skeem**
   - Navigeeri SQL Editor'isse (vasakpoolne menüü)
   - Ava fail: `/supabase/chat-schema.sql`
   - Kopeeri kogu faili sisu
   - Kleebi SQL Editor'isse
   - Vajuta "Run" nuppu

3. **Kontrolli tulemust**
   - Peaks ilmuma teade: "✅ Chat system database schema created successfully!"
   - Kontrolli Table Editor'ist, et järgmised tabelid on loodud:
     - `chat_messages`
     - `chat_reactions`
     - `chat_read_receipts`

4. **Kontrolli Storage Bucket'it**
   - Mine Storage lehele
   - Kontrolli, et `chat-images` bucket on olemas
   - Bucket peaks olema public ja lubama pildi formaate

### Samm 2: Backend Deploy

1. **Kontrolli backend koodi**
   ```bash
   # Kontrolli, et chat route on lisatud
   cat backend/index.js | grep "chatRoutes"
   ```

2. **Deploy Railway'le**
   ```bash
   # Kui kasutad Railway, siis push GitHubile käivitab automaatse deploy'i
   git add .
   git commit -m "Add chat system"
   git push origin <your-branch>
   ```

3. **Testi backend'i**
   ```bash
   # Testi health check'i
   curl https://free-to-hang-production.up.railway.app/
   
   # Peaks vastama:
   # { "message": "Free to Hang API töötab!", ... }
   ```

### Samm 3: Frontend Testimine

1. **Käivita äpp**
   ```bash
   npm start
   # või
   npx expo start
   ```

2. **Ava plaan, millel on chat**
   - Vali mõni plaan, kus oled osaleja
   - Ava plaani details leht
   - Peaks nägema chat'i komponenti

3. **Testi chat'i**
   - Saada teksti sõnum
   - Saada pilt
   - Vasta sõnumile (reply)
   - Lisa reaktsioon (long-press sõnumil)
   - Muuda oma sõnumit
   - Kustuta sõnum

### Samm 4: Real-time Testimine

1. **Ava sama plaan kahel seadmel/kasutajal**
2. **Saada sõnum ühelt kasutajalt**
3. **Kontrolli, et teine kasutaja näeb sõnumit koheselt**
4. **Testi reaktsioone real-time'is**

## 🔧 Troubleshooting

### Probleem: Sõnumid ei lae

**Kontroll:**
```typescript
// Vaata console logisid
// Peaks nägema:
// 🔄 Loading chat for plan <planId>
// 📡 Subscribing to chat <planId>
// ✅ Fetched X messages for plan <planId>
```

**Lahendus:**
- Kontrolli, et kasutaja on plaani participant
- Kontrolli Supabase RLS poliitikaid
- Vaata backend logi Railway dashboard'is

### Probleem: Real-time ei tööta

**Kontroll:**
```typescript
// Vaata console logisid
// Peaks nägema:
// 📡 Chat subscription status for <planId>: SUBSCRIBED
```

**Lahendus:**
1. Kontrolli Supabase Realtime seadistusi
2. Veendu, et Realtime on enabled projektis
3. Vaata Supabase Dashboard > Settings > API > Realtime

### Probleem: Authentication error

**Kontroll:**
```typescript
// Vaata backend logi
// Peaks nägema:
// 🔑 Chat Auth - Token received: Yes
// 🔑 Chat Auth - Validation: Success
```

**Lahendus:**
1. Kontrolli, et `SUPABASE_ANON_KEY` on backend'is seatud
2. Veendu, et kasutaja on sisse logitud
3. Kontrolli token'i aegumist

### Probleem: Pildid ei laadi

**Kontroll:**
- Kontrolli Storage bucket'i olemasolu
- Kontrolli Storage policies

**Lahendus:**
1. Käivita uuesti `/supabase/chat-schema.sql` storage osa
2. Kontrolli bucket nime: `chat-images`
3. Veendu, et bucket on public

## 📊 Andmebaasi Päringud

### Vaata kõiki sõnumeid
```sql
SELECT 
  cm.*,
  u.name as user_name,
  u.avatar_url
FROM chat_messages cm
JOIN users u ON cm.user_id = u.id
WHERE cm.plan_id = '<your-plan-id>'
ORDER BY cm.created_at DESC;
```

### Vaata reaktsioone
```sql
SELECT 
  cr.*,
  cm.content as message_content,
  u.name as user_name
FROM chat_reactions cr
JOIN chat_messages cm ON cr.message_id = cm.id
JOIN users u ON cr.user_id = u.id
WHERE cm.plan_id = '<your-plan-id>';
```

### Vaata lugemata sõnumeid
```sql
SELECT * FROM chat_unread_counts 
WHERE plan_id = '<your-plan-id>' 
AND user_id = '<your-user-id>';
```

## 🧪 Testimise Checklist

### Põhifunktsionaalsus
- [ ] Sõnumi saatmine töötab
- [ ] Sõnumid ilmuvad kõigile kasutajatele
- [ ] Long-press menüü avaneb
- [ ] Emoji reaktsioonid töötavad
- [ ] Reply funktsioon töötab
- [ ] Sõnumi muutmine töötab
- [ ] Sõnumi kustutamine töötab

### Real-time
- [ ] Uued sõnumid ilmuvad automaatselt
- [ ] Reaktsioonid uuenevad real-time'is
- [ ] Muudetud sõnumid uuenevad
- [ ] Kustutatud sõnumid kaovad

### Pildi Funktsioonid
- [ ] Kaamera avamine töötab
- [ ] Galerii avamine töötab
- [ ] Pildi üles laadimine töötab
- [ ] Pilt kuvatakse sõnumis
- [ ] Pildi suurendamine töötab

### Lugemise Staatus
- [ ] Sõnumid märgitakse lugetuks
- [ ] Lugemata sõnumite arv on korrektne
- [ ] Read receipts uuenevad

## 📈 Järgmised Sammud

### Lähitulevik
1. **Teavitused** - Push notifications uute sõnumite puhul
2. **Typing Indicators** - Näita, kui keegi kirjutab
3. **Message Search** - Sõnumite otsing
4. **Voice Messages** - Heli sõnumid (UI on juba olemas)

### Pikaajaline
1. **End-to-end Encryption** - Krüpteerimine
2. **Message Pinning** - Sõnumite kinnitus
3. **Polls** - Küsitlused chatis
4. **@Mentions** - Kasutajate märgistamine
5. **File Attachments** - Failide saatmine

## 🎯 Jõudluse Optimeerimine

### Kui chat muutub aeglaseks:

1. **Pagination** - Implementeeri cursor-based pagination
   ```typescript
   // Lae ainult viimased 50 sõnumit
   fetchMessages(planId, { limit: 50 });
   
   // Lae vanemaid sõnumeid
   fetchMessages(planId, { limit: 50, before: oldestMessageId });
   ```

2. **Virtual List** - Kasuta virtualizeerimist pikkade sõnumite listide jaoks

3. **Image Optimization** - Kompresseeri pilte enne üles laadimist

4. **Debouncing** - Debounce typing indicators

## 📚 Dokumentatsioon

- **Arhitektuur**: `/docs/CHAT_SYSTEM_DESIGN.md`
- **API Endpoints**: Vaata `/backend/routes/chat.js` kommentaare
- **Database Schema**: `/supabase/chat-schema.sql`
- **Frontend Store**: `/store/chatStore.ts`

## 🤝 Abi Vajadus

Kui tekib probleeme:

1. **Kontrolli console logisid** - Nii frontend kui backend
2. **Vaata Supabase Dashboard'i** - Table Editor, API logs
3. **Kontrolli Railway logisid** - Backend errors
4. **Testi RLS policies** - SQL Editor'is

## ✨ Õnnitlused!

Oled edukalt implementeerinud täisfunktsionaalse real-time chat süsteemi! 🎉

Chat on nüüd valmis kasutamiseks ja peaks töötama sarnaselt populaarsetele sõnumite äppidele nagu WhatsApp või Messenger.

