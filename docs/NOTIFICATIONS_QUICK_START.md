# 🔔 Notifications System - Quick Start

## What Was Built

A complete 3-layer notification system for Free to Hang:

1. **In-App Notification Center** 📱
   - Feed of all notifications
   - Real-time updates via Supabase
   - Badge counter on tab bar
   - Mark as read/delete functionality

2. **Event-Based Push Notifications** 🔔
   - Plan invitations
   - Chat messages
   - Poll updates
   - Friend requests
   - Status changes

3. **Strategic Engagement (MVP)** 🎯
   - Chain effect: Friend goes online → notify all friends
   - Re-engagement: Inactive 3+ days → "Miss making memories?"

---

## Files Created

```
docs/
├── NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md  [MAIN GUIDE - 500+ lines]
└── NOTIFICATIONS_QUICK_START.md                  [This file]

scripts/
└── notifications-schema.sql                      [Database setup]

CODEX_NOTIFICATIONS_PROMPT.txt                   [For GPT Codex]
```

---

## How to Use

### Option 1: Give to GPT Codex (Recommended)

Copy this prompt and send to GPT-4 or Claude:

```
Read the file CODEX_NOTIFICATIONS_PROMPT.txt and follow all instructions.
Then implement the notification system by following the guide in 
docs/NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md

Start by reading both files completely, then begin implementation.
```

### Option 2: Manual Implementation

1. **Database Setup** (5 min)
   ```sql
   -- Go to Supabase SQL Editor
   -- Copy and paste contents of: scripts/notifications-schema.sql
   -- Run the script
   ```

2. **Backend** (2-3 hours)
   ```bash
   cd backend
   npm install expo-server-sdk node-cron
   ```
   Then follow: `docs/NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md` (Backend section)

3. **Frontend** (3-4 hours)
   ```bash
   npx expo install expo-notifications expo-device
   ```
   Then follow: `docs/NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md` (Frontend section)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER ACTION                           │
│         (creates plan, sends message, goes online)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND / DATABASE                         │
│  • API routes trigger notification creation                  │
│  • Database triggers auto-create notifications               │
│  • Engagement scheduler runs daily                           │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Database  │  │  Realtime  │  │    Push    │
│   Record   │  │   Update   │  │ Notification│
└────────────┘  └────────────┘  └────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND APP                           │
│  • Notification Center shows all notifications              │
│  • Real-time subscription updates instantly                  │
│  • Push notification handler navigates                       │
│  • Badge counter updates                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Tables

### `notifications`
Stores all notifications for the in-app feed.

**Key columns:**
- `user_id` - who receives this
- `type` - notification type (plan_invite, chat_message, etc.)
- `title` / `body` - notification content
- `data` - JSONB with navigation info (plan_id, user_id, etc.)
- `read` - boolean read status
- `triggered_by` - who caused this notification

### `push_tokens`
Stores Expo push tokens for each user's devices.

**Key columns:**
- `user_id` - token owner
- `expo_push_token` - the actual token
- `device_type` - ios/android/web
- `active` - whether token is still valid

### `notification_preferences`
User settings for notifications.

**Key columns:**
- `push_enabled` - master switch
- `plan_notifications`, `chat_notifications`, etc. - category toggles
- `quiet_hours_enabled` / `quiet_hours_start` / `quiet_hours_end`

---

## Key Features

### Chain Effect 🔗
When a user goes online:
1. Update their `user_status.is_available = true`
2. Backend catches this change
3. Finds all their friends
4. Sends notification to each friend: "X is free to hang!"
5. Creates chain reaction of online activity

### Re-engagement 📅
Daily at 6 PM:
1. Find users inactive for 3+ days
2. Check if they have active friends
3. If yes, send: "Miss making memories? Show you're free tonight"
4. Gentle nudge to return to app

### Smart Push Logic 🧠
Push notifications are only sent if:
- User is NOT active in app (last_active > 2 minutes ago)
- Push notifications are enabled
- Not in quiet hours
- Category preference is enabled

---

## Notification Types

| Type | Description | Navigation |
|------|-------------|------------|
| `plan_invite` | Invited to plan | Plan detail |
| `plan_participant_joined` | Someone joined plan | Plan detail |
| `poll_created` | New poll in plan | Plan detail |
| `poll_ended` | Poll winner chosen | Plan detail |
| `chat_message` | New chat message | Plan chat tab |
| `friend_request` | New friend request | Friend's profile |
| `friend_accepted` | Friend accepted request | Friend's profile |
| `status_change` | Friend went online | Friend's profile |
| `engagement_friends_online` | Multiple friends online | Hang tab |
| `engagement_comeback` | Re-engagement nudge | Plans tab |

---

## Testing Checklist

Quick verification after implementation:

**In-App:**
- [ ] Notifications tab visible
- [ ] Badge shows unread count
- [ ] Can see list of notifications
- [ ] Tapping notification navigates correctly
- [ ] Can mark as read
- [ ] Real-time updates work

**Push:**
- [ ] Token registered on login
- [ ] Receive push when app closed
- [ ] Tapping push navigates correctly
- [ ] Badge updates

**Chain Effect:**
- [ ] User A goes online
- [ ] User B (friend) gets notification instantly

---

## MVP Priorities

Focus on these first:

1. ✅ Plan invitations
2. ✅ Chat messages  
3. ✅ Poll updates
4. ✅ Friend requests
5. ✅ Chain effect (status changes)

Nice to have (later):
- Re-engagement scheduler
- Notification preferences UI
- Quiet hours
- Rich push notifications

---

## Estimated Time

| Phase | Time |
|-------|------|
| Database setup | 30 min |
| Backend services | 2-3 hours |
| Frontend UI | 3-4 hours |
| Integration & testing | 1-2 hours |
| **Total** | **7-10 hours** |

---

## Resources

- **Main Guide:** `docs/NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md`
- **Database Script:** `scripts/notifications-schema.sql`
- **Codex Prompt:** `CODEX_NOTIFICATIONS_PROMPT.txt`
- **Expo Docs:** https://docs.expo.dev/push-notifications/
- **Supabase Realtime:** https://supabase.com/docs/guides/realtime

---

## Support

If you get stuck:

1. Check the implementation guide (most answers are there)
2. Check Supabase logs for RLS errors
3. Check console for subscription errors
4. Test with physical device (not simulator)
5. Verify Expo project ID in app.json

---

## Success Criteria

Implementation is complete when:

✅ All notification types work end-to-end
✅ Push notifications received on physical device  
✅ Real-time updates instant
✅ Chain effect triggers on status change
✅ Badge counts accurate
✅ Navigation works from all notifications
✅ UI polished and user-friendly

---

**Ready to build? Start with: `CODEX_NOTIFICATIONS_PROMPT.txt`** 🚀

