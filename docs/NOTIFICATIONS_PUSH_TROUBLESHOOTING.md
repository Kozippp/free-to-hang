# 🚨 PUSH NOTIFICATIONS TROUBLESHOOTING

**Date:** November 22, 2025  
**Issue:** Push notifications not working in iOS simulators  
**Status:** ROOT CAUSE IDENTIFIED

---

## 🔴 ROOT CAUSE #1: iOS SIMULATOR LIMITATION

### ❌ THE MAIN PROBLEM

**Push notifications DO NOT WORK in iOS Simulators!**

This is an **Apple limitation**, not a bug in your code:

```
❌ iOS Simulator → NO push notifications
✅ Physical iPhone → Push notifications work
✅ Android Emulator → Push notifications work (Android only)
```

### Why This Happens

Apple's Push Notification service (APNs) requires:
1. Real device with Apple ID
2. Valid push certificate
3. Physical hardware security features

**Simulators cannot receive push notifications from APNs.**

### Solution

**You MUST test on a physical iPhone!**

---

## 🟡 ROOT CAUSE #2: Backend Not Deployed

### Check Railway Deployment

Your notification system backend needs to be deployed to Railway with the new code.

**Current Status Check:**

```bash
# Check if Railway has latest commits
git log origin/Hakkame-chati-looma --oneline -5

# Should show:
# 74163fe fix: Improve GestureHandlerRootView styling
# c899e18 docs: Add quick next steps guide for human
# b2acab1 docs: Add comprehensive Codex implementation review
# 0da246c Install Expo notifications dependencies
# d15266d Apply notification schema + expo config fixes
```

**If Railway hasn't deployed:**
1. Go to Railway dashboard
2. Check if auto-deploy triggered
3. Manually trigger deploy if needed
4. Wait 2-3 minutes for deployment

---

## 🟡 ROOT CAUSE #3: Backend Routes Not Integrated

### Missing Integration in Plans Route

The notification creation needs to be called when plan is created and participants are invited.

**File:** `backend/routes/plans.js`

**Current status:** Notification service exists but may not be called in the right places.

**What needs to happen when plan is created:**

1. Plan created in database ✅ (working)
2. Participants invited ✅ (working)
3. **Notification created for each invited user** ⚠️ (check this)
4. **Push notification sent** ⚠️ (check this)

---

## 🟡 ROOT CAUSE #4: Push Token Not Registered

### Check if Push Tokens Are Being Saved

**Test in app logs:**

After logging in, you should see:
```
LOG  📱 Push token: ExponentPushToken[xxxxxx]
LOG  ✅ Push token saved to database
```

If you DON'T see this:
- Push token registration failed
- Check `utils/pushNotifications.ts` is being called
- Check database table `push_tokens` exists

**Verify in database:**

```sql
-- Run in Supabase SQL Editor
SELECT * FROM push_tokens 
WHERE user_id = 'your-user-id';

-- Should return rows with expo_push_token
```

---

## ✅ VERIFICATION CHECKLIST

### 1. Database Schema Deployed? ✅

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('notifications', 'push_tokens', 'notification_preferences');
```

**Expected:** 3 rows

**Status:** ✅ Codex confirmed this is deployed

---

### 2. Backend Dependencies Installed? ✅

```bash
# Check backend/package.json
grep "expo-server-sdk" backend/package.json
grep "node-cron" backend/package.json
```

**Expected:** Both packages present

**Status:** ✅ Codex confirmed installed

---

### 3. Frontend Dependencies Installed? ✅

```bash
# Check package.json
grep "expo-notifications" package.json
grep "expo-device" package.json
```

**Expected:** Both packages present

**Status:** ✅ Codex confirmed installed

---

### 4. Expo Project ID Configured? ✅

```bash
# Check app.json
grep "projectId" app.json

# Check utils/pushNotifications.ts
grep "EXPO_PROJECT_ID" utils/pushNotifications.ts
```

**Expected:** Same ID in both files: `18a79a9c-af0a-4fb5-a752-3831e49d89ba`

**Status:** ✅ Codex confirmed configured

---

### 5. Backend Notification Routes Integrated? ⚠️

**This is the likely problem!**

Check if `backend/routes/plans.js` calls notification service when:
- Plan is created
- User is invited to plan
- Plan is updated

**Expected code:**

```javascript
const { notifyUser, NotificationTemplates } = require('../services/notificationService');

