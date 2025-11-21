# Real-time Functionality Improvements Guide

**For Engineer: GPT 5.1 Codex**  
**Date:** November 21, 2025  
**Priority:** HIGH - Production Stability  
**Estimated Time:** 6-8 hours

---

## 🎯 MISSION

Make the real-time subscription system **100% reliable and robust**. Currently, subscriptions sometimes disconnect and plans/invitations don't appear in real-time. Your job is to fix this.

---

## 📊 CURRENT STATE ANALYSIS

### Subscription Architecture

**plansStore:** 7 separate Supabase channels
- `plans` (INSERT events for new plans)
- `plan_updates` (main notification system)
- `plan_participants` (participant changes)
- `plan_polls` (poll changes)
- `plan_poll_votes` (vote changes)
- `invitation_polls` (invitation poll changes)
- `invitation_poll_votes` (invitation poll vote changes)

**chatStore:** Dynamic channels (1 per open chat)

**friendsStore:** 1 channel (friend_requests table)

**hangStore:** 1 channel + 10-second polling

### Subscription Initialization Flow

1. **AuthContext** - Starts on SIGNED_IN event (1s delay)
2. **TabLayout** - Starts hang realtime globally
3. **plans.tsx** - AppState listener + tab focus listener
4. **ChatView** - Component mount/unmount per chat

---

## 🔴 CRITICAL PROBLEMS IDENTIFIED

### Problem #1: Too Many Channels (ROOT CAUSE)
**Issue:** plansStore uses 7 separate channels  
**Impact:** Supabase realtime disconnects when too many channels are open  
**Solution:** Consolidate to 2-3 channels using plan_updates system better

### Problem #2: No Automatic Reconnection
**Issue:** When channel becomes `CHANNEL_ERROR`, `CLOSED`, or `TIMED_OUT`, only sets `isSubscribed = false` but doesn't auto-restart  
**Impact:** Subscriptions stay disconnected until user action  
**Solution:** Add automatic retry logic with exponential backoff

### Problem #3: Global Variables vs Zustand State
**Issue:** `isSubscribed`, `plansChannel`, etc. are outside Zustand state  
**Impact:** Race conditions, state doesn't synchronize  
**Solution:** Move subscription status into Zustand state

### Problem #4: No Health Check/Heartbeat
**Issue:** Doesn't periodically check if subscriptions are alive  
**Impact:** Subscriptions can silently die without detection  
**Solution:** Add periodic health check system

### Problem #5: Chat Subscriptions Management
**Issue:** Each ChatView creates its own channel - 5 open chats = 5 channels  
**Impact:** Too many total channels  
**Solution:** Share one channel or limit open chats

### Problem #6: Debouncing May Be Too Long
**Issue:** Poll votes debounce is 2 seconds  
**Impact:** Changes don't appear immediately  
**Solution:** Optimize debounce times

### Problem #7: Subscription Status Tracking
**Issue:** subscribe() callback only logs, doesn't react  
**Impact:** No proactive response to problems  
**Solution:** React to status changes programmatically

---

## ✅ WHAT WORKS WELL

- `checkAndRestartSubscriptions` function exists
- AppState listener in plans.tsx
- Tab focus listener in plans.tsx
- Debouncing is implemented
- Error logging is good

---

## 🛠️ TASKS TO COMPLETE

### TASK 1: REDUCE NUMBER OF CHANNELS IN PLANSSTORE

**Current:** 7 channels  
**Target:** 2-3 channels

**Steps:**

1. **Analyze plan_updates system**
   - Check if plan_updates notification system covers all needed update types
   - If not, add missing update_type values in backend

2. **Eliminate redundant channels**
   - Keep only:
     - `plans_channel` (INSERT events for new plans)
     - `plan_updates_channel` (main notification system)
     - Maybe 1 backup channel if absolutely necessary

3. **Modify handlers**
   - All changes (participants, polls, votes) should go through plan_updates system
   - Debounce individual plan reloads (not entire list)

**Implementation Guide:**

```typescript
// store/plansStore.ts

// BEFORE: 7 channels
plansChannel = supabase.channel('plans_channel_...')
participantsChannel = supabase.channel('participants_channel_...')
pollsChannel = supabase.channel('polls_channel_...')
// ... etc

// AFTER: 2-3 channels
plansChannel = supabase.channel('plans_channel_...')
  .on('postgres_changes', { event: 'INSERT', table: 'plans' }, ...)
  .subscribe(...)

updatesChannel = supabase.channel('plan_updates_channel_...')
  .on('postgres_changes', { event: '*', table: 'plan_updates' }, ...)
  .subscribe(...)

// Optional: Keep one emergency fallback channel if needed
```

