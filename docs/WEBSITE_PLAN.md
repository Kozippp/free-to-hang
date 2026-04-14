# Free to Hang — Website Build Plan

> **Handoff document for an AI agent or developer.**
> Read this file together with [`docs/INVITE_DEEP_LINKS.md`](./INVITE_DEEP_LINKS.md), which contains all technical details for deep-link routing, Universal Links (iOS), and App Links (Android). Both files are required to deliver a complete, production-ready website.

---

## 0. Project overview

| Property | Value |
|----------|-------|
| **App name** | Free to Hang |
| **Tagline** | See who's free to hang |
| **Sub-tagline** | One tap to show you're free — and see which friends are too. |
| **Domain** | `freetohang.com` (+ `www.freetohang.com` redirect) |
| **Bundle ID (iOS & Android)** | `com.freetohang.app` |
| **Web tech stack** | Next.js 15 (App Router) + Tailwind CSS v4 + TypeScript |
| **Deployment** | GitHub → Vercel (zero-config) |
| **Target OS** | iOS (App Store) + Android (Google Play) |

---

## 1. Tech stack rationale

Use **Next.js 15 (App Router)** with **Tailwind CSS v4** and **TypeScript**:

- Vercel-native: zero configuration needed for deployment.
- App Router enables per-route metadata (critical for SEO and the `/invite/[ref]` page).
- Static generation (`export`) for all marketing pages; dynamic rendering only for `/invite/[ref]`.
- `next/image` for optimised phone mockup images.
- No external UI library — pure Tailwind utility classes.
- `resend` (or any transactional email API) for the contact form backend route.

### Folder structure

```
/
├── app/
│   ├── layout.tsx               # Root layout, global fonts, analytics
│   ├── page.tsx                 # Landing page (all sections)
│   ├── invite/
│   │   └── [ref]/
│   │       └── page.tsx         # Invite landing (dynamic)
│   ├── privacy/
│   │   └── page.tsx
│   ├── terms/
│   │   └── page.tsx
│   ├── cookies/
│   │   └── page.tsx
│   └── api/
│       └── contact/
│           └── route.ts         # Contact form POST handler
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── Features.tsx
│   ├── HowItWorks.tsx
│   ├── Screenshots.tsx
│   ├── FAQ.tsx
│   ├── Contact.tsx
│   ├── Footer.tsx
│   ├── AppStoreBadge.tsx        # Reusable App Store / Play Store buttons
│   └── CookieBanner.tsx
├── public/
│   ├── .well-known/
│   │   ├── apple-app-site-association   # iOS Universal Links (no extension)
│   │   └── assetlinks.json             # Android App Links
│   ├── icon.png                 # App icon (copy from assets/)
│   ├── og-image.png             # Open Graph image (1200×630)
│   └── mockups/                 # Phone screenshots / mockup PNGs
├── lib/
│   └── metadata.ts              # Shared SEO metadata helpers
└── next.config.ts
```

---

## 2. Design system

### Colour palette

The gradient style must match the app's mood — vibrant, warm, social. Use these tokens throughout:

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-brand-from` | `#22C55E` | Gradient start (green) |
| `--color-brand-to` | `#16A34A` | Gradient end (deep green) |
| `--color-accent` | `#34C759` | Online dot, CTA highlights, buttons |
| `--color-surface` | `#0A0F0C` | Page background (near-black, green tint) |
| `--color-surface-raised` | `#111A14` | Card backgrounds |
| `--color-border` | `rgba(34,197,94,0.15)` | Subtle green-tinted borders |
| `--color-text-primary` | `#FFFFFF` | Headings |
| `--color-text-secondary` | `#A0B8A6` | Body, captions |

The hero and section dividers use a **diagonal gradient** (`from-[#22C55E] via-[#16A34A] to-[#15803D]`). Cards use a glassy/frosted look (`backdrop-blur`, low-opacity green-tinted border). Primary CTA buttons are solid green (`#22C55E`) with white text.

### Typography

- **Font family:** `Inter` (Google Fonts, variable weight)
- **Headings:** `font-bold`, sizes scale from `text-4xl` (mobile) to `text-7xl` (desktop)
- **Body:** `text-base` / `text-lg`, `leading-relaxed`

### Border radius & spacing

- Cards: `rounded-3xl`
- Buttons: `rounded-full`
- Section vertical padding: `py-24` (desktop) / `py-16` (mobile)

---

## 3. Page structure — Landing page (`/`)

All sections live on a single scrolling page. Each section has an `id` for anchor-link navigation.

### 3.1 Navbar

