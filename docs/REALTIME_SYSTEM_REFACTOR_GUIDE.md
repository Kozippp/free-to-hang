# REALTIME SYSTEM REFACTOR - TERVIKLIK PARANDUSKAVA

## OLUKORRA ANALÜÜS

### ⚠️ KRIITILISED PROBLEEMID

#### 1. **CHAT CHANNEL RESTART LOOP** (Kõige tõsisem)
**Probleem:** Chat channel sulgub kohe pärast avamist ja restartib lõputult
- Logides näeme 790+ restart katset sama plani jaoks
- Pattern: `CLOSED -> restart -> CLOSED -> restart -> ...`
- Põhjused:
  - ChatView.tsx subscribib useEffect'is (rida 89)
  - useEffect triggerdub iga kord kui dependencies muutuvad
  - Cleanup unsubscribib (rida 94)
  - Restart loogika chatStore'is (rida 1013-1044) triggrib kohe
  - MAX_CHAT_CHANNELS = 3 põhjustab vanema kanali sulgemise

**Mõju:**
- CPU 100% kasutus
- Battery drain
- Network spam
- Supabase realtime quota kulumine
- App crashib lõpuks

#### 2. **DUPLIKEERITUD REALTIME STARTID**
**Probleem:** Sama realtime subscription starditakse mitmest kohast
- `app/(tabs)/_layout.tsx` (rida 40): startib hang realtime
- `contexts/AuthContext.tsx` (rida 130-139): restartib KÕIK realtime'd pärast sign-in
- Võimalik et plani vaatesse minnes startitakse uuesti

**Mõju:**
- Mitu paralleelset subscriptionit samale channel'ile
- Rate limiting
- Duplikeeritud event handling
- Memory leaks

#### 3. **LIIGA AGRESSIIVNE RETRY LOOGIKA**
**Probleem:** Iga store's on oma iseseisvad retry süsteemid
- chatStore: 5 retryt, 1s-30s vahed
- plansStore: 5 retryt, 1s-30s vahed
- hangStore: 5 retryt, 1s-30s vahed
- friendsStore: 5 retryt, 1s-30s vahed
- Health check KÕIGIL: iga 30s

**Mõju:**
- 4 health checki jooksevad paralleelselt iga 30s
- Kui üks channel fail'ib, triggerdub kõigi retry
- Eksponentiaalne resource kasutus

#### 4. **PUUDUB GLOBAALNE KOORDINEERIMINE**
**Probleem:** Iga store teeb oma asja
- Pole ühist state managementi
- Pole koordineeritud cleanup'i
- Pole ühist error handlingut
- Pole throttling'ut

## LAHENDUSKAVA

### PHASE 1: CHAT CHANNEL RESTART LOOP FIX (PRIORITEET #1)

#### 1.1. Eemalda MAX_CHAT_CHANNELS piirang
**Fail:** `store/chatStore.ts`
**Muudatus:**
```typescript
// EEMALDA:
const MAX_CHAT_CHANNELS = 3;
const activeChatChannelOrder: string[] = [];

// Eemalda ka kood mis seda kasutab (read 696-706):
// const currentSubscriptions = Object.keys(state.subscriptions).length;
// if (currentSubscriptions >= MAX_CHAT_CHANNELS) { ... }
```

**Põhjendus:** See põhjustab loop'i kui kasutajal on rohkem kui 3 plani lahti

#### 1.2. Lisa desiredSubscriptions puhastumine
**Fail:** `store/chatStore.ts`
**Muudatus:**
```typescript
// Funktsioonis unsubscribeFromChat (rida 908)
unsubscribeFromChat: (planId: string, options?: { preserveDesired?: boolean }) => {
  const state = get();
  const channel = state.subscriptions[planId];
  
  if (channel) {
    console.log(`📡 Unsubscribing from chat ${planId}`);
    supabase.removeChannel(channel);
    
    set(state => {
      const { [planId]: removed, ...remainingSubscriptions } = state.subscriptions;
      return { subscriptions: remainingSubscriptions };
    });
  }
  
  // KRIITILINE: Alati eemalda desiredSubscriptions'ist
  // välja arvatud kui preserveDesired = true
  if (!options?.preserveDesired) {
    desiredChatSubscriptions.delete(planId);
  }
  
  clearChatRestart(planId);
  delete chatRetryAttempts[planId];
  stopChatHealthCheckIfIdle();
  // EEMALDA: removeActiveChatPlan kutse, sest MAX_CHAT_CHANNELS kaob
}
```

