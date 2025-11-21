# REALTIME SYSTEM REFACTOR - QUICK SUMMARY

## 🚨 KRIITILINE PROBLEEM

Su chat süsteem on **restart loop'is**. Logides näeme:
- 790+ restart katset sama plani jaoks
- Pattern: `CLOSED -> restart -> CLOSED -> restart -> ...`
- See HÄVITAB battery life ja performance'i

## 🎯 PEAMISED PÕHJUSED

### 1. Chat MAX_CHANNELS Conflict
```typescript
// chatStore.ts:142
const MAX_CHAT_CHANNELS = 3;

// Kui avad 4. plani chat, sulgeb 1.
// Aga 1. proovib restartida
// -> Loop algab
```

### 2. Puuduv Cleanup
```typescript
// ChatView.tsx:94
unsubscribeFromChat(plan.id);

// Aga ei eemalda desiredChatSubscriptions'ist!
// -> Restart loogika triggerdub
```

### 3. Duplikeeritud Startid
```typescript
// 3 kohta käivitavad realtime'd:
// 1. app/(tabs)/_layout.tsx:40
// 2. contexts/AuthContext.tsx:130-139  
// 3. Võimalik ka mujal
```

## 📋 KIIRE LAHENDUS (30 min)

### STEP 1: Paranda Chat Loop
```bash
# Ava: store/chatStore.ts

# A) EEMALDA MAX_CHAT_CHANNELS (rida 142)
- const MAX_CHAT_CHANNELS = 3;

# B) EEMALDA channel limit loogika (read 696-706)
- if (currentSubscriptions >= MAX_CHAT_CHANNELS) { ... }

# C) PARANDA unsubscribeFromChat (rida 908)
# Lisa ALATI desiredSubscriptions cleanup:
if (!options?.preserveDesired) {
  desiredChatSubscriptions.delete(planId); // See rida PEAB olema!
}
```

### STEP 2: Eemalda Duplikaadid
```bash
# Ava: contexts/AuthContext.tsx

# KOMMENTEERI VÄLJA read 128-139:
// Restart realtime after sign-in
// setTimeout(() => {
//   startHangRealtime();
//   startPlansRealtime(session.user.id);
//   startFriendsRealtime(session.user.id);
// }, 1000);
```

### STEP 3: Test
```bash
# 1. Käivita app
# 2. Ava plan chat
# 3. Vaata loge - ei tohiks olla loop'i
# 4. Ava 4+ plani chat'd - kõik peaksid töötama
```

## 📊 LOGI ANALÜÜS

### ENNE (Sinu praegune olukord):
```
LOG  🔒 Chat channel closed for plan XXX
LOG  📡 Unsubscribing from chat XXX  
LOG  📡 Chat subscription status: CLOSED
LOG  🔄 Scheduling chat channel restart in 1000ms (attempt 1/5)
[REPEAT 790x] <-- PROBLEEM!!!
```

### PÄRAST (Peaks olema):
```
LOG  📡 Subscribing to chat XXX
LOG  📡 Chat subscription status: SUBSCRIBED
LOG  ✅ Chat channel SUBSCRIBED: XXX
[Siis vaikne - ainult message events]
```

## 🔍 TÄIELIK JUHEND

Vaata detailset plaani:
👉 `docs/REALTIME_SYSTEM_REFACTOR_GUIDE.md`

Seal on:
- ✅ 6 phase'i implementatsiooni plaan
- ✅ Testid iga phase'i jaoks
- ✅ Täpsed code muudatused
- ✅ Success criteria

## ⚡ TL;DR

1. **EEMALDA** `MAX_CHAT_CHANNELS = 3`
2. **PARANDA** `unsubscribeFromChat` et cleaniks `desiredChatSubscriptions`
3. **EEMALDA** duplicate realtime startid `AuthContext'ist`
4. **TEST** et chat ei loobi enam

**Aeg:** 30 min quick fix, 4-6h full refactor
**Prioriteet:** 🔥 KRITILINE
**Mõju:** App muutub stabiilseks

---

## 📝 CODEX: Pärast implementatsiooni

Loo fail: `docs/REALTIME_REFACTOR_COMPLETION_REPORT.md`

Kirjelda:
- ✅ Mis töötab nüüd
- 🐛 Mis bugidev leiti  
- 📊 Test tulemused
- ⚠️ Järelejäänud probleemid (kui on)

---
**See on lühike versioon. Detailid:** `REALTIME_SYSTEM_REFACTOR_GUIDE.md`

