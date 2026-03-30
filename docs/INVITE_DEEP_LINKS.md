# Invite links, deep links, and web landing (full handoff)

This document describes the **end-to-end invite flow** for Free to Hang: what the mobile app already does, what must be hosted on **freetohang.com**, and how to verify Universal Links (iOS) and App Links (Android).

## Product behaviour (target)

| Step | Behaviour |
|------|-----------|
| 1 | User A shares `https://freetohang.com/invite/<username-or-user-id>` from the app. |
| 2 | User B opens the link on a phone **without** the app installed | Your **website** shows App Store / Google Play buttons (and optional short pitch). |
| 3 | User B opens the link **with** the app installed | OS opens the app on route **`/invite/<ref>`** → **`UserProfileModal`** for that user (after sign-in if needed). |
| 4 | User B is logged out | App shows sign-in / sign-up; after auth + onboarding, app **resumes** the invite via `AsyncStorage` (`@freetohang/pending_invite_ref`). |

## What the app implements today

### URLs and sharing

- **Public web origin:** `https://freetohang.com` (`PUBLIC_WEB_HOST` / `PUBLIC_WEB_ORIGIN` in `constants/config.ts`).
- **Invite URL pattern:** `https://freetohang.com/invite/<ref>` where `<ref>` is **username** (preferred) or **Supabase user UUID** (fallback when username missing).
- **Share message (English):** `Join me on Free to Hang! <full https URL>`
- **Android share title:** `Join Free to Hang`

### In-app routing

- **Expo Router screen:** `app/invite/[ref].tsx`
- **Profile UI:** `UserProfileModal` with resolved `userId` from `lib/invite-link.ts` → `resolveInviteRefToUserId`.
- **Custom scheme (dev / fallback):** `freetohang://invite/<ref>` (scheme from `app.json` → `scheme`: `freetohang`).

### Native OS association (prepared in repo)

- **`app.json`:** `ios.associatedDomains`, `android.intentFilters` for `https://freetohang.com/invite` and `https://www.freetohang.com/invite`.
- **`android/app/src/main/AndroidManifest.xml`:** matching `intent-filter` entries with `android:autoVerify="true"`.
- **`ios/FreetoHang/FreetoHang.entitlements`:** `com.apple.developer.associated-domains` for `applinks:freetohang.com` and `applinks:www.freetohang.com`.

> After `expo prebuild`, re-check that native files still match `app.json` or re-run prebuild so they stay in sync.

### Auth / navigation edge cases

- **`contexts/AuthContext.tsx`** does **not** redirect guests away from the invite route (segment `invite`), so deep links can show the guest CTA.
- **Pending invite:** `lib/pending-invite-ref.ts` stores the ref when the user taps Sign in / Sign up from the invite screen; after `hasCheckedOnboarding` and session are ready, auth navigates with `router.replace('/invite/<ref>')`.

### Supabase / RLS

- Resolving `<ref>` → user id uses `supabase.from('users').select('id')` with `.eq('id', …)` for UUID-shaped refs, else `.eq('username', …)` then `.ilike('username', …)`.
- **Requires an authenticated session** and RLS policies that allow the reader to see that row (your migrations already aim for authenticated read of basic profile fields). Anonymous users **do not** load the profile; they only see the sign-in CTA until logged in.

---

## What you must add on the web (freetohang.com)

Until this is live, HTTPS invite links will open in the browser and may 404. The app is still valid for App Store; the **website** completes the “no app installed” path.

### 1. Hosts

- Primary: `freetohang.com`
- Optional redirect: `www.freetohang.com` → keep paths identical (`/invite/...`).

### 2. Human landing page: `/invite/[ref]`

Serve a small page that:

1. Shows app name and one line of value (“See when friends are free to hang”).
2. Buttons:
   - **iOS:** App Store URL (replace when the app is approved).
   - **Android:** Play Store URL.