#### 1.3. Vigade käsitlemine subscribeToChat's
**Fail:** `store/chatStore.ts`
**Muudatus:**
```typescript
subscribeToChat: (planId: string) => {
  const state = get();
  desiredChatSubscriptions.add(planId);
  clearChatRestart(planId);
  chatRetryAttempts[planId] = 0;
  ensureChatHealthCheckRunning();
  
  // LISA: Kontrolli kas on juba subscribitud
  if (state.subscriptions[planId]) {
    const existingChannel = state.subscriptions[planId];
    const channelState = existingChannel?.state;
    
    if (channelState === 'joined') {
      console.log(`✅ Chat already subscribed and joined: ${planId}`);
      return;
    } else {
      console.log(`🔄 Chat subscription exists but not joined (${channelState}), cleaning up...`);
      supabase.removeChannel(existingChannel);
      set(state => {
        const { [planId]: removed, ...remainingSubscriptions } = state.subscriptions;
        return { subscriptions: remainingSubscriptions };
      });
    }
  }
  
  console.log(`📡 Subscribing to chat ${planId}`);
  
  try {
    const channel = supabase
      .channel(`chat:${planId}`)
      // ... rest of channel setup
      .subscribe((status) => {
        handleChatChannelStatus(planId, status);
      });
    
    // Store subscription
    set(state => ({
      subscriptions: {
        ...state.subscriptions,
        [planId]: channel
      }
    }));
    
  } catch (error) {
    console.error(`❌ Error creating chat channel for ${planId}:`, error);
    desiredChatSubscriptions.delete(planId);
  }
},
```

#### 1.4. Paranda handleChatChannelStatus
**Fail:** `store/chatStore.ts`
**Muudatus:**
```typescript
function handleChatChannelStatus(planId: string, status: string) {
  console.log(`📡 Chat subscription status for ${planId}:`, status);

  if (status === 'SUBSCRIBED') {
    chatRetryAttempts[planId] = 0;
    clearChatRestart(planId);
    console.log(`✅ Chat channel SUBSCRIBED: ${planId}`);
    return;
  }

  // LISA: Kontrolli kas on CHANNEL_STATE_CHANGE
  if (status === 'CHANNEL_STATE_CHANGE') {
    const state = useChatStore.getState();
    const channel = state.subscriptions[planId];
    const channelState = channel?.state;
    console.log(`🔄 Chat channel state changed: ${planId} -> ${channelState}`);
    
    // Kui state on 'joined', ei ole vaja midagi teha
    if (channelState === 'joined') {
      return;
    }
    return; // Ära restardi CHANNEL_STATE_CHANGE puhul
  }

  if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
    console.log(`❌ Chat channel ${status} for plan ${planId}`);

    // KRIITILINE: Ära restardi kui pole enam desired
    if (!desiredChatSubscriptions.has(planId)) {
      console.log(`⚠️ Skipping restart - chat ${planId} no longer desired`);
      return;
    }

    useChatStore.getState().unsubscribeFromChat(planId, { preserveDesired: true });
    
    // LISA: Ainult restardi kui on TÕESTI vaja
    const attempts = chatRetryAttempts[planId] || 0;
    if (attempts < MAX_CHAT_CHANNEL_RETRIES) {
      scheduleChatRestart(planId);
    } else {
      console.error(`❌ Chat channel for ${planId} failed after ${attempts} attempts - giving up`);
      desiredChatSubscriptions.delete(planId);
    }
  }
}
```

### PHASE 2: REALTIME DUPLICATE STARTS FIX

