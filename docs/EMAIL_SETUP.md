# E-posti süsteemi seadistamine

## 1. Supabase E-posti seadistused

### Sammud Supabase Dashboard's:

1. **Mine Supabase dashboard'i**: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj
2. **Vali "Authentication" menüüst**
3. **Mine "Settings" → "Auth"**
4. **Leia "SMTP Settings" sektsioon**

### 2. SMTP seadistamine

Saate kasutada järgmisi e-posti teenusepakkujaid:

#### A) Gmail SMTP (Tasuta)
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Pass: your-app-password
```

**Gmail App Password seadistamine:**
1. Mine Google Account Settings → Security
2. Lülita sisse "2-Step Verification"
3. Lisa "App Password" Gmail'ile
4. Kasuta seda parooli SMTP Pass väljal

#### B) SendGrid (Professionaalne)
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Pass: your-sendgrid-api-key
```

#### C) Mailgun
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP User: your-mailgun-smtp-username
SMTP Pass: your-mailgun-smtp-password
```

### 3. E-posti templade seadistamine

Supabase Dashboard's:
1. **Mine "Authentication" → "Settings"**
2. **Leia "Email Templates" sektsioon**
3. **Kohanda "Confirm signup" template'i:**

```html
<h2>Tere tulemast rakendusse Free to Hang!</h2>
<p>Tänud registreerumise eest!</p>
<p>Oma e-posti aadressi kinnitamiseks kliki allolevale lingile:</p>
<p><a href="{{ .ConfirmationURL }}">Kinnita e-posti aadress</a></p>
<p>Kui see link ei tööta, kopeeri ja kleebi järgnev URL oma brauserisse:</p>
<p>{{ .ConfirmationURL }}</p>
```

### 4. URL-ide seadistamine

Supabase Dashboard's "Auth Settings":
```
Site URL: exp://192.168.1.x:8081 (arenduse jaoks)
Additional Redirect URLs: 
- exp://192.168.1.x:8081
- your-app://auth-callback (kui kasutad custom scheme)
```

### 5. Rakenduse kood

E-posti kinnituse käsitlemiseks lisame Deep Linking toe:

1. **Installi sõltuvused:**
```bash
expo install expo-linking
```

2. **Lisa app.json faili:**
```json
{
  "expo": {
    "scheme": "free2hang",
    "web": {
      "bundler": "metro"
    }
  }
}
```

### 6. Testimine

1. Registreeri uus kasutaja
2. Kontrolli e-posti saabumist
3. Kliki kinnituslingile
4. Veendu, et kasutaja saab sisse logida

## Alternatiivne lahendus: E-posti kinnituse keelamine

Kui soovite testimiseks e-posti kinnituse ajutiselt välja lülitada:

Supabase Dashboard's:
1. **Mine "Authentication" → "Settings"**
2. **Leia "User Signups" sektsioon**
3. **Lülita välja "Enable email confirmations"**

⚠️ **Hoiatus:** See lahendus ei ole sobiv toodangukeskkonnas!

---

## Google Sign-In (mobile) & one account per email (English)

### Environment variables

Add to `.env` / EAS secrets (Expo public vars are embedded at build time):

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS OAuth client ID>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<Android OAuth client ID>.apps.googleusercontent.com
```

Use the **Client ID from the iOS-type and Android-type credentials** in Google Cloud—not the Web “Supabase” client ID. Those are separate IDs.

The app uses **iOS** and **Android** OAuth client types (not the Web client) for the in-browser PKCE flow. Google’s **Web application** clients now reject custom scheme redirects such as `freetohang://oauthredirect` (“must end with a public top-level domain”), so the app uses Google’s native redirect pattern `com.googleusercontent.apps.<client-prefix>:/oauth2redirect/google` instead. `app.config.js` registers the matching URL schemes from your client IDs; run **`npx expo prebuild --clean`** or a fresh **EAS/dev build** after changing these values.

Supabase still needs the **Web** client for **Client ID + Client Secret** in the dashboard; only the mobile OAuth request uses the platform client IDs above.

### Google Cloud Console

1. Create **OAuth client** types: **Web** (Supabase: keep `https://<project>.supabase.co/auth/v1/callback` as an authorized redirect URI only), **iOS** (bundle ID `com.freetohang.app`), **Android** (package `com.freetohang.app` + SHA-1 for debug and release).
2. Do **not** rely on adding `freetohang://…` to the Web client if Google’s console rejects it; the app no longer uses that redirect.
3. In **Supabase Dashboard → Authentication → Providers → Google**: enable Google, set Web client **Client ID** and **Client Secret**, and list **all** client IDs (Web, iOS, Android) in the Client IDs field—comma-separated, **Web client ID first** (see [Supabase Google docs](https://supabase.com/docs/guides/auth/social-login/auth-google?platform=react-native)).

### Same email, one user (Apple / Google / email OTP)

Supabase Auth **automatically links** identities that share the same **verified** email into a single user. That means: sign up with Apple or Google, then “Continue with email” with the **same** email should resolve to the same account (not a second user).

Requirements:

- Use the **same** email address (Apple “Hide My Email” relay addresses will **not** match a personal Gmail—use “Share my email” when you want email OTP to link).
- Keep **email confirmations** enabled in production so only verified emails are linked (prevents account takeover).

No app code change is required beyond using normal `signInWithOtp` / `verifyOtp`; linking is enforced server-side by Supabase.