**Backend Update Needed:**

Ensure `plan_updates` table triggers fire for ALL these events:
- `participant_joined`
- `participant_status_changed`
- `poll_created`
- `poll_voted`
- `poll_option_added`
- `poll_option_removed`
- `invitation_poll_created`
- `invitation_poll_voted`
- `invitation_poll_expired`

**Testing:**
- Create plan → should appear immediately
- Respond to plan → should update immediately
- Create poll → should appear immediately
- Vote on poll → should update immediately
- All with only 2-3 channels active

---

### TASK 2: ADD AUTOMATIC RECONNECTION LOGIC

**Current:** Channels stay disconnected on error  
**Target:** Auto-reconnection with exponential backoff

**Implementation:**

```typescript
// store/plansStore.ts

// Add retry tracking
let retryAttempts: Record<string, number> = {};
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // ms

const createChannelWithRetry = (
  channelName: string,
  channelId: string,
  setupFn: (channel: any) => any,
  userId: string
) => {
  const channel = setupFn(supabase.channel(channelId));
  
  channel.subscribe((status: string) => {
    console.log(`📡 ${channelName} status:`, status);
    
    if (status === 'SUBSCRIBED') {
      console.log(`✅ ${channelName} connected`);
      retryAttempts[channelName] = 0; // Reset retry counter
      isSubscribed = true;
      
    } else if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
      console.log(`❌ ${channelName} disconnected:`, status);
      isSubscribed = false;
      
      // Attempt auto-reconnection
      const attempt = retryAttempts[channelName] || 0;
      
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        console.log(`🔄 Retrying ${channelName} in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        
        retryAttempts[channelName] = attempt + 1;
        
        setTimeout(() => {
          console.log(`♻️ Attempting to restart ${channelName}...`);
          get().checkAndRestartSubscriptions(userId);
        }, delay);
        
      } else {
        console.error(`❌ ${channelName} failed after ${MAX_RETRIES} attempts - giving up`);
        // Could send error to monitoring service here
      }
    }
  });
  
  return channel;
};
```

**Apply to all stores:**
- plansStore ✓
- chatStore ✓
- friendsStore ✓
- hangStore ✓

**Testing:**
- Turn off WiFi for 30 seconds → should reconnect automatically
- Switch networks → should reconnect
- Put app in background → should reconnect on foreground

---

### TASK 3: ADD HEALTH CHECK/HEARTBEAT SYSTEM

**Current:** No periodic checks  
**Target:** 30-second health checks

**Implementation:**

```typescript
// store/plansStore.ts

let healthCheckInterval: NodeJS.Timeout | null = null;

interface HealthStatus {
  lastCheckTime: string | null;
  channelsHealthy: boolean;
  failedChecks: number;
}

const startHealthCheck = (userId: string) => {
  console.log('💓 Starting plans health check system...');
  
  let failedChecks = 0;
  
  healthCheckInterval = setInterval(() => {
    console.log('💓 Plans health check...');
    
    // Check if all critical channels are alive
    const channelsStatus = [
      { name: 'plans', channel: plansChannel, state: plansChannel?.state },
      { name: 'updates', channel: updatesChannel, state: updatesChannel?.state },
    ];
    
    const allHealthy = channelsStatus.every(ch => 
      ch.channel && ch.state === 'joined'
    );
    
    if (!allHealthy) {
      failedChecks++;
      console.log(`⚠️ Health check failed (${failedChecks} times) - Channel status:`, 
        channelsStatus.map(ch => `${ch.name}: ${ch.state || 'null'}`).join(', ')
      );
      
      // If 2 failed checks in a row, restart
      if (failedChecks >= 2) {
        console.log('🔄 Multiple failed health checks - restarting subscriptions...');
        get().checkAndRestartSubscriptions(userId);
        failedChecks = 0; // Reset counter after restart
      }
    } else {
      if (failedChecks > 0) {
        console.log('✅ Health check passed - channels recovered');
      }
      failedChecks = 0;
    }
  }, 30000); // Every 30 seconds
};

const stopHealthCheck = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('💓 Health check stopped');
  }
};