#### 2.1. Eemalda realtime restart AuthContext'ist
**Fail:** `contexts/AuthContext.tsx`
**Muudatus:**
```typescript
// KOMMENTEERI VÄLJA read 128-139:
if (event === 'SIGNED_IN' && session?.user) {
  console.log('✅ User signed in:', session.user.email);
  if (!hasCheckedOnboarding) {
    setHasCheckedOnboarding(false);
    setIsCheckingOnboarding(false);
    setNavigationReady(false);
  }

  // EEMALDA/KOMMENTEERI VÄLJA:
  // console.log('🔄 Restarting realtime subscriptions after sign-in');
  // setTimeout(() => {
  //   try {
  //     startHangRealtime();
  //     startPlansRealtime(session.user.id);
  //     startFriendsRealtime(session.user.id);
  //     console.log('✅ Realtime subscriptions restarted after sign-in');
  //   } catch (error) {
  //     console.error('❌ Error restarting realtime subscriptions:', error);
  //   }
  // }, 1000);
}
```

**Põhjendus:** Tab layout juba käivitab need, duplikaat pole vaja

#### 2.2. Lisa guard kõigisse startRealTimeUpdates funktsioonidesse

**Fail:** `store/hangStore.ts`
```typescript
startRealTimeUpdates: async () => {
  // Guard - kui juba käivitatud, ära käivita uuesti
  if (isStartingRealtime || statusChannel) {
    console.log('⏸️ Hang real-time already running - skipping');
    return;
  }
  // ... rest of code
}
```

**Fail:** `store/plansStore.ts`
```typescript
startRealTimeUpdates: async (userId: string) => {
  const currentState = get();
  if (currentState.subscriptionStatus.isSubscribed) {
    console.log('🛑 Plans real-time subscriptions already active');
    return;
  }
  
  // LISA: Kontrolli kas channels juba eksisteerivad
  if (plansChannel || updatesChannel) {
    console.log('⚠️ Plans channels already exist, cleaning up first...');
    await stopAllRealtimeChannels();
  }
  // ... rest of code
}
```

**Fail:** `store/friendsStore.ts`
```typescript
startRealTimeUpdates: async () => {
  if (isStartingRealTime || friendRequestsChannel) {
    console.log('🛑 Friend real-time already running - skipping');
    return;
  }
  // ... rest of code
}
```

### PHASE 3: HEALTH CHECK OPTIMISEERIMISED

#### 3.1. Vähenda health check sagedust
**Kõik store'd:**
```typescript
// MUUDA:
const HEALTH_CHECK_INTERVAL = 30000; // Enne: 30s
// UUELE:
const HEALTH_CHECK_INTERVAL = 60000; // Nüüd: 60s
```

#### 3.2. Lisa debouncing health check'idele
**Kõik store'd:**
```typescript
let lastHealthCheckTime = 0;
const HEALTH_CHECK_THROTTLE = 5000; // 5s

function runHealthCheck() {
  const now = Date.now();
  if (now - lastHealthCheckTime < HEALTH_CHECK_THROTTLE) {
    console.log('⏭️ Skipping health check - throttled');
    return;
  }
  lastHealthCheckTime = now;
  
  // ... existing health check code
}
```

#### 3.3. Ühenda health checkid üheks
**Uus fail:** `lib/realtime-health-monitor.ts`
```typescript
// TULEVIK: Kõigi store'de health checkid ühte kohta
// Praegu väljaspool scope'i, aga soovitus tulevikuks

interface ChannelHealth {
  name: string;
  state: string | null;
  lastCheck: number;
  failures: number;
}

class RealtimeHealthMonitor {
  private channels: Map<string, ChannelHealth> = new Map();
  private interval: ReturnType<typeof setInterval> | null = null;
  
  register(name: string, getState: () => string | null) { }
  unregister(name: string) { }
  start() { }
  stop() { }
  private check() { }
}

export const healthMonitor = new RealtimeHealthMonitor();
```

### PHASE 4: RETRY LOOGIKA PARANDUSED

