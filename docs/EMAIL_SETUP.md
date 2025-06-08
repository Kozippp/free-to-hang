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
<h2>Tere tulemast Free2Hang'i!</h2>
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