// In create plan route:
router.post('/', verifyToken, async (req, res) => {
  // ... create plan ...
  
  // Notify invited users
  for (const inviteeId of invitedUserIds) {
    const template = NotificationTemplates.plan_invite(plan.title, creator.name);
    await notifyUser({
      userId: inviteeId,
      ...template,
      data: { plan_id: plan.id },
      triggeredBy: creator.id
    });
  }
});
```

**Check this file:** `backend/routes/plans.js`

---

### 6. Railway Deployment Status? ⚠️

**Check Railway logs:**

```
✅ notificationService loaded
✅ engagementService loaded
✅ Engagement scheduler started
```

If you DON'T see these:
- Backend not deployed with new code
- Deployment failed
- Need to manually deploy

---

### 7. Push Token Registration Working? ⚠️

**Check app logs after login:**

Should see:
```
LOG  📱 Requesting push notification permissions...
LOG  📱 Push token: ExponentPushToken[xxxxxx]
LOG  ✅ Push token saved to database
```

If you see:
```
LOG  ❌ Must use physical device for Push Notifications
```

→ **This is normal in simulator!** Push notifications won't work.

---

## 🎯 TESTING STRATEGY

### Stage 1: Test In-App Notifications (Simulator OK)

**What to test:**
1. ✅ Create plan
2. ✅ Invite user
3. ✅ Check if notification appears in Notifications tab (not push, just in-app)
4. ✅ Check database for notification record

**How to test:**

```sql
-- Check if notification was created
SELECT * FROM notifications 
WHERE user_id = 'invited-user-id'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Notification record exists