#### 4.1. Eksponentsiaalne backoff kõigile
**Kõik store'd:**
```typescript
// Praegune:
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

// MUUDA:
const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000, 60000]; // Aeglasem start
const MAX_RETRIES = 3; // Vähenda 5-lt 3-le
```

#### 4.2. Lisa jitter retry delay'dele
**Kõik store'd:**
```typescript
function getRetryDelay(attempt: number): number {
  const baseDelay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  const jitter = Math.random() * 1000; // 0-1s jitter
  return baseDelay + jitter;
}
```

### PHASE 5: CLEANUP PARANDUSED

#### 5.1. Lisa cleanup kõigisse unmount'idesse
**Fail:** `components/chat/ChatView.tsx`
```typescript
useEffect(() => {
  // ... existing code
  
  return () => {
    console.log(`🔌 Cleanup for chat ${plan.id}`);
    
    // KRIITILINE: Eemalda ka desiredSubscriptions'ist
    const chatStore = useChatStore.getState();
    chatStore.unsubscribeFromChat(plan.id, { preserveDesired: false });
  };
}, [plan.id, currentUserId, isAuthenticated]);
```

#### 5.2. Lisa globaalne cleanup tab unmount'is
**Fail:** `app/(tabs)/_layout.tsx`
```typescript
return () => {
  isMounted = false;
  console.log('⏹️ Tab layout cleanup - stopping ALL realtime');
  
  // Stop all realtime systems
  stopHangRealtime();
  stopFriendsRealtime();
  
  // LISA: Stop ka plans realtime
  const plansStore = usePlansStore.getState();
  plansStore.stopRealTimeUpdates();
  
  // LISA: Stop ka chat subscriptions
  const chatStore = useChatStore.getState();
  const subscriptions = chatStore.subscriptions || {};
  Object.keys(subscriptions).forEach(planId => {
    chatStore.unsubscribeFromChat(planId, { preserveDesired: false });
  });
};
```

### PHASE 6: LOGGING PARANDUSED

#### 6.1. Lisa log levels
**Kõik store'd:**
```typescript
// Lisa faili algusesse:
const LOG_LEVEL = __DEV__ ? 'debug' : 'error';

function logDebug(...args: any[]) {
  if (LOG_LEVEL === 'debug') {
    console.log(...args);
  }
}

function logError(...args: any[]) {
  console.error(...args);
}

function logWarn(...args: any[]) {
  if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'warn') {
    console.warn(...args);
  }
}

// Kasuta neid kõikjal:
// console.log -> logDebug
// console.error -> logError
// console.warn -> logWarn
```

#### 6.2. Vähenda spam loge
**Kõik store'd:**
```typescript
// Eemalda või muuda debug level'ile:
// - "📡 Chat subscription status" -> ainult error states
// - "💓 Health check..." -> ainult kui on probleem
// - "🔄 Scheduling restart..." -> ainult esimesel katsel
```

## TESTIMISE PLAAN

### 1. Chat Loop Fix Test
```
1. Ava app
2. Ava plan details
3. Ava chat
4. Vaata loge - ei tohiks olla CLOSED/restart loop'i
5. Sulge chat
6. Vaata loge - peaks cleanly sulgema
7. Ava uuesti - peaks cleanly avama
```

### 2. Multiple Plans Test
```
1. Ava 4+ plani chat'd järjest
2. Vaata loge - kõik peaksid olema SUBSCRIBED
3. Ei tohiks olla "Max channels reached" sõnumeid
4. Ei tohiks olla restart loop'e
```

### 3. Auth Flow Test
```
1. Logi välja
2. Logi sisse
3. Vaata loge - realtime peaks startima 1x (mitte 2x või 3x)
4. Kõik realtime'd peaksid olema SUBSCRIBED
```

### 4. Memory Leak Test
```
1. Ava app
2. Navigeeri erinevate tabide vahel 20x
3. Ava/sulge plan details 20x
4. Vaata memory usage - ei tohiks kasvada
5. Vaata active subscriptions - ei tohiks olla 20+
```

