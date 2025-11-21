# HangStore Channel Subscribe Error - Fix Guide

**Date:** November 21, 2025  
**Priority:** CRITICAL 🔴  
**For:** GPT 5.1 Codex (Engineer)

---

## 🚨 PROBLEM

**Error:**
```
tried to subscribe multiple times. 
'subscribe' can only be called a single time per channel instance
js engine: hermes
```

**Symptoms:**
- Channel loops: SUBSCRIBED → CLOSED → SUBSCRIBED → CLOSED
- Channel state never reaches `joined` (stays `null`)
- Health check failures accumulate: 1, 2, 3, 4, 5, 6...
- Hang realtime completely broken

---

## 🔍 ROOT CAUSE

The `statusChannel` variable holds a reference to the old channel instance. When retry attempts happen, we try to `.subscribe()` on the same instance again, which Supabase doesn't allow.

**Current problematic flow:**
```typescript
1. Create channel: statusChannel = supabase.channel('user_status_changes')
2. Subscribe: statusChannel.subscribe(handler)
3. Status: SUBSCRIBED
4. Status: CLOSED (immediately)
5. Retry calls startRealTimeUpdates()
6. startRealTimeUpdates() calls supabase.removeChannel(statusChannel)
7. BUT then creates NEW channel with SAME NAME
8. Supabase sees duplicate name → confusion
9. OR we try to subscribe to already-subscribed instance
```

---

## ✅ SOLUTION

**Two critical fixes needed:**

### Fix 1: Always Create Fresh Channel Instance

**Current code problem:**
```typescript
// store/hangStore.ts - startRealTimeUpdates()

statusChannel = supabase
  .channel('user_status_changes')  // ← SAME NAME every time!
  .on(...)
  .subscribe(handler);
```

**Fix:**
```typescript
// Generate UNIQUE channel name each time
const channelName = `user_status_changes_${Date.now()}`;

statusChannel = supabase
  .channel(channelName)  // ← UNIQUE each time
  .on(...)
  .subscribe(handler);
```

### Fix 2: Properly Cleanup Old Channel

**Current code problem:**
```typescript
if (statusChannel) {
  supabase.removeChannel(statusChannel);
  statusChannel = null;  // ← Set to null immediately
}

// But then immediately create new one
statusChannel = supabase.channel(...)  // ← May conflict
```

**Fix:**
```typescript
// Ensure old channel is fully removed before creating new
if (statusChannel) {
  try {
    await supabase.removeChannel(statusChannel);
    console.log('✅ Old hang channel removed');
  } catch (error) {
    console.warn('⚠️ Error removing old channel:', error);
  }
  statusChannel = null;
}

// Small delay to ensure cleanup completes
await new Promise(resolve => setTimeout(resolve, 100));

// Now create new channel with unique name
const channelName = `user_status_changes_${Date.now()}`;
statusChannel = supabase.channel(channelName)...
```

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Update startRealTimeUpdates()

**File:** `store/hangStore.ts`

**Location:** Line ~425 (startRealTimeUpdates function)

**Changes:**

