# 🚨 CRITICAL FIXES REQUIRED - Notification System Blockers

**Date:** November 21, 2025  
**Priority:** URGENT - BLOCKING MVP  
**Estimated Fix Time:** 30-45 minutes

---

## 🔴 CRITICAL BUG #1: Hang Channel Wrong Table (URGENT)

### Problem
The hang realtime channel is listening to the **WRONG TABLE**, causing:
- ❌ Constant CHANNEL_ERROR in logs (infinite retry loop)
- ❌ Friend status changes not detected in real-time
- ❌ Chain effect notifications completely broken
- ❌ Log spam (every 2-3 seconds)

### Current Code (BROKEN)
**File:** `store/hangStore.ts` (lines 462-476)

```typescript
statusChannel = supabase
  .channel(channelName)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',  // ❌ WRONG TABLE!
      filter: 'status=neq.null'  // ❌ Wrong filter!
    },
    (payload) => {
      console.log('📡 User status change detected:', payload);
      get().loadFriends();
    }
  )
```

### Root Cause
User status is stored in `user_status` table, NOT `users` table!
- `users` table: Basic user info (name, email, username)
- `user_status` table: Dynamic status (is_available, activity, last_seen, last_active)

### Fix Required

**Replace lines 462-493 in `store/hangStore.ts`:**

```typescript
// Set up real-time subscription for user status changes
statusChannel = supabase
  .channel(channelName)
  .on(
    'postgres_changes',
    {
      event: '*',  // Listen to all events (INSERT, UPDATE, DELETE)
      schema: 'public',
      table: 'user_status',  // ✅ CORRECT TABLE
    },
    (payload) => {
      console.log('📡 User status change detected:', payload);
      
      // If a friend went online (chain effect trigger)
      const newStatus = payload.new;
      if (payload.eventType === 'UPDATE' && newStatus?.is_available === true) {
        console.log('🔥 Friend went online, chain effect will trigger from backend');
      }
      
      // Immediately reload friends data when any user status changes
      get().loadFriends();
    }
  )
  .subscribe((status) => {
    handleHangChannelStatus(status);
  });
```

**Impact:** This will fix all status-related real-time updates and enable chain effect.

---

## 🟡 HIGH PRIORITY #2: Database Schema Deployment

### Problem
Notification tables might not exist in production database.

### Required Tables
- `notifications` - stores all in-app notifications
- `push_tokens` - stores Expo push tokens
- `notification_preferences` - user notification settings

### Action Required

**Step 1:** Go to Supabase Dashboard → SQL Editor

**Step 2:** Copy and run: `scripts/notifications-schema.sql`

**Step 3:** Verify deployment:
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('notifications', 'push_tokens', 'notification_preferences');

-- Should return 3 rows

-- Check user_status has last_active column
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_status' AND column_name = 'last_active';

-- Should return 1 row
```

**Step 4:** Check RLS policies:
```sql
-- Check notification policies
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'notifications';

-- Should show 4 policies including "Service role can insert notifications"
```

---

## 🟡 HIGH PRIORITY #3: Expo Project ID Configuration

### Problem
Push notifications cannot register without proper Expo project ID.

### Current State (BROKEN)
**File:** `app.json` (line 68)
```json
"extra": {
  "eas": {
    "projectId": "your-project-id-here"  // ❌ Placeholder
  }
}
```

### Fix Required

**Option A:** If you have EAS set up:
1. Run: `npx eas init` (if not done yet)
2. This will automatically update `app.json` with correct project ID

**Option B:** Manual setup:
1. Go to https://expo.dev/
2. Sign in / create account
3. Create project or find existing "Free to Hang" project
4. Copy Project ID from dashboard
5. Update `app.json`:
```json
"extra": {
  "eas": {
    "projectId": "abc123-your-actual-id-here"
  }
}
```

**Also update:** `utils/pushNotifications.ts` (line 36)
```typescript
token = (await Notifications.getExpoPushTokenAsync({
  projectId: 'abc123-your-actual-id-here'  // Same ID as app.json
})).data;
```

---

## 🟢 MEDIUM PRIORITY #4: Backend Dependencies

### Problem
Backend notification services need NPM packages.

### Action Required

```bash
cd backend
npm install expo-server-sdk node-cron
```

### Verify Installation
Check `backend/package.json` should include:
```json
"dependencies": {
  "expo-server-sdk": "^3.7.0",
  "node-cron": "^3.0.3",
  ...
}
```

### Restart Backend
After installing, restart Railway deployment or local backend:
```bash
# If running locally
npm start

# If on Railway, commit and push will auto-deploy
```

---

## 🟢 MEDIUM PRIORITY #5: Frontend Dependencies

### Problem
Expo notifications packages not installed.

### Action Required

```bash
# In project root
npx expo install expo-notifications expo-device
```

### Verify Installation
Check `package.json` should include:
```json
"dependencies": {
  "expo-notifications": "~0.28.x",
  "expo-device": "~6.x.x",
  ...
}
```

### Update App Config
Ensure `app.json` has notification plugin:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#000000"
    }
  }
}
```