- Logo (app icon + "Free to Hang" wordmark) on the left.
- Navigation links on the right: `Features`, `How it works`, `FAQ`, `Contact`.
- **CTA button:** "Download" → smooth scroll to hero App Store buttons (or opens App Store on mobile).
- Sticky on scroll with a subtle `backdrop-blur` dark background.
- On mobile: hamburger menu → full-screen overlay.

### 3.2 Hero section (`#hero`)

**Goal:** immediately communicate the value and drive downloads.

- **Headline (H1):** "See who's free to hang"
- **Sub-headline:** "One tap to show you're free — and see which friends are too. No scheduling apps. No group chats. Just hang."
- **Two CTA buttons (side by side):**
  - App Store badge (SVG, links to `https://apps.apple.com/app/id[APP_ID]`) — use placeholder URL until live.
  - Google Play badge (SVG, links to `https://play.google.com/store/apps/details?id=com.freetohang.app`) — use placeholder URL until live.
- **Visual:** a centred phone mockup (PNG with transparent background) showing the main "Hang" tab. Use a subtle floating/levitating CSS animation (`@keyframes float`).
- **Background:** full-bleed diagonal gradient + scattered blurred coloured blobs (CSS `radial-gradient`, `filter: blur(80px)`, low opacity) to create depth.

### 3.3 Features section (`#features`)

**Headline:** "Everything you need to hang"

Display **6 feature cards** in a 2-column (mobile: 1-column) grid:

| Icon | Title | Description |
|------|-------|-------------|
| 🟢 | **One-tap availability** | Tap "Free to hang" and your friends instantly see you're available. No texting, no planning. |
| 📍 | **Suggest a hang** | Pick an activity and location, invite whoever's free — plans come together in seconds. |
| 📲 | **Invite friends** | Share your invite link anywhere. Friends join directly from the link, even if they don't have the app yet. |
| 💬 | **Plan chat** | Every plan has its own chat. Coordinate details without losing messages in a group chat. |
| 🔔 | **Smart notifications** | Get notified when friends go free. Set quiet hours so you're only pinged when it matters. |
| ✅ | **Completed plans** | A log of all your past hangs — memories at a glance. |

Each card: `rounded-3xl`, dark surface, brand gradient border (1 px), icon in a coloured pill, short title, 2-line description.

### 3.4 How it works (`#how-it-works`)

**Headline:** "Hanging out, simplified"

Three steps in a horizontal flow (mobile: vertical with numbered connector line):

1. **Create your profile** — Sign up in seconds. Add your name and vibe.
2. **Tap "Free to hang"** — One tap tells your friends you're available right now.
3. **Make plans instantly** — See who else is free, ping them, and go. Done.

Each step has a large gradient number, a short title, and a 1–2 sentence description.

### 3.5 Screenshots / App preview (`#screenshots`)

**Headline:** "Look inside the app"

A horizontal scroll carousel (on mobile) or a 3-up grid (desktop) of phone mockups showing:

1. The **Hang** tab (status + friends list)
2. The **Plans** tab (invitations + active plans)
3. The **Profile** tab (settings, friends)

Use a device frame (CSS or SVG) around each screenshot. Subtle scroll-triggered fade-in animation.

**Placeholder instruction:** if real screenshots are not available, use `mockups/placeholder-[1-3].png` with a note in the code to replace them.

### 3.6 FAQ (`#faq`)

**Headline:** "Questions? We've got answers."

Accordion-style, one open at a time. Suggested questions:

1. **Is Free to Hang free?** — Yes, completely free to download and use.
2. **Which platforms is it on?** — iOS (App Store) and Android (Google Play).
3. **Do my friends need the app?** — They need the app to join plans, but you can send them an invite link and they can download it directly.
4. **Is my availability public?** — No. Only your accepted friends can see when you're free.
5. **How do notifications work?** — You choose when to be notified. Set quiet hours in your profile settings.
6. **How do I delete my account?** — Go to Profile → Settings → Delete account. All your data is removed immediately.

### 3.7 Contact form (`#contact`)

**Headline:** "Get in touch"

Simple form with:
- Name (text input)
- Email (email input)
- Message (textarea, min 4 rows)
- Submit button ("Send message")

On submit: POST to `/api/contact` → send email via a transactional email service (e.g. Resend). Show inline success/error state — no page redirect.

Fields validated client-side (required, email format) and server-side in the API route.

### 3.8 Footer

- Logo + tagline on the left.
- Links (right or centred on mobile):
  - `Privacy Policy` → `/privacy`
  - `Terms of Service` → `/terms`
  - `Cookie Policy` → `/cookies`
  - `Contact` → `#contact`
- App Store and Google Play badges (small).
- Copyright: `© 2025 Free to Hang. All rights reserved.`
- Social links (Instagram, TikTok, X/Twitter) — use placeholder `#` hrefs until accounts are created.

---