```typescript
startRealTimeUpdates: async () => {  // ← Make it async
  // Guard against parallel starts
  if (isStartingRealtime) {
    console.log('⏸️ Hang real-time already starting - skipping');
    return;
  }
  
  isStartingRealtime = true;
  
  // Clear any existing subscriptions
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  
  // IMPROVED: Properly cleanup old channel
  if (statusChannel) {
    stopHangHealthCheck();
    try {
      await supabase.removeChannel(statusChannel);
      console.log('✅ Old hang channel removed successfully');
    } catch (error) {
      console.warn('⚠️ Error removing old hang channel:', error);
    }
    statusChannel = null;
    
    // Small delay to ensure Supabase cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (hangRestartTimeout) {
    clearTimeout(hangRestartTimeout);
    hangRestartTimeout = null;
  }
  hangRetryAttempts = 0;
  
  // Load friends once initially
  get().loadFriends();
  
  console.log('🚀 Starting real-time friend status updates...');
  
  // IMPROVED: Use unique channel name
  const channelName = `user_status_changes_${Date.now()}`;
  console.log(`📡 Creating new hang channel: ${channelName}`);
  
  // Set up real-time subscription for user status changes
  statusChannel = supabase
    .channel(channelName)  // ← UNIQUE name
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: 'status=neq.null'
      },
      (payload) => {
        console.log('📡 User status change detected:', payload);
        get().loadFriends();
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'users'
      },
      (payload) => {
        console.log('📡 New user detected:', payload);
        get().loadFriends();
      }
    )
    .subscribe((status) => {
      handleHangChannelStatus(status);
    });
  
  // Release lock after channel setup
  setTimeout(() => {
    isStartingRealtime = false;
    console.log('✅ Hang real-time start completed');
  }, 1000);
  
  startHangHealthCheck();
  
  // More frequent polling for better real-time feel (every 10 seconds)
  refreshInterval = setInterval(() => {
    get().loadFriends();
  }, 10000);
},
```

### Step 2: Update stopRealTimeUpdates()

**File:** `store/hangStore.ts`

**Location:** Line ~488 (stopRealTimeUpdates function)

**Changes:**

```typescript
stopRealTimeUpdates: async () => {  // ← Make it async
  isStartingRealtime = false; // Release lock
  
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  
  if (statusChannel) {
    try {
      await supabase.removeChannel(statusChannel);
      console.log('✅ Hang channel removed in stop');
    } catch (error) {
      console.warn('⚠️ Error removing hang channel in stop:', error);
    }
    statusChannel = null;
  }
  
  stopHangHealthCheck();
  
  if (hangRestartTimeout) {
    clearTimeout(hangRestartTimeout);
    hangRestartTimeout = null;
  }
  
  hangRetryAttempts = 0;
  console.log('🛑 Stopped real-time friend status updates');
},
```

### Step 3: Update scheduleHangRealtimeRestart()

**File:** `store/hangStore.ts`

**Location:** Line ~539 (scheduleHangRealtimeRestart function)

**Changes:**

```typescript
function scheduleHangRealtimeRestart() {
  if (hangRetryAttempts >= MAX_HANG_RETRIES) {
    console.error('❌ Hang real-time subscription failed after maximum retries');
    return;
  }

  const delay = HANG_RETRY_DELAYS_MS[Math.min(hangRetryAttempts, HANG_RETRY_DELAYS_MS.length - 1)];
  hangRetryAttempts += 1;

  if (hangRestartTimeout) {
    clearTimeout(hangRestartTimeout);
  }

  console.log(
    `🔄 Scheduling hang real-time restart in ${delay}ms (attempt ${hangRetryAttempts}/${MAX_HANG_RETRIES})`
  );

  hangRestartTimeout = setTimeout(async () => {  // ← Make callback async
    hangRestartTimeout = null;
    console.log('♻️ Attempting to restart hang real-time subscriptions...');
    await useHangStore.getState().startRealTimeUpdates();  // ← Await it
  }, delay);
}
```

### Step 4: Update handleHangChannelStatus()

**File:** `store/hangStore.ts`

**Location:** Line ~513 (handleHangChannelStatus function)

**Add more detailed logging:**

