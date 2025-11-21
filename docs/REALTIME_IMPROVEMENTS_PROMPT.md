# Prompt for GPT 5.1 Codex - Real-time Improvements

---

## YOUR ROLE

You are **GPT 5.1 Codex**, a senior software engineer. Your planner has identified critical issues with the real-time subscription system and has prepared detailed instructions for you.

---

## YOUR MISSION

Read and follow the comprehensive guide in:

**`docs/REALTIME_IMPROVEMENTS_GUIDE.md`**

This guide contains:
- ✅ Complete analysis of current issues
- ✅ 7 specific tasks with implementation code
- ✅ Testing requirements
- ✅ Success metrics
- ✅ Everything you need to succeed

---

## INSTRUCTIONS

1. **Read the guide thoroughly** - Every section matters
2. **Follow the task order** - Start with TASK 1, then TASK 2, etc.
3. **Test after each task** - Don't skip testing
4. **Commit frequently** - Small, clear commits
5. **Ask if stuck** - Your planner is available

---

## KEY PRIORITIES

**Most Important (Do First):**
- 🔴 TASK 1: Reduce channels from 7 to 2-3
- 🔴 TASK 2: Add auto-reconnection logic
- 🔴 TASK 3: Add health check system

**Important (Do Next):**
- 🟡 TASK 4: Move state to Zustand
- 🟡 TASK 6: Optimize debounce times

**Nice to Have (If Time):**
- 🟢 TASK 5: Optimize chat subscriptions
- 🟢 TASK 7: Enhanced logging

---

## QUICK START

```bash
# 1. Read the guide
open docs/REALTIME_IMPROVEMENTS_GUIDE.md

# 2. Start with TASK 1
# Focus: store/plansStore.ts
# Goal: Reduce from 7 channels to 2-3 channels

# 3. Test your changes
npm start

# 4. Commit when task is complete
git add .
git commit -m "feat: reduce plansStore channels from 7 to 2-3 (TASK 1)"

# 5. Move to TASK 2
# ... repeat
```

---

## EXPECTED TIMELINE

- TASK 1: 2 hours
- TASK 2: 1.5 hours
- TASK 3: 1 hour
- TASK 4: 1.5 hours
- TASK 6: 30 minutes
- TASK 5: 1 hour
- TASK 7: 30 minutes
- **Total: ~8 hours**

---

## FILES YOU'LL MODIFY

Primary:
- `store/plansStore.ts` (most changes here)
- `store/chatStore.ts`
- `store/friendsStore.ts`
- `store/hangStore.ts`

Secondary:
- `app/(tabs)/plans.tsx`
- `contexts/AuthContext.tsx`

---

## WHAT SUCCESS LOOKS LIKE

**Before:** Subscriptions sometimes disconnect, plans don't appear in real-time  
**After:** 99.9% reliable, automatic recovery, < 1 second updates

---

## NOW GO!

Open `docs/REALTIME_IMPROVEMENTS_GUIDE.md` and start with **TASK 1**.

The guide has everything you need - code examples, testing steps, and success criteria.

**You've got this!** 🚀

---

