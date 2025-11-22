# 📱 Push Notifications Testing Guide

## ⚠️ Important: Physical Device Required

**Push notifications DO NOT work on iOS Simulator!**  
You must test on a real iPhone/iPad.

## 🚀 Quick Start (Physical Device)

### 1. Connect Your iPhone
```bash
# Connect iPhone via USB cable to your Mac
# Unlock the iPhone and trust the computer
```

### 2. Build and Install on Device
```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang
npx expo run:ios --device
```

### 3. Grant Permissions
- App will prompt for notification permissions
- Tap "Allow" when asked
- Verify in: iPhone Settings → Free to Hang → Notifications

## ✅ Verification Checklist

### Check 1: Registration Success
Look for console logs:
```
✅ Push token saved
🔔 Push token: ExponentPushToken[xxxxxxxxxxxxxx]
```

### Check 2: Database Entry
In Supabase `push_tokens` table:
- `user_id` matches logged-in user
- `expo_push_token` starts with "ExponentPushToken["
- `device_type` is "ios"
- `active` is `true`
- `last_used_at` is recent

### Check 3: Test Notification
Use the backend test endpoint:
```bash
curl -X POST https://your-railway-url.up.railway.app/api/test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "title": "Test Notification",
    "body": "This is a test message"
  }'
```

## 🔧 Troubleshooting

### Problem: No push token
**Solution:**
1. Check device is physical (not simulator)
2. Verify Expo project ID in `app.json`:
   ```json
   "extra": {
     "eas": {
       "projectId": "18a79a9c-af0a-4fb5-a752-3831e49d89ba"
     }
   }
   ```
3. Check permissions are granted

### Problem: Token not saved to database
**Solution:**
1. Check Supabase connection (see console for errors)
2. Verify `push_tokens` table exists
3. Check user is authenticated

### Problem: Notifications not arriving
**Solution:**
1. Check backend logs for send errors
2. Verify push token is valid
3. Test with Expo's push notification tool:
   https://expo.dev/notifications

## 📊 Current Implementation

### Registration Flow
1. User logs in → `AuthContext` provides user ID
2. `app/_layout.tsx` calls `registerForPushNotifications(userId)`
3. App requests iOS permissions
4. Expo generates push token
5. Token saved to `push_tokens` table

### Notification Types
- **Friend Requests:** "X sent you a friend request"
- **Plan Invitations:** "X invited you to plan"
- **Plan Updates:** "Plan updated"
- **Messages:** "New message from X"
- **Engagement:** "Haven't seen you in a while!"

### Badge Management
- Unread count shown on Notifications tab
- iOS badge auto-updates via `Notifications.setBadgeCountAsync()`
- Badge clears when notifications are read

## 🧪 Testing Scenarios

### Test 1: Friend Request
1. User A sends friend request to User B
2. User B should receive push notification
3. Badge count increments on User B's device
4. Tapping notification opens app

### Test 2: Plan Invitation
1. User A creates plan and invites User B
2. User B receives notification
3. Notification shows plan details
4. Tapping opens Plans tab

### Test 3: Real-time Message
1. User A sends message in plan chat
2. User B (not in chat) receives notification
3. Tapping opens chat screen

## 🔐 Security & Privacy

### Token Security
- Tokens are user-specific
- Active flag allows disabling without deletion
- Old tokens auto-deactivated on new login

### Permission Handling
- User can deny permissions (app still works)
- Permission status stored locally
- Re-prompt available in profile settings

## 📚 Related Documentation
- `QUICK_FIX_NOTIFICATIONS.md` - Setup and error fixing
- `docs/NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md` - Full system docs
- `utils/pushNotifications.ts` - Client-side implementation
- `backend/services/notificationService.js` - Backend service

## 🎯 Production Checklist

Before going live:
- [ ] Test all notification types on physical device
- [ ] Verify badge counts update correctly
- [ ] Test notification tap actions
- [ ] Check permission denial flow
- [ ] Test with multiple users
- [ ] Verify backend error handling
- [ ] Test token refresh on re-login
- [ ] Check notification throttling works
- [ ] Test deep linking from notifications
- [ ] Verify production Expo project ID

## 💡 Tips

### During Development
- Keep physical device connected via USB
- Use Safari Web Inspector to see logs
- Test with TestFlight for realistic experience

### Expo Push Token Format
```
ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
```
- Always starts with "ExponentPushToken["
- Contains alphanumeric characters
- Ends with "]"

### Rate Limits
Expo has rate limits:
- 600 notifications/second
- 10 million/day
- More info: https://docs.expo.dev/push-notifications/sending-notifications/

---

**Last Updated:** 2025-11-22  
**Version:** iOS 1.0.0  
**Expo SDK:** 53.0.11

