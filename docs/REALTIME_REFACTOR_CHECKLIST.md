# REALTIME REFACTOR - IMPLEMENTATION CHECKLIST

> **Codex:** Tööta selle checklisti järgi samm-sammult. ✅ iga tehtud samm.

## 🎯 PRIORITEET #1: CHAT LOOP FIX (30-60 min)

### [ ] 1. Eemalda MAX_CHAT_CHANNELS piirang
**Fail:** `store/chatStore.ts`
- [ ] Eemalda rida 142: `const MAX_CHAT_CHANNELS = 3;`
- [ ] Eemalda read 143: `const activeChatChannelOrder: string[] = [];`
- [ ] Eemalda read 696-706: kood mis kontrollib channel limiti
- [ ] Eemalda funktsioonid: `addActiveChatPlan`, `removeActiveChatPlan`
- [ ] Commit: `fix: remove MAX_CHAT_CHANNELS limit causing restart loop`

### [ ] 2. Paranda unsubscribeFromChat cleanup
**Fail:** `store/chatStore.ts` (rida 908)
```typescript
// KONTROLLI et see rida ON OLEMAS ja töötab ALATI:
if (!options?.preserveDesired) {
  desiredChatSubscriptions.delete(planId); // <-- PEAB OLEMA!
}
```
- [ ] Veendu et `desiredChatSubscriptions.delete()` kutsutakse
- [ ] Commit: `fix: ensure desiredChatSubscriptions cleanup in unsubscribe`

### [ ] 3. Lisa guard subscribeToChat'i
**Fail:** `store/chatStore.ts` (rida 689)
```typescript
subscribeToChat: (planId: string) => {
  const state = get();
  
  // LISA SEE KONTROLL:
  if (state.subscriptions[planId]) {
    const existingChannel = state.subscriptions[planId];
    const channelState = existingChannel?.state;
    
    if (channelState === 'joined') {
      console.log(`✅ Already subscribed: ${planId}`);
      return; // <-- VÄGA OLULINE!
    }
  }
  // ... rest of code
}
```
- [ ] Lisa guard algusesse
- [ ] Commit: `fix: add guard against duplicate chat subscriptions`

### [ ] 4. Paranda handleChatChannelStatus
**Fail:** `store/chatStore.ts` (rida 985)
```typescript
// LISA SEE IF:
if (status === 'CHANNEL_STATE_CHANGE') {
  return; // Ära restardi state change'i puhul
}

// MUUDA SEE:
if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
  // LISA SEE KONTROLL:
  if (!desiredChatSubscriptions.has(planId)) {
    console.log(`⚠️ Skipping restart - no longer desired`);
    return;
  }
  // ... rest
}
```
- [ ] Lisa CHANNEL_STATE_CHANGE handling
- [ ] Lisa desiredSubscriptions kontroll
- [ ] Commit: `fix: improve chat channel status handling`

### [ ] 5. TEST: Chat Loop Fix
- [ ] Käivita app
- [ ] Ava plan chat
- [ ] Vaata loge: **EI TOHIKS** olla restart loop'i
- [ ] Ava 4+ plani chat'd: **KÕIK** peavad töötama
- [ ] Sulge chat: **PEAB** cleanly sulgema
- [ ] Dokumenteeri tulemused faili: `TEST_RESULTS.md`

---

## 🎯 PRIORITEET #2: DUPLICATE STARTS FIX (15-30 min)

### [ ] 6. Eemalda duplicate restart AuthContext'ist
**Fail:** `contexts/AuthContext.tsx` (read 128-139)
```typescript
// KOMMENTEERI VÄLJA VÕI EEMALDA:
// console.log('🔄 Restarting realtime subscriptions after sign-in');
// setTimeout(() => {
//   try {
//     startHangRealtime();
//     startPlansRealtime(session.user.id);
//     startFriendsRealtime(session.user.id);
//   } catch (error) { ... }
// }, 1000);
```
- [ ] Kommenteeri välja või eemalda read 128-139
- [ ] Commit: `fix: remove duplicate realtime starts from AuthContext`

### [ ] 7. Lisa guards kõigisse startRealTimeUpdates
**Failid:** `store/hangStore.ts`, `store/plansStore.ts`, `store/friendsStore.ts`

