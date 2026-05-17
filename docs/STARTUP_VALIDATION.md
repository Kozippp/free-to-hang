# iOS startup validation checklist

Run on a **production / TestFlight** build after each startup optimization release. Compare `[startup]` logs in dev or Sentry breadcrumbs in production.

## Cold start (logged-in, onboarding complete)

1. Force-quit the app, then launch.
2. **Expected:** Hang or Plans tab visible within ~2–4s (network dependent).
3. **Expected:** No welcome video modal.
4. **Expected:** No long white `Loading...` overlay (brief flash OK).
5. **Expected:** Badges and realtime updates appear within a few seconds after UI is visible.

## Cold start (logged out)

1. Sign out, force-quit, launch.
2. **Expected:** Sign-in screen without multi-second blank screen.

## New user onboarding + welcome video

1. Complete onboarding through step 4.
2. **Expected:** Welcome video shows once on entering tabs.
3. Force-quit and reopen.
4. **Expected:** Video does **not** show again.

## Notification deep link

1. Tap a push notification from killed state.
2. **Expected:** App opens and navigates to the correct plan/chat after auth is ready.

## Realtime smoke test (after deferred start)

1. With app open, have another user send a friend request or plan invite.
2. **Expected:** Notification tab / badges update without restarting the app.

## Manual timing (optional)

In Xcode Instruments or by watching Sentry breadcrumbs for phases:

- `fonts_loaded`
- `session_loaded`
- `onboarding_resolved` (cache or server)
- `tabs_layout_mounted`
- `realtime_deferred_start` → `realtime_started`

Target: `onboarding_resolved` (cache) under ~2s on mid-range iPhone on good network.
