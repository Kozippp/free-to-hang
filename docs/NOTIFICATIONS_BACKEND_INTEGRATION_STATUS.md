# Notifications Backend Integration Status

**Date:** 22 Nov 2025  
**Engineer:** GPT Codex

## Findings
1. `backend/routes/plans.js` (`sendPlanInviteNotifications`, lines ~148-201) did not filter invitees, lacked logging, and missed the `screen` payload expected by the mobile Notifications tab.  
2. `backend/routes/plans.js` (`router.post('/')`, lines ~996-1159) did not call the notification helper after inserting invited participants, so no in-app notification entries were produced for invitees.  
3. `backend/routes/chat.js` (`router.post('/:planId/messages')`, lines ~333-382) referenced an undefined `senderId`, skipped `screen: 'Chat'` in the notification payload, and silently ignored per-user failures.  
4. `backend/routes/friends.js` already imports `notificationService` and correctly sends notifications for friend requests (`/request`, lines ~10-79) and acceptances (`/request/accept`, lines ~132-188); no regression detected.

## Changes Implemented
- Hardened `sendPlanInviteNotifications` to de-duplicate invitees, skip the creator, wrap Supabase fetches in try/catch, include `screen: 'PlanDetail'`, and emit structured logging.
- Invoked `sendPlanInviteNotifications` immediately after invited participants are inserted inside `POST /plans` so every invite persists an in-app notification before the response returns.
- Reworked chat message notification flow to fetch plan/participants/sender in parallel, guard against missing data, include `screen: 'Chat'`, cap previews at 100 characters, and log per-recipient success or failure.
- Added defensive logging so backend logs now reveal whether notification helpers succeed, enabling Railway log-based audits.

## Verification & Testing
- ✅ Static verification: ensured notification helpers are imported and invoked across plans, chat, and friends routes.
- ⚠️ In-app notification UI + DB verification not run here because authenticated Supabase user credentials for the dedicated test accounts were not available in this environment. Follow the manual test plan below on the simulator to confirm end-to-end behavior.

## Manual Test Plan (Simulator Friendly)
1. Launch Expo app in iOS simulator, log in as User A. Open Notifications tab to watch for new entries.  
2. Launch second simulator (or log out/in) as User B. Create a plan and invite User A.  
3. Observe simulator logs for `✅ Notified user ...` and confirm a new row appears under **Home → Notifications** for User A.  
4. In Supabase SQL editor run:
   ```sql
   select id, type, title, body, data, created_at
   from notifications
   where user_id = '<USER_A_ID>'
   order by created_at desc
   limit 5;
   ```
   Expect the latest row to have `type = plan_invite` with `data->>screen = 'PlanDetail'`.  
5. Have User B send a chat message in the plan. User A should see a notification with preview text capped at 100 chars and `data.screen = 'Chat'`.  

## Reminders
- Physical iPhone hardware is still required to validate Expo push notifications; simulators only cover the in-app feed.  
- Keep an eye on Railway logs for the `✅ Notified user ...` entries when verifying future regressions.

