# Real-time Critical Issue - Summary for User

**Date:** November 21, 2025  
**Status:** 🔴 CRITICAL BUG FOUND  
**Impact:** Hang realtime completely broken

---

## 🚨 WHAT'S WRONG

Your app has a critical bug in the hang (friend status) realtime system.

**Error message:**
```
tried to subscribe multiple times. 
'subscribe' can only be called a single time per channel instance
```

**What this means:**
- Friends' online/offline status doesn't update in real-time
- The system is stuck in an infinite retry loop
- This wastes device resources (battery, CPU)
- User experience is broken

---

## 📊 SEVERITY

**Level:** 🔴 CRITICAL  
**Priority:** HIGHEST  
**Users affected:** ALL users trying to see friend status  
**Fix urgency:** IMMEDIATE

---

## 🔍 TECHNICAL ROOT CAUSE

The code is trying to `subscribe()` to the same Supabase channel instance multiple times, which Supabase doesn't allow.

**Why it happens:**
1. Channel connects (SUBSCRIBED)
2. Channel closes immediately (CLOSED)  
3. Retry mechanism tries to reconnect
4. But reuses the same channel object
5. Supabase rejects: "already subscribed"
6. Loop repeats forever

**Why it closes immediately:**
- Likely: Channel name conflicts (same name reused)
- Possible: Too many open channels
- Possible: Network/credentials issue

---

## ✅ THE FIX

**Files created for your engineer (Codex):**

1. **`docs/HANGSTORE_CHANNEL_FIX_PROMPT.md`**  
   → Quick start prompt for Codex
   
2. **`docs/HANGSTORE_CHANNEL_FIX.md`**  
   → Complete implementation guide with code examples

**What needs to be done:**
- Use **unique channel names** (add timestamp)
- **Properly cleanup** old channels before creating new ones
- Add **small delays** to ensure cleanup completes
- Make functions **async** to handle cleanup properly

**Estimated fix time:** 30-45 minutes

---

## 🎯 WHAT TO DO NOW

### Option 1: Give it to Codex (Recommended)

Send this prompt to GPT 5.1 Codex:

```
Tere Codex! Palun loe faili docs/HANGSTORE_CHANNEL_FIX_PROMPT.md 
ja järgi seal olevaid juhiseid. See on kriitiline bug mis peab 
kohe parandama.
```

### Option 2: I (Sonnet) can fix it

If you want, I can fix it right now. Just say:

```
Sonnet, palun paranda see bug kohe ära.
```

---

## 📈 EXPECTED OUTCOME

**After fix:**
- ✅ Hang realtime works smoothly
- ✅ Friend status updates appear instantly
- ✅ No more retry loops
- ✅ No more "subscribe multiple times" errors
- ✅ Better battery life (no wasted retries)

---

## 🔄 OTHER REALTIME SYSTEMS

**Good news:** This bug is ONLY in hangStore.

**Already working well:**
- ✅ Plans realtime (invitations, polls, etc.)
- ✅ Chat realtime (messages, reactions, etc.)
- ✅ Friends realtime (friend requests, etc.)

Only the **hang/friend status** realtime is affected.

---

## 📞 NEXT STEPS

1. **Decide:** Give to Codex or I fix it?
2. **Fix:** Implement the solution (30-45 min)
3. **Test:** Verify fix works
4. **Deploy:** Push to production

---

## 💡 PREVENTION

After this is fixed, I recommend:

1. Add **unit tests** for channel lifecycle
2. Add **monitoring** for retry loops
3. Add **alerting** when retry count > 3
4. Document **channel management best practices**

---

**Status:** Waiting for your decision - should Codex fix this or should I do it now?