// Call startHealthCheck in startRealTimeUpdates
// Call stopHealthCheck in stopRealTimeUpdates
```

**Apply to all stores:**
- plansStore ✓
- chatStore ✓
- friendsStore ✓
- hangStore ✓

**Testing:**
- Let app run for 5 minutes → should see health checks in logs
- Manually disconnect (dev tools) → should auto-detect and restart

---

### TASK 4: MOVE SUBSCRIPTION STATE TO ZUSTAND STATE

**Current:** Global variables outside Zustand  
**Target:** All in Zustand state

**Implementation:**

```typescript
// store/plansStore.ts

interface PlansState {
  // ... existing state
  
  // NEW: Subscription status tracking
  subscriptionStatus: {
    isSubscribed: boolean;
    lastCheckTime: string | null;
    retryAttempts: number;
    channels: {
      plans: {
        state: 'connected' | 'disconnected' | 'connecting' | null;
        lastError: string | null;
      };
      updates: {
        state: 'connected' | 'disconnected' | 'connecting' | null;
        lastError: string | null;
      };
    };
  };
  
  // NEW: Actions
  updateChannelStatus: (channel: string, state: string, error?: string) => void;
}

const usePlansStore = create<PlansState>((set, get) => ({
  // ... existing state
  
  subscriptionStatus: {
    isSubscribed: false,
    lastCheckTime: null,
    retryAttempts: 0,
    channels: {
      plans: { state: null, lastError: null },
      updates: { state: null, lastError: null },
    },
  },
  
  updateChannelStatus: (channel: string, state: string, error?: string) => {
    set(currentState => ({
      subscriptionStatus: {
        ...currentState.subscriptionStatus,
        lastCheckTime: new Date().toISOString(),
        channels: {
          ...currentState.subscriptionStatus.channels,
          [channel]: {
            state: state === 'SUBSCRIBED' ? 'connected' : 'disconnected',
            lastError: error || null,
          },
        },
      },
    }));
  },
  
  // ... rest of implementation
}));
```

**Remove global variables:**
```typescript
// REMOVE THESE:
// let plansChannel: any = null;
// let isSubscribed = false;

// REPLACE WITH:
// Access via get().subscriptionStatus.isSubscribed
// Store channels in Zustand or as refs
```

**Testing:**
- Check subscriptionStatus in React DevTools
- Should update when channels connect/disconnect

---

### TASK 5: OPTIMIZE CHAT SUBSCRIPTIONS

**Current:** 1 channel per chat  
**Target:** Shared channel or limited channels

**Option A (Simpler):** Limit open chat channels

```typescript
// store/chatStore.ts

const MAX_CHAT_CHANNELS = 3;
const activeChatChannels: string[] = [];

subscribeToChat: (planId: string) => {
  // Don't subscribe twice
  if (state.subscriptions[planId]) {
    return;
  }
  
  // Limit number of active channels
  if (activeChatChannels.length >= MAX_CHAT_CHANNELS) {
    const oldestPlanId = activeChatChannels[0];
    console.log(`🗑️ Max chat channels reached - unsubscribing from ${oldestPlanId}`);
    get().unsubscribeFromChat(oldestPlanId);
    activeChatChannels.shift();
  }
  
  // Subscribe to new channel
  const channel = /* ... existing code ... */;
  activeChatChannels.push(planId);
  
  // ... rest
}
```

**Option B (Better):** Shared channel with client-side filtering

```typescript
// store/chatStore.ts

let sharedChatChannel: any = null;
const subscribedPlanIds = new Set<string>();

subscribeToChat: (planId: string) => {
  subscribedPlanIds.add(planId);
  
  // Create shared channel if doesn't exist
  if (!sharedChatChannel) {
    sharedChatChannel = supabase
      .channel('shared_chat_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const messagePlanId = payload.new?.plan_id;
          // Only process if we're subscribed to this plan
          if (subscribedPlanIds.has(messagePlanId)) {
            handleChatMessage(payload);
          }
        }
      )
      .subscribe();
  }
}
```

**Recommendation:** Start with Option A, if time permits, implement Option B

**Testing:**
- Open 5 chats → should only have 3 channels (or 1 shared)
- Close chat → should unsubscribe
- Reopen chat → should resubscribe

---

### TASK 6: OPTIMIZE DEBOUNCE TIMES

**Current:** Some are 2 seconds  
**Target:** Balance between speed and rate limits

**Changes:**

```typescript
// store/plansStore.ts

// BEFORE:
pollVotesRefreshTimeout = setTimeout(debouncedRefresh, 2000);
participantsRefreshTimeout = setTimeout(debouncedRefresh, 2000);
invitationPollsRefreshTimeout = setTimeout(debouncedRefresh, 1000);