### 5. Stress Test
```
1. Ava app
2. Jäta mitu tundi töötama
3. Health check peaks töötama normaalselt
4. Ei tohiks olla excessive retry'sid
5. Log volume peaks olema normaalne
```

## SUCCESS CRITERIA

### Must-Have (Phase 1-2)
- ✅ Chat loop on ära parandatud (max 5 restart katset, siis annab alla)
- ✅ Ei ole duplicate realtime starte
- ✅ Maksimum 1 subscription per channel
- ✅ Cleanup töötab korralikult

### Should-Have (Phase 3-4)
- ✅ Health check on 60s intervalliga
- ✅ Retry loogika on aeglasem ja targem
- ✅ Jitter on lisatud

### Nice-to-Have (Phase 5-6)
- ✅ Logging on clean ja informatiivne
- ✅ Globaalne cleanup töötab
- ✅ Memory leakid on parandatud

## IMPLEMENTATSIOONI JÄRJEKORD

### 1. ESIMENE (KRITILINE): Chat Loop Fix
- Phase 1.1: Eemalda MAX_CHAT_CHANNELS
- Phase 1.2: Paranda unsubscribeFromChat
- Phase 1.3: Paranda subscribeToChat
- Phase 1.4: Paranda handleChatChannelStatus
- **TEST:** Chat Loop Fix Test

### 2. TEINE: Duplicate Starts Fix
- Phase 2.1: Eemalda AuthContext restart
- Phase 2.2: Lisa guards kõigile
- **TEST:** Auth Flow Test

### 3. KOLMAS: Health & Retry
- Phase 3: Health check 60s
- Phase 4: Retry loogika parandused
- **TEST:** Stress Test

### 4. NELJAS: Cleanup & Polish
- Phase 5: Cleanup parandused
- Phase 6: Logging parandused
- **TEST:** Memory Leak Test

## POST-IMPLEMENTATION

### Monitoring
Lisa Supabase dashboard'ile monitooringu:
- Realtime connections per user
- Connection duration
- Error rate
- Retry rate

### Dokumenteerimine
Uuenda README'des:
- Realtime arhitektuur
- Error handling strategy
- Testing guidelines

### Tulevik (Optional)
- Loo globaalne RealtimeManager
- Implementeeri health monitor
- Lisa analytics

## KOKKUVÕTE

Peamine probleem on **chat channel restart loop** mis põhjustab 790+ restart katset.
Lahendus:
1. Eemalda MAX_CHAT_CHANNELS piirang
2. Paranda cleanup loogika
3. Lisa paremad guardid
4. Vähenda aggressive retry loogika

**Eeldatav aeg:** 4-6 tundi
**Prioriteet:** KRITILINE
**Mõju:** Rakendus muutub stabiilseks ja battery-efficient'iks

---

## CODEX JUHISED

### 1. LOE KOGU DOKUMENT LÄBI
- Mõista probleemi scope'i
- Mõista dependencies't
- Mõista testing plaani

### 2. IMPLEMENTEERI JÄRJEKORRAS
- Alusta Phase 1'st (Chat Loop Fix)
- Testi iga phase'i eraldi
- Ära liigu edasi kui testid ei läbi

### 3. COMMIT STRATEGY
- Iga phase = 1 commit
- Clear commit messages
- Reference juhendi section'i

### 4. TESTING
- Käivita kõik testid pärast iga phase'i
- Dokumenteeri tulemused
- Kui test fail'ib, paranda enne edasi liikumist

### 5. LÕPUKOKKUVÕTE
**VÄGA OLULINE:** Pärast kõiki muudatusi loo fail:
`docs/REALTIME_REFACTOR_COMPLETION_REPORT.md`

Selles kirjelda:
- ✅ Mis sai tehtud
- ❌ Mis jäi tegemata
- 🐛 Mis bugid leiti
- 📊 Test tulemused
- 🔮 Soovitused tulevikuks
- ⚠️ Known issues
- 📝 Breaking changes (kui on)

---
**Autor:** AI Assistant
**Kuupäev:** 2025-11-21
**Versioon:** 1.0
**Status:** DRAFT - Ootab implementatsiooni

