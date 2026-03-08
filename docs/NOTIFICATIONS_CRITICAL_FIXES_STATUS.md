# Notifications Critical Fixes — Implementation Report

**Date:** 2025-11-22  
**Prepared for:** Sonnet 4.5 (planner)  
**Engineer:** GPT-5.1 Codex

---

## 1. Fix Overview

| # | Fix | Action | Status |
|---|-----|--------|--------|
| 1 | Hang channel wrong table | Updated `store/hangStore.ts` to subscribe to `user_status` events (`event: '*'`) and log chain-effect triggers. | ✅ Completed (`Fix hang channel subscription to user_status`) |
| 2 | Deploy notification schema | Applied `scripts/notifications-schema.sql` via Supabase MCP to project `eofjyuhygmuevxooeyid`; verified tables, `last_active` column, and RLS policies. | ✅ Completed |
| 3 | Expo project ID | Linked EAS project (`18a79a9c-af0a-4fb5-a752-3831e49d89ba`), updated `app.json` (`extra.eas.projectId`, `owner`) and `utils/pushNotifications.ts` fallback constant. | ✅ Completed |
| 4 | Backend deps | Ran `npm install expo-server-sdk node-cron` in `/backend`; confirmed `package.json` entries. | ✅ Completed |
| 5 | Frontend deps | Installed `expo-notifications@~0.31.4`, `expo-device@~7.1.4` with `--legacy-peer-deps`; `package.json` reflects tilde versions. | ✅ Completed |

Commits pushed locally (branch `Hakkame-chati-looma`):
1. `Fix hang channel subscription to user_status`
2. `Apply notification schema + expo config fixes`
3. `Install Expo notifications dependencies`

---

## 2. Verification Log

- **Realtime channel**: Expect `LOG 📡 Status channel status: SUBSCRIBED` and absence of `CHANNEL_ERROR` once app restarted.
- **Database** (Supabase SQL):
  - `SELECT table_name ...` returned `notifications`, `push_tokens`, `notification_preferences`.
  - `SELECT column_name ... user_status/last_active` returned 1 row.
  - `SELECT policyname FROM pg_policies WHERE tablename='notifications'` returned 4 policies (view/update/delete + service role insert).
- **Expo config**: `app.json` + `utils/pushNotifications.ts` share project ID `18a79a9c-af0a-4fb5-a752-3831e49d89ba`.
- **Dependencies**:
  - Backend `package.json` lists `expo-server-sdk` ^4.0.0 and `node-cron` ^3.0.3.
  - Frontend `package.json` lists `expo-notifications` `~0.31.4`, `expo-device` `~7.1.4`.

---

## 3. Outstanding / Follow-up

1. **Physical-device testing** (per prompt Fix #5):
   - Run through push-token registration, notification center, and chain effect flow on iOS/Android hardware.
2. **Backend deployment**:
   - If Railway uses auto-deploy on push, ensure latest commits are deployed; otherwise run manual restart.
3. **Expo CLI warning**:
   - `npx expo install` tried to use `bun`; if bun isn’t needed, ignore. Future installs may prefer `bun` availability or `EXPO_USE_BUN=0`.
4. **Peer dependency note**:
   - Used `--legacy-peer-deps` due to `lucide-react-native` React 19 constraint. Track upstream update or consider pinning React 18 if issues arise.
5. **Security**:
   - `npm audit` reported 4 vulnerabilities (2 low/1 moderate/1 high) after dependency install; run `npm audit fix` later if feasible.

---

## 4. Requests for Planner (Sonnet 4.5)

1. **Quality review**: Does this implementation fully satisfy the goals of `docs/NOTIFICATIONS_CRITICAL_FIXES.md` (chain effect restored, push infra ready)?
2. **Testing plan**: Should we prioritize a coordinated physical-device test session or delegate to QA?
3. **Next steps**: Any additional automation/docs the team needs (e.g., push notification checklist, monitoring alerts)?

Please review and provide guidance on further actions or adjustments.

--- 

_End of report._

---

## 5. Realtime Regression Fix

**Date:** 2026-03-08  
**Area:** `Chat -> Control Panel` realtime recovery  
**Status:** Fixed and verified on devices

### Problem

After opening a plan chat and returning to `Control Panel`, realtime updates could stop arriving on that device.
The failure was misleading because the plans realtime channels still looked connected locally, but new `plan_updates` and `plan_poll_votes` events no longer reached the screen reliably.

### Root Cause

The app could end up with a silent stale plans realtime subscription after leaving chat.
A normal subscription health check was not enough, because the plans channels still appeared active and therefore were not restarted.

### Final Fix

1. Force a real plans realtime restart specifically when the user returns from `Chat` to `Control Panel`.
2. Reload the active plan immediately after that forced restart so the Control Panel is re-synced with backend state.
3. Prevent duplicate plans realtime startup with a startup lock in `store/plansStore.ts`.

### Files Updated

- `components/plans/PlanDetailView.tsx`
- `store/plansStore.ts`
- `app/(tabs)/plans.tsx`

### Verification

- Reproduced the bug on devices before the fix.
- Confirmed that after the fix, Phone A receives poll vote updates again even after going `Chat -> Control Panel`.
- Debug instrumentation used during investigation was removed after verification.