## 4. Additional pages

### 4.1 Privacy Policy (`/privacy`)

- Standard mobile-app privacy policy covering:
  - What data is collected (name, email, location if used, contacts)
  - How data is used (social features, analytics)
  - Third-party services (Supabase, Expo, push notification providers)
  - User rights (delete account, data export)
  - Contact email for privacy enquiries
- Use a clean, readable layout: single column, max-width `prose`, white text on dark background.
- **Must be live before App Store review.**

### 4.2 Terms of Service (`/terms`)

- Standard ToS for a social app:
  - Acceptable use
  - User-generated content rules
  - Account termination policy
  - Limitation of liability
- Same layout as Privacy Policy.

### 4.3 Cookie Policy (`/cookies`)

- Explain what cookies/local storage the site uses.
- Categories: essential, analytics, preferences.
- Same layout as Privacy/Terms.

### 4.4 Cookie consent banner

A non-intrusive bottom-of-screen banner that appears on first visit:
- Text: "We use cookies to improve your experience."
- Two buttons: "Accept all" | "Manage preferences"
- Persisted in `localStorage`.
- Implemented in `CookieBanner.tsx`, rendered in the root layout.

---

## 5. Invite landing page (`/invite/[ref]`)

> Full technical specification is in [`docs/INVITE_DEEP_LINKS.md`](./INVITE_DEEP_LINKS.md). Implement everything described there. Key points summarised below.

This is a **dynamic** Next.js route (`app/invite/[ref]/page.tsx`).

### Behaviour

| Scenario | Behaviour |
|----------|-----------|
| App **not** installed | Show app name, tagline, App Store + Play Store buttons |
| App **installed** | Same page, but "Open in app" button using the same `https://freetohang.com/invite/<ref>` URL — Universal Links / App Links handle the redirect |
| User lands via invite link | The `<ref>` param is preserved in the URL and surfaced by the app after install |

### Page content

- **Headline:** "[Inviter name] wants to hang with you" (use `<ref>` as display name placeholder if server-side fetch is not implemented — see `INVITE_DEEP_LINKS.md` §2 for optional Supabase call)
- **Sub-headline:** "Join Free to Hang and see when your friends are free."
- App Store badge + Google Play badge (same as hero).
- "Open in app" button (links to same `https://freetohang.com/invite/<ref>` — OS handles deep link).
- Minimal dark background, centred layout, app icon visible.

### Minimal v1 (no server-side user fetch)

Generate a static-style page with the `ref` interpolated client-side. No Supabase call required for v1.

---

## 6. Deep link infrastructure (`.well-known` files)

> Detailed specs, JSON templates, and verification steps are in [`docs/INVITE_DEEP_LINKS.md`](./INVITE_DEEP_LINKS.md) §§3–5. Implement exactly as specified there.

### iOS — `apple-app-site-association`

- Path: `public/.well-known/apple-app-site-association` (no `.json` extension)
- Served at: `https://freetohang.com/.well-known/apple-app-site-association`
- Content-Type must be `application/json`
- Template: see `INVITE_DEEP_LINKS.md` §3

Configure `next.config.ts` headers to set the correct `Content-Type`:

```ts
async headers() {
  return [
    {
      source: '/.well-known/apple-app-site-association',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    },
  ];
},
```

### Android — `assetlinks.json`

- Path: `public/.well-known/assetlinks.json`
- Served at: `https://freetohang.com/.well-known/assetlinks.json`
- Template: see `INVITE_DEEP_LINKS.md` §4
- Fill in the SHA-256 fingerprint from Google Play Console → App signing.

### `www` subdomain

Per `INVITE_DEEP_LINKS.md` §5: set up a redirect `www.freetohang.com` → `freetohang.com` (Vercel domain settings). The `.well-known` files only need to be on the apex domain if this redirect is in place.

---

## 7. SEO & metadata

Each page must export a `generateMetadata` function (or static `metadata` object) with:

| Meta tag | Value |
|----------|-------|
| `title` | "Free to Hang – See who's free to hang" |
| `description` | "One tap to show you're free — and see which friends are too. Download Free to Hang on iOS and Android." |
| `og:image` | `/og-image.png` (1200×630, dark gradient background, phone mockup, logo) |
| `og:title` | Same as title |
| `og:description` | Same as description |
| `twitter:card` | `summary_large_image` |
| `canonical` | Absolute URL for each page |
| `viewport` | `width=device-width, initial-scale=1` |

Create a `public/og-image.png` (1200×630 px) — a visually branded image with the app icon, name, and a phone mockup on the gradient background.

### `robots.txt`

```
User-agent: *
Allow: /
Disallow: /api/
```

Place at `public/robots.txt`.

### `sitemap.xml`

