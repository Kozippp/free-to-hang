# Development build + tunnel: why localhost doesn’t work

## The problem

If you open a **tunnel** (`npm run start-tunnel` or `npx expo start --tunnel`) and in the app enter **`http://localhost:8082`** in “Enter URL manually”, the app shows:

**“Could not load the app: Could not connect to the server.”**

Reason: on a **physical device**, `localhost` is the **phone itself**, not your computer. The device can’t reach your Mac’s Metro server via `localhost`.

So you must use the **tunnel URL**, not localhost.

---

## Correct steps when using a tunnel

### 1. Start the dev server with tunnel

In the project root:

```bash
npm run start-tunnel
```

(or `npx expo start --tunnel`)

### 2. Copy the URL from the terminal

After the tunnel is ready, the terminal shows something like:

- **`exp://u.expo.dev/...`** or  
- **`https://u.expo.dev/...`** or  
- A QR code and a line like **“Metro waiting on exp://…”**

Use that **full URL** (the one that starts with `exp://` or `https://u.expo.dev/`). Do **not** use `http://localhost:8082`.

### 3. Enter that URL in the app

In the development build:

1. Open the screen where it says **“Enter URL manually”**.
2. Clear the field and paste the **tunnel URL** from the terminal (e.g. `exp://u.expo.dev/...` or the `https://u.expo.dev/...` URL).
3. Tap **Connect**.

The app should load from the tunnel and connect to Metro.

---

## Summary

| What you enter        | Works? |
|-----------------------|--------|
| `http://localhost:8082` | No – device can’t reach your computer via localhost |
| Tunnel URL from terminal (`exp://...` or `https://u.expo.dev/...`) | Yes – use this |

If the tunnel URL doesn’t work (e.g. on Android with HTTPS), see [Expo dev client tunnel issues](https://github.com/expo/expo/issues/33703); sometimes the URL is shown with `http://` and that’s the one to use in the app.
