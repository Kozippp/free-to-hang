# 📱 Free to Hang

Eesti keelne sotsiaalse planeerimise äpp, mis aitab sõpradel leida aega ühiseks kohtumiseks.

## 🚀 Kiire Alustamine

### Eeltingimused
- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator või Android Emulator
- Supabase konto

### Installeerimine

1. **Kloneeri repositoorium**
```bash
git clone <your-repo-url>
cd free-to-hang
```

2. **Installi sõltuvused**
```bash
npm install --legacy-peer-deps
```

3. **Seadista Supabase**
- Mine [supabase.com](https://supabase.com) ja loo uus projekt
- Kopeeri Project URL ja anon public key
- Asenda `lib/supabase.ts` failis:
  ```typescript
  const supabaseUrl = 'YOUR_SUPABASE_URL';
  const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
  ```

4. **Seadista andmebaas**
- Supabase dashboard'is mine SQL Editor'isse
- Kopeeri ja käivita `supabase/schema.sql` sisu

5. **Käivita äpp**
```bash
npm start
```

## 🚀 Local Development Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create environment file
Create a `.env.local` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://nfzbvuyntzgszqdlsusl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

**⚠️ IMPORTANT**: Never commit `.env.local` to git - it's already in `.gitignore`.

### 3. Set up Supabase Database
1. Go to https://app.supabase.com/project/nfzbvuyntzgszqdlsusl
2. Open SQL Editor → New Query
3. Run the SQL setup script (see DATABASE_SETUP.md)

### 4. Start the development server
```bash
npx expo start
```

## 🏗️ Projekt Struktuur

```
free-to-hang/
├── app/                    # Expo Router lehekülgede kaust
│   ├── (auth)/            # Autentimise ekraanid
│   ├── (tabs)/            # Peamised tab'id
│   └── _layout.tsx        # Põhi layout
├── components/            # Taaskasutatavad komponendid
├── constants/             # Värvid, mock data jms
├── contexts/              # React Context'id
├── lib/                   # Välised teenused (Supabase)
├── stores/                # Zustand state management
├── utils/                 # Abifunktsioonid
└── supabase/              # Database schema
```

## 🎨 Funktsioonid

### ✅ Valmis
- **Autentimine**: Sign-in/Sign-up Supabase'iga
- **Hang Tab**: Saadavuse seadmine, sõprade vaatamine
- **Plans Tab**: Kutsete haldamine, plaanide loomine
- **Profile Tab**: Profiili muutmine, sõprade haldamine
- **Reaalajas teavitused**: Mock push notifications
- **Responsive UI**: Täielik eesti keelne kasutajaliides

### 🔄 Arenduses
- Reaalne andmebaasi integratsioon
- Push notifications
- Geolocation funktsioonid

## 📱 App Store'i Ettevalmistus

### 1. Vajalikud Assets'id

Loo järgmised pildifailid `assets/` kausta:
- `icon.png` (1024x1024) - Äppi ikoon
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `splash.png` (1284x2778) - Splash screen
- `favicon.png` (48x48) - Web favicon

### 2. Bundle Identifier'i Muutmine

Muuda `app.json` failis:
```json
{
  "ios": {
    "bundleIdentifier": "com.yourcompany.freetohang"
  },
  "android": {
    "package": "com.yourcompany.freetohang"
  }
}
```

### 3. EAS Build Setup

1. **Installi EAS CLI**
```bash
npm install -g eas-cli
```

2. **Logi sisse Expo kontosse**
```bash
eas login
```

3. **Seadista projekt**
```bash
eas build:configure
```

4. **Ehita production build**
```bash
# iOS jaoks
eas build --platform ios --profile production

# Android jaoks  
eas build --platform android --profile production
```

### 4. App Store Submission

#### iOS (App Store Connect)
1. Loo Apple Developer konto
2. Loo App Store Connect'is uus äpp
3. Laadi üles build EAS'iga
4. Täida äppi metadata
5. Esita review'ks

#### Android (Google Play Console)
1. Loo Google Play Developer konto
2. Loo uus äpp Play Console'is
3. Laadi üles AAB fail
4. Täida store listing
5. Esita review'ks

## 🔧 Arendus

### Käivitamine
```bash
npm start                 # Expo development server
npm run start-web        # Web versioon
```

### Testimine
```bash
npm test                 # Unit testid (kui lisatud)
```

### Linting
```bash
npx expo lint           # TypeScript/ESLint kontroll
```

## 🌐 Environment Variables

Loo `.env` fail (ei ole versioneeritud):
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📋 Checklist App Store'i Jaoks

### Tehnilised Nõuded
- [ ] Supabase andmebaas seadistatud
- [ ] Reaalsed API võtmed lisatud
- [ ] App icon (1024x1024) loodud
- [ ] Splash screen loodud
- [ ] Bundle identifier muudetud
- [ ] Privacy policy loodud
- [ ] Terms of service loodud

### App Store Metadata
- [ ] Äppi nimi ja kirjeldus
- [ ] Screenshots (6.7", 6.5", 5.5" iPhone'idele)
- [ ] Keywords ja kategooria
- [ ] Age rating
- [ ] Privacy policy URL
- [ ] Support URL

### Testimine
- [ ] Testitud iOS seadmel
- [ ] Testitud Android seadmel
- [ ] Autentimine töötab
- [ ] Kõik põhifunktsioonid töötavad
- [ ] Crash'e ei esine

## 🆘 Abi

### Levinud Probleemid

1. **Supabase ühendus ei tööta**
   - Kontrolli URL'i ja API võtit
   - Veendu, et RLS policies on õigesti seadistatud

2. **Build ebaõnnestub**
   - Kontrolli, et kõik sõltuvused on installitud
   - Vaata EAS build logisid

3. **Navigation ei tööta**
   - Kontrolli, et kõik route'id on õigesti defineeritud
   - Vaata Expo Router dokumentatsiooni

### Kontakt
- Email: your-email@example.com
- GitHub Issues: [Link to issues]

## 📄 Litsents

MIT License - vaata LICENSE faili detailide jaoks. 

## 🔐 Security Notes

- Real API keys are never committed to the repository
- Without `.env.local`, the app runs in mock mode
- Mock mode shows helpful setup messages
- Always use placeholder keys in committed code

## 📱 Features

- User authentication with Supabase
- Social availability sharing
- Plan creation and management
- Friend connections
- Real-time updates

## 🔗 Invite links & deep linking (handoff)

Shared invite URLs use **`https://freetohang.com/invite/<username-or-user-id>`** and open the in-app profile modal when the app is installed and the user is signed in.

**Full checklist for web + iOS Universal Links + Android App Links** (what to host on the domain, AASA, `assetlinks.json`, testing commands): see **[docs/INVITE_DEEP_LINKS.md](./docs/INVITE_DEEP_LINKS.md)** (English, written for a developer or agency).