Generate via `app/sitemap.ts` (Next.js built-in). Include:
- `/`
- `/privacy`
- `/terms`
- `/cookies`

Exclude `/invite/*` and `/api/*`.

---

## 8. Analytics & performance

- Add **Vercel Analytics** (`@vercel/analytics`) — one line in root layout, zero config.
- Add **Vercel Speed Insights** (`@vercel/speed-insights`) — same.
- All images via `next/image` with explicit `width` / `height`.
- Fonts loaded via `next/font/google` (no render-blocking).
- Lighthouse score target: **≥ 90** on Performance, Accessibility, SEO.

---

## 9. Animations

Keep animations subtle and purposeful:

- **Hero phone mockup:** slow float loop (`transform: translateY(-12px)`, 3 s ease-in-out, infinite).
- **Feature cards:** fade-up on scroll (`IntersectionObserver` or Framer Motion `whileInView`).
- **How it works steps:** staggered fade-in (150 ms delay per step).
- **FAQ accordion:** smooth height transition (`max-height` CSS transition or Framer Motion `AnimatePresence`).
- **Gradient blobs in hero:** very slow drift animation (10–20 s, subtle scale + translate).

Use `prefers-reduced-motion` media query to disable all animations for users who request it.

---

## 10. Accessibility

- All interactive elements keyboard-focusable with visible focus ring.
- Images have descriptive `alt` text.
- Colour contrast ratio ≥ 4.5:1 for all body text.
- ARIA labels on icon-only buttons (hamburger menu, social links).
- FAQ accordion uses `<button>`, `aria-expanded`, `aria-controls`.
- Form inputs have associated `<label>` elements.

---

## 11. Internationalisation

English only for v1. Do not add i18n infrastructure — keep it simple.

---

## 12. Deployment checklist (Vercel)

1. Push the repository to GitHub.
2. Import the repo in Vercel → Framework: Next.js → Root directory: `/` (or the website subfolder if it lives inside the monorepo).
3. Add environment variables:
   - `RESEND_API_KEY` (or equivalent) for contact form emails.
   - `CONTACT_TO_EMAIL` — address where contact form submissions are sent.
4. Add custom domain `freetohang.com` in Vercel → Domains.
5. Add `www.freetohang.com` with a redirect to `freetohang.com`.
6. Verify SSL (automatic with Vercel).
7. After deploy, verify `.well-known` files:
   - `https://freetohang.com/.well-known/apple-app-site-association` → returns JSON with `applinks`.
   - `https://freetohang.com/.well-known/assetlinks.json` → returns JSON array.
8. Test invite link end-to-end (see `INVITE_DEEP_LINKS.md` — Testing checklist).

---

## 13. Repository structure recommendation

If the website lives in the same GitHub repo as the mobile app, place it in a `/website` subfolder and set Vercel's root directory to `website`. This keeps the mobile and web code together while Vercel only builds the web part.

```
free-to-hang/          ← existing mobile app repo
├── app/               ← Expo app
├── docs/
│   ├── INVITE_DEEP_LINKS.md
│   └── WEBSITE_PLAN.md   ← this file
└── website/           ← Next.js website (new)
    ├── app/
    ├── components/
    ├── public/
    └── ...
```

If you prefer a separate repo, that is also fine — just reference `docs/INVITE_DEEP_LINKS.md` separately.

---

## 14. Assets to provide before building

The developer / AI agent can use placeholders for everything below, but the final site needs real assets:

| Asset | Source | Notes |
|-------|--------|-------|
| App icon | `assets/icon.png` in the mobile repo | Copy to `public/icon.png` |
| Phone mockups (3–5 screenshots) | Take from a real device or Simulator | 390×844 px recommended |
| App Store URL | From Apple after app is approved | Placeholder `#` until live |
| Google Play URL | From Google Play Console | Placeholder `#` until live |
| Apple Developer Team ID | Apple Developer portal | Required for AASA file |
| Android SHA-256 fingerprint | Google Play Console → App signing | Required for assetlinks.json |
| Contact form email address | Owner to provide | Used in API route env var |
| Social media links | Owner to provide | Instagram, TikTok, X/Twitter |
| OG image (1200×630) | Generate or design | Can be auto-generated with Satori |

---

## 15. Out of scope for v1

- Blog / news section
- User-generated content (no reviews/testimonials page — add once real reviews exist)
- Server-side invite page personalisation (inviter's name from Supabase) — documented in `INVITE_DEEP_LINKS.md` as "Future enhancements"
- Multi-language support
- Deferred deep linking / attribution (Branch.io, Firebase Dynamic Links)

---

*End of document. Hand this file + `docs/INVITE_DEEP_LINKS.md` to the developer or AI agent to begin building.*