**If NO record:** Backend integration is missing (see ROOT CAUSE #3)

---

### Stage 2: Test Push Notifications (Physical Device REQUIRED)

**Requirements:**
- ✅ Physical iPhone (not simulator)
- ✅ Expo Go app installed
- ✅ Logged into app
- ✅ Push permissions granted

**Test steps:**

1. **Device A (Physical iPhone):**
   - Open Expo Go
   - Scan QR code
   - Log in as User A
   - Check logs for push token registration
   - **Close app completely** (swipe up)

2. **Device B (Simulator or Physical):**
   - Open app
   - Log in as User B
   - Create plan
   - Invite User A

3. **Device A (Closed):**
   - **Should receive push notification** 🔔
   - Tap notification
   - Should open app to plan detail

**Expected Results:**
- ✅ Notification appears on lock screen
- ✅ Sound/vibration
- ✅ Tapping opens app

**If NO push:**
- Check backend logs for push sending
- Check Expo push receipt errors
- Verify push token in database

---

## 🐛 DEBUGGING STEPS

### Step 1: Check Database for Notification Records

```sql
-- Run in Supabase SQL Editor
SELECT 
  n.id,
  n.type,
  n.title,
  n.body,
  n.read,
  n.created_at,
  u.name as user_name,
  t.name as triggered_by_name
FROM notifications n
JOIN users u ON n.user_id = u.id
LEFT JOIN users t ON n.triggered_by = t.id
ORDER BY n.created_at DESC
LIMIT 10;
```

**Expected:** Notification records when plan created and users invited

**If NO records:** Backend integration is missing!

---

### Step 2: Check Backend Logs (Railway)

Look for:
```
✅ Notification created: [notification-id]
✅ Push notification sent to: [user-id]
```

**If you see:**
```
ℹ️ User is active in app, skipping push notification
```
→ This is correct! Push only sent when user offline.

**If you see:**
```
ℹ️ No push tokens found for user: [user-id]
```
→ Push token not registered (use physical device)

**If you see:**
```
❌ Error creating notification: [error]
```
→ Backend integration issue (see fixes below)

---

### Step 3: Test Push Token Registration

**In app console, after login:**

```
LOG  📱 Push token: ExponentPushToken[xxxxxxxxxxxxx]
```

**Copy this token and test manually:**

1. Go to https://expo.dev/notifications
2. Paste the token
3. Send test notification
4. **Should receive on physical device**

**If test notification arrives:**
→ Token is valid, backend integration is the issue

**If test notification does NOT arrive:**
→ Token is invalid or device permissions issue

---

## 🔧 FIXES REQUIRED

### Fix #1: Integrate Notifications in Plans Route

**File:** `backend/routes/plans.js`

**Current:** Missing notification calls

**Required:** Add notification creation when plan created

See detailed implementation in section below.

---

### Fix #2: Deploy to Railway

**Action:**
1. Ensure all commits are pushed to GitHub ✅ (already done)
2. Check Railway auto-deploy triggered
3. Verify logs show notification services loaded

---

### Fix #3: Test on Physical Device

**Action:**
1. Get physical iPhone
2. Install Expo Go
3. Scan QR code
4. Complete test flow

**Why:** Simulators CANNOT receive push notifications

---

## 📋 FOR CODEX: IMPLEMENTATION CHECKLIST

### Task 1: Verify Backend Integration

**Check file:** `backend/routes/plans.js`

**Look for:**
```javascript
const { notifyUser, NotificationTemplates } = require('../services/notificationService');
```

**If NOT present:**
- Import notification service
- Add notification calls in appropriate routes

---

### Task 2: Add Notification Calls

**When plan is created (POST /api/plans):**

```javascript
// After plan created and participants invited
for (const participant of invitedUsers) {
  if (participant.id !== creator.id) {
    const template = NotificationTemplates.plan_invite(plan.title, creator.name);
    await notifyUser({
      userId: participant.id,
      ...template,
      data: { plan_id: plan.id },
      triggeredBy: creator.id
    });
  }
}
```

**When participant joins:**

```javascript
const template = NotificationTemplates.plan_participant_joined(plan.title, joiner.name);
await notifyUser({
  userId: plan.creator_id,
  ...template,
  data: { plan_id: plan.id },
  triggeredBy: joiner.id
});
```

---

### Task 3: Verify Railway Deployment

**Check Railway dashboard:**
- Latest commit deployed
- No build errors
- Services running

**Check logs for:**
```
✅ notificationService loaded
✅ engagementService loaded
```

---

### Task 4: Document Testing Requirements

**Update test documentation:**
- ❌ Simulators cannot test push notifications
- ✅ Physical device required
- ✅ In-app notifications work in simulator

---

## 🎯 SUCCESS CRITERIA

### Minimal Working System

**In Simulator (Limited):**
1. ✅ Create plan → notification record in database
2. ✅ Notification appears in Notifications tab
3. ✅ Badge count updates
4. ❌ No push notification (expected)

**On Physical Device (Full):**
1. ✅ Create plan → notification record in database
2. ✅ Notification appears in Notifications tab
3. ✅ Push notification received when app closed
4. ✅ Tapping push opens correct screen
5. ✅ Badge count updates

---

## 📊 CURRENT STATUS

```
✅ Database schema deployed
✅ Frontend dependencies installed
✅ Backend dependencies installed
✅ Expo project ID configured
⚠️ Backend routes integration - NEEDS VERIFICATION
⚠️ Railway deployment - NEEDS VERIFICATION
❌ Physical device testing - NOT DONE (simulators used)
```

---

## 🚀 NEXT STEPS

### Immediate (for Codex):

1. **Verify backend integration** in `backend/routes/plans.js`
2. **Add missing notification calls** if not present
3. **Deploy to Railway** and verify logs
4. **Document simulator limitations**

### After Backend Fixed (for Human):

1. **Test in simulator:** In-app notifications only
2. **Get physical iPhone:** Required for push testing
3. **Complete full test:** All notification types
4. **Verify chain effect:** Friend goes online

---

## 📞 SUMMARY FOR HUMAN

**Why push notifications not working:**

1. 🔴 **Main reason:** iOS simulators CANNOT receive push notifications
2. 🟡 **Possible reason:** Backend routes may not be creating notifications
3. 🟡 **Possible reason:** Railway not deployed with new code

**What works in simulator:**
- ✅ In-app notification center
- ✅ Database notification records
- ✅ Badge counts

**What needs physical device:**
- ❌ Push notifications
- ❌ Push sound/vibration
- ❌ Lock screen notifications

**Next action:**
1. Codex: Verify backend integration
2. Human: Test on physical iPhone

---

_End of troubleshooting guide._

