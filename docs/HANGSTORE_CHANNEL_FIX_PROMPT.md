# Urgent Fix Required - HangStore Channel Subscribe Error

---

## 🚨 CRITICAL BUG DETECTED

**Error:**
```
tried to subscribe multiple times. 
'subscribe' can only be called a single time per channel instance
```

**Status:** Hang realtime is completely broken and stuck in infinite retry loop.

---

## 📋 YOUR TASK

**Codex,** there's a critical bug in `store/hangStore.ts` that's preventing hang realtime from working.

**Read this file for complete fix instructions:**
```
docs/HANGSTORE_CHANNEL_FIX.md
```

---

## 🎯 WHAT TO DO

1. **Read the fix guide** - `docs/HANGSTORE_CHANNEL_FIX.md`
2. **Implement all 4 steps** - They're clearly marked
3. **Test thoroughly** - Use the testing section
4. **Commit when done** - Use suggested commit message

---

## ⚡ KEY CHANGES NEEDED

**Problem:** Channel is being subscribe'd multiple times on same instance

**Solution:**
- Use **unique channel names** (add timestamp)
- **Await** channel removal before creating new
- Add **small delay** (100ms) after removal
- Make functions **async** where needed

---

## 📍 FILES TO MODIFY

**Only one file:**
- `store/hangStore.ts` (4 functions to update)

**Functions:**
1. `startRealTimeUpdates()` - Make async, use unique names
2. `stopRealTimeUpdates()` - Make async, await removal
3. `scheduleHangRealtimeRestart()` - Make callback async
4. `handleHangChannelStatus()` - Add better logging

---

## ✅ SUCCESS LOOKS LIKE

**Before (broken):**
```
LOG  📡 Status channel status: SUBSCRIBED
LOG  📡 Status channel status: CLOSED
LOG  🔄 Scheduling hang real-time restart...
LOG  📡 Status channel status: SUBSCRIBED
LOG  📡 Status channel status: CLOSED
... infinite loop
ERROR: tried to subscribe multiple times
```

**After (fixed):**
```
LOG  ✅ Old hang channel removed successfully
LOG  📡 Creating new hang channel: user_status_changes_1732219...
LOG  📡 Status channel status: SUBSCRIBED
LOG  ✅ Hang channel SUBSCRIBED
LOG  ✅ Hang real-time start completed
... stays stable, no loop
```

---

## ⏱️ TIME ESTIMATE

**30-45 minutes** to implement and test

---

## 🆘 IF YOU GET STUCK

1. Check the detailed code examples in `HANGSTORE_CHANNEL_FIX.md`
2. Use the debugging section if issue persists
3. Ask your planner (me) for help

---

## 🚀 START NOW

Open `docs/HANGSTORE_CHANNEL_FIX.md` and begin with **Step 1**.

This is blocking users from seeing friend status updates in real-time!

---

**Good luck!** 💪