// AFTER:
pollVotesRefreshTimeout = setTimeout(debouncedRefresh, 1000); // 2s → 1s
participantsRefreshTimeout = setTimeout(debouncedRefresh, 1500); // 2s → 1.5s
invitationPollsRefreshTimeout = setTimeout(debouncedRefresh, 750); // 1s → 750ms
```

**Add rate limit protection:**

```typescript
let lastAPICallTimes: Record<string, number> = {};
const MIN_TIME_BETWEEN_CALLS = 500; // ms

const rateLimitedAPICall = async (key: string, fn: () => Promise<void>) => {
  const now = Date.now();
  const lastCall = lastAPICallTimes[key] || 0;
  const timeSinceLastCall = now - lastCall;
  
  if (timeSinceLastCall < MIN_TIME_BETWEEN_CALLS) {
    console.log(`⏰ Rate limiting ${key} - too soon since last call`);
    return;
  }
  
  lastAPICallTimes[key] = now;
  
  try {
    await fn();
  } catch (error: any) {
    if (error?.message?.includes('429') || error?.status === 429) {
      console.log(`⚠️ Rate limit hit for ${key} - backing off...`);
      // Could increase debounce times temporarily here
    }
    throw error;
  }
};
```

**Testing:**
- Vote on poll → should appear within 1 second
- Multiple rapid votes → shouldn't cause rate limit errors

---

### TASK 7: ADD LOGGING AND MONITORING

**Implementation:**

```typescript
// store/plansStore.ts

interface SubscriptionMetrics {
  totalConnections: number;
  totalDisconnections: number;
  totalReconnects: number;
  failedReconnects: number;
  lastConnectionTime: string | null;
  lastDisconnectionTime: string | null;
  averageReconnectTime: number;
}

let metrics: SubscriptionMetrics = {
  totalConnections: 0,
  totalDisconnections: 0,
  totalReconnects: 0,
  failedReconnects: 0,
  lastConnectionTime: null,
  lastDisconnectionTime: null,
  averageReconnectTime: 0,
};

const logMetrics = () => {
  if (__DEV__) {
    console.log('📊 Subscription Metrics:', {
      ...metrics,
      uptime: metrics.lastConnectionTime 
        ? `${Math.floor((Date.now() - new Date(metrics.lastConnectionTime).getTime()) / 1000)}s`
        : 'N/A',
    });
  }
};

// Call logMetrics() periodically or on significant events
```

**Add debug helper:**

```typescript
// Add to PlansState interface
interface PlansState {
  // ...
  getSubscriptionDebugInfo: () => SubscriptionDebugInfo;
}