```typescript
function handleHangChannelStatus(status: string) {
  console.log('📡 Status channel status:', status);

  if (status === 'SUBSCRIBED') {
    console.log('✅ Hang channel SUBSCRIBED');
    hangRetryAttempts = 0;
    if (hangRestartTimeout) {
      clearTimeout(hangRestartTimeout);
      hangRestartTimeout = null;
    }
    return;
  }
  
  // ADD: Log when channel reaches joined state
  if (status === 'CHANNEL_STATE_CHANGE') {
    console.log('🔄 Hang channel state changed, current state:', statusChannel?.state);
    return;
  }

  if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
    if (status === 'CHANNEL_ERROR') {
      console.log('❌ Hang status channel error');
    } else if (status === 'CLOSED') {
      console.log('🔒 Hang status channel closed');
      console.log('📊 Channel state at close:', statusChannel?.state);
    } else {
      console.log('⏰ Hang status channel timed out');
    }

    // Clear the channel reference
    statusChannel = null;
    scheduleHangRealtimeRestart();
  }
}
```

---

## 🧪 TESTING

After implementing fixes:

### Test 1: Check channel creation
```
Expected logs:
✅ Old hang channel removed successfully
📡 Creating new hang channel: user_status_changes_1732219...
📡 Status channel status: SUBSCRIBED
✅ Hang channel SUBSCRIBED
✅ Hang real-time start completed

NOT expected:
❌ Multiple subscribe errors
❌ Immediate CLOSED after SUBSCRIBED
```

### Test 2: Check channel state
```typescript
// In console after app loads:
// Wait 5 seconds, then check:

// Should see in logs:
"📡 Status channel status: SUBSCRIBED"
"✅ Hang channel SUBSCRIBED"

// NOT:
"🔒 Hang status channel closed" (immediately after SUBSCRIBED)
```

### Test 3: Verify no loop
```
Wait 30 seconds.

Expected:
- No retry attempts
- Health check shows healthy
- Channel stays SUBSCRIBED

NOT expected:
- Continuous retry loop
- Health check failures accumulating
```

---

## 🔍 DEBUGGING

If issue persists, add this diagnostic:

```typescript
// Add at top of startRealTimeUpdates(), after guard check:

console.log('🔍 DEBUG - Hang channel state before start:', {
  statusChannel: !!statusChannel,
  channelState: statusChannel?.state,
  isStartingRealtime,
  hangRetryAttempts
});

// After creating new channel:
console.log('🔍 DEBUG - New hang channel created:', {
  channelName,
  channelState: statusChannel?.state,
  channelTopic: statusChannel?.topic
});

// In handleHangChannelStatus, log ALL status changes:
console.log('🔍 DEBUG - Channel status change:', {
  status,
  channelState: statusChannel?.state,
  channelTopic: statusChannel?.topic,
  timestamp: new Date().toISOString()
});
```

---

## 🎯 SUCCESS CRITERIA

✅ **Fixed when:**
1. No "tried to subscribe multiple times" error
2. Channel reaches SUBSCRIBED and STAYS subscribed
3. Channel state shows `joined` (not `null`)
4. Health checks pass consistently
5. No retry loops
6. Users can see friend status updates in real-time

---

## ⚠️ ADDITIONAL CONSIDERATIONS

### If fix doesn't work, check:

1. **Supabase connection limits**
   ```typescript
   // Check how many channels are open
   console.log('Total channels:', supabase.getChannels().length);
   // Should be < 10
   ```

2. **Network connectivity**
   ```typescript
   // Test Supabase connection
   const { data, error } = await supabase.from('users').select('id').limit(1);
   console.log('Supabase connectivity:', error ? 'FAILED' : 'OK');
   ```

3. **Credentials**
   ```typescript
   // Verify Supabase config
   console.log('Supabase URL:', supabase.supabaseUrl.substring(0, 20) + '...');
   console.log('Project:', SUPABASE_ACTIVE_PROJECT);
   ```

---

## 📚 REFERENCES

- Supabase Realtime docs: https://supabase.com/docs/guides/realtime/concepts
- Channel lifecycle: https://supabase.com/docs/reference/javascript/subscribe
- Error handling: https://supabase.com/docs/guides/realtime/troubleshooting

---

**Good luck fixing this!** 🚀

Once fixed, commit with:
```bash
git commit -m "fix: resolve hang channel subscribe error with unique channel names"
```