3. Optional: “Open in app” button using the **same** `https://freetohang.com/invite/<ref>` URL (on mobile with the app installed, Universal Links / App Links should open the app).

You do **not** have to read `<ref>` server-side for a minimal version; you can use a single static template. For nicer UX, you can call your backend/Supabase (service role) to show the inviter’s **display name** (careful with privacy and rate limits).

### 3. iOS Universal Links — `apple-app-site-association` (AASA)

**Requirements:**

- Served at **`https://freetohang.com/.well-known/apple-app-site-association`**
- **No** file extension; **`Content-Type: application/json`** (many CDNs work with `application/json`; avoid `text/plain` if possible).
- **HTTPS only.**

**Template** (replace `TEAMID` with your Apple Developer Team ID, e.g. `ABCDE12345`):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.freetohang.app",
        "paths": ["/invite/*"]
      }
    ]
  }
}
```

**Apple validation:**

- Xcode: Associated Domains capability (already reflected in entitlements when using `applinks:`).
- After deploy: test on a real device (Simulator behaviour can differ).

**References:** [Apple — Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)

### 4. Android App Links — Digital Asset Links

**Requirements:**

- Served at **`https://freetohang.com/.well-known/assetlinks.json`**
- **`Content-Type: application/json`**
- List **all** signing certificate **SHA-256** fingerprints you use (Play App Signing + optional upload key if applicable).

**Template** (replace `SHA256_FINGERPRINT`):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.freetohang.app",
      "sha256_cert_fingerprints": ["SHA256_FINGERPRINT"]
    }
  }
]
```

Get fingerprints:

- Play Console → App signing, or  
- `keytool -list -v -keystore your-release.keystore`

**Verify:** `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://freetohang.com&relation=delegate_permission/common.handle_all_urls`

**References:** [Android — Verify Android App Links](https://developer.android.com/training/app-links/verify-android-applinks)

### 5. Optional: same files on `www`

If you use `www.freetohang.com` in intent filters and associated domains, mirror:

- `https://www.freetohang.com/.well-known/apple-app-site-association`
- `https://www.freetohang.com/.well-known/assetlinks.json`

Or 301 `www` → apex and rely only on apex (then you could remove `www` from native config — keep app and site consistent).

---

## Testing checklist

### Custom scheme (works without website)

```bash
# iOS Simulator (example)
npx uri-scheme open "freetohang://invite/USERNAME" --ios

# Android (adb)
adb shell am start -W -a android.intent.action.VIEW -d "freetohang://invite/USERNAME" com.freetohang.app
```

### HTTPS (needs AASA + assetlinks + install)

- Install a **release** or **TestFlight** build (Universal Links often misbehave with dev clients).
- Open `https://freetohang.com/invite/USERNAME` from Mail / Notes / Safari.
- Expected: app opens to invite profile flow (or website if app not installed).

### Guest → sign-in → profile

1. Log out, open invite link (or custom scheme).
2. Tap Sign in, complete auth and onboarding.
3. App should `replace` to `/invite/<stored ref>` and show `UserProfileModal`.

---

## File map (engineering)

| Area | Files |
|------|--------|
| Web origin + URL builder | `constants/config.ts` |
| Share copy + resolve ref | `lib/invite-link.ts` |
| Pending ref storage | `lib/pending-invite-ref.ts` |
| Invite UI + modal | `app/invite/[ref].tsx`, `components/UserProfileModal.tsx` |
| Auth / routing | `contexts/AuthContext.tsx` |
| Stack presentation | `app/_layout.tsx` |
| Native association | `app.json`, `AndroidManifest.xml`, `ios/.../FreetoHang.entitlements` |

---

## Future enhancements (not required for v1)

- Deferred deep linking / Install Referrer / SKAdNetwork (attribution).
- Server-rendered invite page with inviter avatar (use Edge Function + cache).
- Branch.io / Firebase Dynamic Links–style abstraction (cost + complexity).

This document + the current app code together are the **full handoff** for an engineer or agency to finish hosting and verify store links.