---

## 📋 TESTING CHECKLIST

After implementing all fixes above, verify:

### Database Verification
```bash
# Run this in Supabase SQL Editor
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'notifications') as notifications_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'push_tokens') as push_tokens_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'notification_preferences') as preferences_table,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'user_status' AND column_name = 'last_active') as last_active_column;

-- All should return 1
```

### Hang Channel Verification
**Before fix:**
```
LOG  📡 Status channel status: CHANNEL_ERROR  ❌
LOG  ❌ Hang status channel error
LOG  🔄 Scheduling hang real-time restart...
```

**After fix:**
```
LOG  📡 Status channel status: SUBSCRIBED  ✅
LOG  ✅ Hang channel SUBSCRIBED
```

### Push Token Registration
**Test in app:**
1. Launch app on physical device
2. Check logs for:
```
LOG  📱 Push token: ExponentPushToken[xxxxxx]
LOG  ✅ Push token saved to database
```

### Backend Logs (Railway)
Check for:
```
✅ notificationService loaded
✅ engagementService loaded
✅ Engagement scheduler started (runs daily at 6 PM)
✅ Notification routes registered
```

---

## 🎯 IMPLEMENTATION ORDER

**DO IN THIS EXACT ORDER:**

1. ✅ **Fix hang channel bug** (5 min) - MOST CRITICAL
2. ✅ **Deploy database schema** (10 min)
3. ✅ **Add Expo project ID** (5 min)
4. ✅ **Install backend dependencies** (3 min)
5. ✅ **Install frontend dependencies** (3 min)
6. ✅ **Rebuild app** (if using Expo Go, just refresh)
7. ✅ **Test on physical device** (20 min)

**Total Time:** ~45 minutes

---

## 🔍 VERIFICATION SCRIPT

After all fixes, test each notification type:

### Test 1: Plan Invitation
1. User A creates plan
2. User A invites User B
3. **Expected:** User B gets notification + push (if offline)

### Test 2: Chat Message
1. User A sends message in plan
2. **Expected:** All other participants get notification + push

### Test 3: Friend Request
1. User A sends friend request to User B
2. **Expected:** User B gets notification + push
3. User B accepts
4. **Expected:** User A gets "accepted" notification

### Test 4: Status Change (Chain Effect) 🔥
1. User A goes online (toggles status)
2. **Expected:** ALL friends of User A get notification
3. Check backend logs for "Chain effect triggered"

### Test 5: In-App Notification Center
1. Open Notifications tab
2. **Expected:** See all notifications from tests above
3. Tap notification → should navigate to correct screen
4. Mark as read → badge count decreases

### Test 6: Push Notification
1. Close app completely
2. Have friend invite you to plan
3. **Expected:** Push notification appears
4. Tap push → app opens to correct screen

---

## 🚨 IF SOMETHING STILL FAILS

### Hang Channel Still Erroring
**Debug:**
1. Check Supabase RLS policies on `user_status` table
2. Verify user has permission to SELECT from `user_status`
3. Check Supabase logs for RLS denials

### Notifications Not Appearing
**Debug:**
1. Check Supabase logs for INSERT errors
2. Verify RLS policy "Service role can insert notifications" exists
3. Check backend is using service role key (not anon key)

### Push Not Working
**Debug:**
1. Verify Expo project ID is correct
2. Check push token saved to database: `SELECT * FROM push_tokens LIMIT 5;`
3. Test push manually: https://expo.dev/notifications
4. Check backend has `expo-server-sdk` installed

### Chain Effect Not Triggering
**Debug:**
1. Verify hang channel is SUBSCRIBED (not CHANNEL_ERROR)
2. Check `backend/routes/user.js` has status update handler
3. Check `backend/services/engagementService.js` is loaded
4. Look for "Chain effect triggered" in Railway logs

---

## 📞 NEED HELP?

If blocked after trying all fixes:

1. **Check Supabase Logs:** Dashboard → Logs → Filter by "error"
2. **Check Railway Logs:** Dashboard → Deployments → Latest → Logs
3. **Check App Logs:** Look for error messages before notification fails
4. **Export Database Schema:** 
   ```bash
   # Compare with expected schema
   pg_dump -s -h your-db.supabase.co -U postgres your-db
   ```

---

## ✅ SUCCESS CRITERIA

You'll know everything works when:

- ✅ Hang channel shows "SUBSCRIBED" in logs (no more errors)
- ✅ Creating plan sends notifications to invited users
- ✅ Chat messages trigger notifications
- ✅ Friend requests send notifications
- ✅ Going online triggers chain effect (friends get notified)
- ✅ Push notifications arrive when app closed
- ✅ Notification center shows all notifications
- ✅ Badge count is accurate
- ✅ Tapping notifications navigates correctly
- ✅ No error spam in logs

---

**Good luck! These fixes are straightforward but critical. Start with #1 (hang channel) as it's the most urgent.** 🚀