**hangStore.ts:**
```typescript
if (isStartingRealtime || statusChannel) {
  console.log('⏸️ Already running');
  return;
}
```

**plansStore.ts:**
```typescript
if (get().subscriptionStatus.isSubscribed) {
  console.log('🛑 Already active');
  return;
}
if (plansChannel || updatesChannel) {
  await stopAllRealtimeChannels();
}
```

**friendsStore.ts:**
```typescript
if (isStartingRealTime || friendRequestsChannel) {
  console.log('🛑 Already running');
  return;
}
```
- [ ] Lisa guard hangStore'i
- [ ] Lisa guard plansStore'i
- [ ] Lisa guard friendsStore'i
- [ ] Commit: `fix: add guards to prevent duplicate realtime starts`

### [ ] 8. TEST: Auth Flow
- [ ] Logi välja
- [ ] Logi sisse
- [ ] Vaata loge: realtime peaks startima **AINULT 1x**
- [ ] Kõik channels peaksid olema SUBSCRIBED
- [ ] Dokumenteeri: `TEST_RESULTS.md`

---

## 🎯 PRIORITEET #3: HEALTH & RETRY OPTIMIZATION (30-45 min)

### [ ] 9. Vähenda health check sagedust
**Kõik store'd:**
```typescript
// MUUDA:
const HEALTH_CHECK_INTERVAL = 30000; // 30s
// UUELE:
const HEALTH_CHECK_INTERVAL = 60000; // 60s
```
- [ ] chatStore.ts (rida 1061)
- [ ] plansStore.ts (rida 1417)
- [ ] hangStore.ts (rida 631)
- [ ] friendsStore.ts (rida 751)
- [ ] Commit: `perf: reduce health check interval to 60s`

### [ ] 10. Paranda retry delays
**Kõik store'd:**
```typescript
// MUUDA:
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];
const MAX_RETRIES = 5;
// UUELE:
const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000, 60000];
const MAX_RETRIES = 3;
```
- [ ] chatStore.ts (rida 136)
- [ ] plansStore.ts (rida 239)
- [ ] hangStore.ts (rida 70)
- [ ] friendsStore.ts (rida 59)
- [ ] Commit: `perf: improve retry delays and reduce max retries`

### [ ] 11. Lisa jitter
**Kõik store'd:** (scheduleRestart funktsioonides)
```typescript
function getRetryDelay(attempt: number): number {
  const baseDelay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  const jitter = Math.random() * 1000;
  return baseDelay + jitter;
}

// Kasuta seda delay asemel
```
- [ ] Lisa jitter chatStore'i
- [ ] Lisa jitter plansStore'i
- [ ] Lisa jitter hangStore'i
- [ ] Lisa jitter friendsStore'i
- [ ] Commit: `perf: add jitter to retry delays`

### [ ] 12. TEST: Stress Test
- [ ] Jäta app käima 30 min
- [ ] Navigeeri tabide vahel 20x
- [ ] Ava/sulge plans 20x
- [ ] Vaata loge: **EI TOHIKS** olla excessive retry'sid
- [ ] Vaata memory: **EI TOHIKS** kasvada
- [ ] Dokumenteeri: `TEST_RESULTS.md`

---

## 🎯 PRIORITEET #4: CLEANUP & POLISH (30-45 min)

### [ ] 13. Paranda ChatView cleanup
**Fail:** `components/chat/ChatView.tsx` (rida 92-95)
```typescript
return () => {
  console.log(`🔌 Cleanup for chat ${plan.id}`);
  unsubscribeFromChat(plan.id, { preserveDesired: false }); // <-- preserveDesired: false!
};
```
- [ ] Veendu et preserveDesired = false
- [ ] Commit: `fix: ensure proper chat cleanup on unmount`