// Implementation
getSubscriptionDebugInfo: () => {
  return {
    isSubscribed: get().subscriptionStatus.isSubscribed,
    channels: get().subscriptionStatus.channels,
    metrics,
    activeChannels: {
      plans: !!plansChannel,
      updates: !!updatesChannel,
    },
    timestamp: new Date().toISOString(),
  };
},
```

**Testing:**
- In dev mode, should see verbose logs
- Call `usePlansStore.getState().getSubscriptionDebugInfo()` in console

---

## 📝 IMPLEMENTATION ORDER

Follow this order for best results:

1. **TASK 1** - Reduce channels (biggest impact)
2. **TASK 2** - Auto reconnection (critical for stability)
3. **TASK 3** - Health checks (proactive monitoring)
4. **TASK 4** - Move to Zustand state (better architecture)
5. **TASK 6** - Optimize debounce (quick win)
6. **TASK 5** - Chat optimization (nice to have)
7. **TASK 7** - Logging/monitoring (polish)

---

## 🧪 TESTING CHECKLIST

### Normal Usage Tests
- [ ] Open app → all subscriptions connect
- [ ] Create plan → appears immediately in plans tab
- [ ] Receive invitation → appears immediately in invitations
- [ ] Respond to plan → status updates immediately
- [ ] Create poll → appears immediately
- [ ] Vote on poll → votes update immediately (within 1s)
- [ ] Open chat → messages appear in real-time
- [ ] Send message → appears immediately with read receipts
- [ ] Add friend → appears in friends list immediately
- [ ] Accept friend request → updates immediately

### Error Scenario Tests
- [ ] Turn WiFi off for 30s → reconnects automatically
- [ ] Turn WiFi off for 2 minutes → reconnects automatically
- [ ] Switch from WiFi to mobile data → reconnects
- [ ] Switch from mobile data to WiFi → reconnects
- [ ] Put app in background for 1 minute → reconnects on foreground
- [ ] Put app in background for 10 minutes → reconnects on foreground
- [ ] Lock phone for 5 minutes → reconnects when unlocked
- [ ] Put device in airplane mode → handles gracefully

### Stress Tests
- [ ] Open 5 chats simultaneously → max 3 channels (or 1 shared)
- [ ] Send 10 messages rapidly → no rate limit errors
- [ ] Create 5 polls rapidly → all appear correctly
- [ ] 5 people vote on same poll rapidly → updates correctly
- [ ] Leave app running for 1 hour → subscriptions stay alive
- [ ] Leave app running overnight → subscriptions stay alive

### Monitoring Tests
- [ ] Check logs → should see health checks every 30s
- [ ] Trigger reconnection → should see retry attempts
- [ ] Call getSubscriptionDebugInfo() → returns accurate info
- [ ] Check metrics → counts are accurate

---

## 🚨 IMPORTANT RULES

1. **Don't change too much at once** - Work task by task
2. **Test each change** - Before moving to next task
3. **Keep existing functionality** - Don't break what works
4. **Commit frequently** - Small commits with clear messages
5. **Add comments** - So next developer understands
6. **Console.log liberally** - Helps with debugging (use `__DEV__` guard)
7. **Handle errors gracefully** - Never let errors crash subscriptions
8. **Think about edge cases** - What if user has no internet?

---

## 📚 FILE LOCATIONS

**Files you'll modify:**
- `store/plansStore.ts` - Main focus (7 channels → 2-3)
- `store/chatStore.ts` - Chat subscriptions optimization
- `store/friendsStore.ts` - Add reconnection logic
- `store/hangStore.ts` - Add reconnection logic
- `app/(tabs)/plans.tsx` - May need minor updates
- `contexts/AuthContext.tsx` - May need to update restart logic

**Files you'll reference:**
- `lib/supabase.ts` - Supabase client setup
- `constants/config.ts` - API configuration
- `docs/CHAT_SYSTEM_DESIGN.md` - Chat system design

---

## 💡 HELPFUL TIPS

**Debugging Supabase Realtime:**
```typescript
// Check channel state
console.log('Channel state:', channel.state); // Should be 'joined'

// Check all active channels
console.log('Active channels:', supabase.getChannels());

// Force channel state check
await channel.track({ online_at: new Date().toISOString() });
```

**Common Pitfalls:**
- Forgetting to unsubscribe → memory leaks
- Creating channels in render → infinite loops
- Not handling TIMED_OUT status → silent failures
- Too aggressive retry → rate limiting
- Subscribing to same channel twice → conflicts

**Performance Tips:**
- Use debouncing for rapid changes
- Load single plan instead of all plans when possible
- Batch updates when possible
- Unsubscribe from unused channels immediately

---

## 📞 SUPPORT

If you get stuck or need clarification:
1. Check the console logs - they're your friend
2. Review Supabase realtime docs: https://supabase.com/docs/guides/realtime
3. Check existing working examples in the codebase
4. Ask your planner (me) for guidance

---

## ✅ COMPLETION CRITERIA

You're done when:
1. All 7 tasks are completed
2. All tests pass
3. Subscriptions stay connected for 1+ hour
4. Network changes are handled gracefully
5. Plans/invitations appear immediately (< 1 second)
6. No console errors related to subscriptions
7. Code is clean, commented, and tested
8. You've committed all changes with clear messages

---

## 🎯 SUCCESS METRICS

**Before (Current State):**
- 7+ channels in plansStore
- Manual reconnection only
- Subscriptions die silently
- Unreliable real-time updates

**After (Target State):**
- 2-3 channels in plansStore
- Auto-reconnection with exponential backoff
- Health checks every 30 seconds
- 99.9%+ reliable real-time updates
- < 1 second latency for updates
- Graceful handling of network changes

---

## 🚀 READY TO START?

Begin with **TASK 1: REDUCE NUMBER OF CHANNELS IN PLANSSTORE**

This will have the biggest impact on stability. Once that's solid, move to TASK 2 for auto-reconnection.

Good luck, Engineer! You've got this! 💪

---

**Document Version:** 1.0  
**Last Updated:** November 21, 2025  
**Author:** System Planner  
**For:** GPT 5.1 Codex (Engineer)