### [ ] 14. Lisa globaalne cleanup
**Fail:** `app/(tabs)/_layout.tsx` (rida 49-54)
```typescript
return () => {
  isMounted = false;
  console.log('⏹️ Tab layout cleanup');
  
  stopHangRealtime();
  stopFriendsRealtime();
  
  // LISA:
  const plansStore = usePlansStore.getState();
  plansStore.stopRealTimeUpdates();
  
  const chatStore = useChatStore.getState();
  Object.keys(chatStore.subscriptions || {}).forEach(planId => {
    chatStore.unsubscribeFromChat(planId, { preserveDesired: false });
  });
};
```
- [ ] Lisa plans cleanup
- [ ] Lisa chat cleanup
- [ ] Commit: `fix: add comprehensive cleanup to tab layout`

### [ ] 15. Vähenda log spam'i
**Kõik store'd:**
```typescript
// MUUDA health check log'id:
// console.log('💓 Health check...') -> Ainult error states
// console.log('📡 Status...') -> Ainult error states
```
- [ ] Vähenda chatStore loge
- [ ] Vähenda plansStore loge
- [ ] Vähenda hangStore loge
- [ ] Vähenda friendsStore loge
- [ ] Commit: `chore: reduce log verbosity`

### [ ] 16. TEST: Memory Leak
- [ ] Käivita app
- [ ] Navigeeri tabide vahel 50x
- [ ] Vaata memory usage graafik
- [ ] **EI TOHIKS** olla memory leak'e
- [ ] Dokumenteeri: `TEST_RESULTS.md`

---

## ✅ FINAL CHECKLIST

### Testing
- [ ] Chat Loop Fix Test ✅
- [ ] Auth Flow Test ✅
- [ ] Stress Test ✅
- [ ] Memory Leak Test ✅
- [ ] Manual testing 30min

### Documentation
- [ ] Loo fail: `docs/REALTIME_REFACTOR_COMPLETION_REPORT.md`
- [ ] Loo fail: `docs/TEST_RESULTS.md`
- [ ] Uuenda: `README.md` (kui vaja)

### Code Quality
- [ ] Käivita linter: `npm run lint` (või `yarn lint`)
- [ ] Paranda kõik linter errors
- [ ] Review kõik muudatused
- [ ] Test production build'is

---

## 📝 COMPLETION REPORT TEMPLATE

Loo fail: `docs/REALTIME_REFACTOR_COMPLETION_REPORT.md`

```markdown
# REALTIME REFACTOR - COMPLETION REPORT

## ✅ COMPLETED

### Phase 1: Chat Loop Fix
- [x] Removed MAX_CHAT_CHANNELS
- [x] Fixed cleanup logic
- [x] Added guards
- **Result:** Chat channels no longer restart in loop

### Phase 2: Duplicate Starts
- [x] Removed AuthContext restart
- [x] Added guards to all stores
- **Result:** Realtime starts only once

### Phase 3: Health & Retry
- [x] Health check 60s
- [x] Better retry delays
- [x] Added jitter
- **Result:** Less resource usage

### Phase 4: Cleanup
- [x] Fixed ChatView cleanup
- [x] Added global cleanup
- [x] Reduced log spam
- **Result:** Cleaner code

## 📊 TEST RESULTS

### Chat Loop Fix Test
- Status: ✅ PASS
- Details: No restart loops observed
- Logs: Clean, only message events

### Auth Flow Test
- Status: ✅ PASS
- Details: Single realtime start
- Logs: No duplicates

### Stress Test
- Status: ✅ PASS
- Details: 30min stable
- Memory: Stable ~50MB

### Memory Leak Test
- Status: ✅ PASS
- Details: 50x navigation
- Memory: No leaks

## 🐛 BUGS FOUND
- None (või kirjelda)

## ⚠️ KNOWN ISSUES
- None (või kirjelda)

## 🔮 RECOMMENDATIONS
1. Consider global RealtimeManager (tulevik)
2. Add Supabase monitoring
3. Consider analytics

## 📝 BREAKING CHANGES
- None

---
**Completed:** 2025-11-21
**Time Spent:** X hours
**Status:** ✅ Ready for production
```

---

## 🎉 DONE?

Kui kõik checklist'i punktid on ✅:

1. **Commit kõik muudatused**
2. **Loo completion report**
3. **Test production build**
4. **Teatame kasutajale et valmis!**

---

**Codex:** Tööta seda checkisti järgi samm-sammult. Ära kiirusta!

