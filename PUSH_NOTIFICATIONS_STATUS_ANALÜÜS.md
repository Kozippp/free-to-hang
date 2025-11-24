# 📊 Push Notificationite Süsteemi Analüüs ja Puuduvad Sammud

**Kuupäev:** 22. november 2025  
**Projekti nimi:** Free to Hang  
**Expo Project ID:** 18a79a9c-af0a-4fb5-a752-3831e49d89ba

---

## 🎯 KOKKUVÕTE

Teie push notificationite süsteem on **90% valmis**, kuid veel **ei tööta täielikult** sest puuduvad iOS-spetsiifilised sertifikaadid (APNs keys/certificates). 

**Mis töötab:**
- ✅ Frontend kood (registreerib push tokeneid)
- ✅ Backend kood (saadab notificationeid Expo API-sse)
- ✅ Andmebaasi tabelid (push_tokens, notifications, notification_preferences)
- ✅ Expo projekt on seadistatud ja Project ID on õigesti konfigureeritud

**Mis EI tööta veel:**
- ❌ **iOS Push Notificationid** - puuduvad Apple Push Notification service (APNs) sertifikaadid
- ❌ **Android Push Notificationid** - puudub Firebase Cloud Messaging (FCM) seadistus

---

## 🔍 DETAILNE ANALÜÜS

### 1. ✅ FRONTEND SEADISTUS (VALMIS)

**Failid:**
- `utils/pushNotifications.ts` - Token registreerimine
- `app/_layout.tsx` - Automaatne registreerimine pärast sisselogimist
- `app.json` - iOS background notifications seadistatud

**Olukord:**
- Kood on õigesti kirjutatud
- Expo Project ID on õigesti seadistatud: `18a79a9c-af0a-4fb5-a752-3831e49d89ba`
- iOS entitlements fail olemas (kuigi tühi - see on OK)
- Background mode iOS-is lubatud (`UIBackgroundModes: ["remote-notification"]`)

**Mida teeb:**
1. Küsib kasutajalt notification lubade
2. Genereerib Expo Push Token
3. Salvestab tokeni Supabase `push_tokens` tabelisse

### 2. ✅ BACKEND SEADISTUS (VALMIS)

**Failid:**
- `backend/services/notificationService.js` - Notificationite saatmine
- `backend/routes/notifications.js` - API endpoints
- `backend/routes/plans.js`, `chat.js`, `friends.js` - Integratsioonid

**Olukord:**
- Backend kasutab `expo-server-sdk` v4.0.0
- Kood saadab notificationid õigesti Expo API-sse
- Kontrollib kasutaja preferences ja quiet hours
- Logib kõik tegevused

**Mida teeb:**
1. Võtab push tokeneid andmebaasist
2. Saadab notificationid Expo API-sse (`https://exp.host/--/api/v2/push/send`)
3. Expo edastab need Apple'ile (iOS) või Google'ile (Android)

### 3. ✅ ANDMEBAAS (VALMIS)

**Tabelid:**
- `push_tokens` - Salvestab Expo push tokeneid
- `notifications` - Salvestab in-app notificationid
- `notification_preferences` - Kasutaja seaded

**Olukord:**
- Kõik tabelid on loodud
- RLS policies on seadistatud
- Indexid on olemas

### 4. ❌ iOS APNs SERTIFIKAADID (PUUDUVAD)

**Praegune olukord:**
```
DEVELOPMENT_TEAM = BFHFB246UY
PRODUCT_BUNDLE_IDENTIFIER = com.yourcompany.freetohang
```

**Probleem:**
Apple nõuab, et push notificationite saatmiseks oleks:
1. **APNs Key** või **APNs Certificate** Apple Developer kontolt
2. See peab olema seotud teie Bundle ID-ga (`com.yourcompany.freetohang`)
3. Expo peab teadma seda võtit, et edastada notificationeid Apple'i serveritesse

**Hetkel:**
- Teil on Development Team ID: `BFHFB246UY`
- Kuid **Expo'l pole ligipääsu APNs võtmele**
- Seega Expo ei saa Apple'ile öelda "palun saada see notification selle äpi kasutajale"

### 5. ❌ Android FCM SEADISTUS (PUUDUB)

**Probleem:**
Android push notificationid nõuavad Firebase Cloud Messaging (FCM) seadistust:
1. Firebase projekt
2. `google-services.json` fail
3. FCM server key Expo'le

**Hetkel:**
- Android seadistus puudub täielikult
- `android/` kaust eksisteerib, kuid FCM pole konfigureeritud

---

## 🛠️ MIS VEEL TEHA TULEB

### PRIORITEET 1: iOS Push Notifications Seadistus

#### Variant A: Kasuta EAS Build'i (SOOVITATUD - kõige lihtsam)

EAS Build võib automaatselt luua ja hallata sertifikaate.

```bash
# 1. Logi sisse EAS-i (kasuta oma Expo kontot)
npx eas-cli login

# 2. Seadista iOS credentials
npx eas-cli build:configure

# 3. Vali "Yes" kui küsitakse "Generate new push notification key?"
# EAS loob APNs võtme automaatselt Apple Developer kontol

# 4. Ehita development build
npx eas-cli build --platform ios --profile development
```

**Mis juhtub:**
- EAS ühendub teie Apple Developer kontoga
- Loob automaatselt APNs võtme (või kasutab olemasolevat)
- Registreerib selle Expo projektiga
- Nüüd Expo saab saata notificationeid Apple'i kaudu

**Eeldused:**
- Teil peab olema kehtiv Apple Developer konto ($99/aasta)
- Peate olema sisseloginud `mihkelkoobi` Expo kontoga
- Vajadusel peate andma EAS-ile ligipääsu Apple Developer kontole

#### Variant B: Manuaalne seadistus (rohkem tööd)

Kui eelistate käsitsi kontrollida:

1. **Loo APNs Key Apple Developer portaalis:**
   - Mine https://developer.apple.com/account/resources/authkeys/list
   - Create a Key
   - Enable "Apple Push Notifications service (APNs)"
   - Laadi alla `.p8` fail
   - Märgi üles: Key ID, Team ID

2. **Laadi Expo'sse:**
```bash
npx eas-cli credentials
# Vali iOS → Push Notifications
# Upload your .p8 file
# Sisesta Key ID ja Team ID
```

### PRIORITEET 2: Android Push Notifications Seadistus

#### 1. Loo Firebase Projekt

1. Mine https://console.firebase.google.com/
2. Create new project: "Free to Hang"
3. Lisa Android app:
   - Package name: `com.yourcompany.freetohang`
   - Laadi alla `google-services.json`

#### 2. Hangi FCM Server Key

1. Firebase Console → Project Settings → Cloud Messaging
2. Kopeeri "Server Key"
3. Lisa see Expo projektile:

```bash
npx eas-cli credentials
# Vali Android → FCM Server Key
# Kleebi server key
```

#### 3. Lisa google-services.json

```bash
# Kopeeri fail Android projekti
cp google-services.json android/app/
```

#### 4. Rebuildi Android app

```bash
npx expo run:android
```

### PRIORITEET 3: Testimine

Pärast iOS/Android seadistust:

```bash
# 1. Rebuildi app
npx expo run:ios --device  # iOS
# VÕI
npx expo run:android       # Android

# 2. Logi sisse äpis

# 3. Kontrolli Safari Web Inspector'is, kas push token salvestati

# 4. Testi backend'ist
./test-push-notifications.sh [SINU_JWT_TOKEN]

# 5. Kontrolli, kas notification jõudis seadmesse
```

---

## 📋 SAMM-SAMMULINE PLAAN

### Samm 1: EAS Login ja Projekti Kontroll

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang

# Kontrolli, kas oled õiges Expo kontoga sisseloginud
npx eas-cli whoami

# Kui pole, siis logi sisse
npx eas-cli login

# Kontrolli projekti infot
npx eas-cli project:info
```

**Oodatav väljund:**
```
Logged in as mihkelkoobi
Project: free-to-hang
ID: 18a79a9c-af0a-4fb5-a752-3831e49d89ba
```

### Samm 2: iOS Credentials Seadistus

```bash
# Käivita EAS build configurator
npx eas-cli build:configure

# Järgi juhiseid:
# - Platform: iOS
# - Generate credentials? YES
# - Apple Team ID: BFHFB246UY (peaks automaatselt leidma)
```

**Kui küsitakse Apple Developer sisselogimist:**
- Sisesta oma Apple ID (see, mis on Apple Developer programmi liige)
- Lubab EAS-il luua APNs võtme

### Samm 3: Ehita iOS Development Build

```bash
# Ühenda iPhone Mac'iga USB kaudu

# Ehita ja installeeri
npx eas-cli build --platform ios --profile development --local

# VÕI (kui local build ei tööta)
npx eas-cli build --platform ios --profile development
# (see ehitab pilves, võtab 10-15 minutit)
```

### Samm 4: Kontrolli Credentials

```bash
# Vaata, kas credentials on õigesti seadistatud
npx eas-cli credentials
```

Peaks näitama:
```
✓ Push Notification Key
  Key ID: XXXXXX
  Team ID: BFHFB246UY
```

### Samm 5: Testi Push Notifications

```bash
# 1. Installi äpp iPhone'ile (kui local build)
# VÕI laadi alla build link (kui cloud build)

# 2. Ava äpp, logi sisse

# 3. Kontrolli Safari Web Inspector'is console'i:
# Peaks nägema: "✅ Push token saved to database successfully"

# 4. Võta JWT token (Network tab Safari's)

# 5. Käivita test script
./test-push-notifications.sh eyJhbGciOiJI...

# 6. Kontrolli iPhone'i - peaks tulema test notification!
```

---

## 🚨 LEVINUD PROBLEEMID JA LAHENDUSED

### Probleem 1: "No Apple Team ID found"

**Lahendus:**
- Veenduge, et teie Apple ID on Apple Developer programmi liige
- Programmi liikmelisus maksab $99/aasta
- Mine https://developer.apple.com/account/ ja kontrolli

### Probleem 2: "Invalid credentials"

**Lahendus:**
```bash
# Kustuta olemasolevad credentials ja loo uued
npx eas-cli credentials
# Vali "Remove credentials" → "Push Notification Key"
# Seejärel loo uued
npx eas-cli build:configure
```

### Probleem 3: Push notification ei jõua iPhone'ile

**Kontrolli:**
1. **Kas token on salvestatud?**
   ```sql
   SELECT * FROM push_tokens WHERE user_id = '[SINU_USER_ID]';
   ```

2. **Kas backend saadab?**
   - Vaata Railway logisid
   - Otsi "✅ Push notifications sent"

3. **Kas iPhone seaded lubavad?**
   - Settings → Free to Hang → Notifications → Enabled

4. **Kas kasutad õiget build'i?**
   - Expo Go EI TOETA push notifications
   - Pead kasutama custom development build'i

### Probleem 4: "Push token invalid"

**Lahendus:**
```bash
# Kontrolli, kas Expo Project ID on õige
cat app.json | grep projectId
# Peaks näitama: "projectId": "18a79a9c-af0a-4fb5-a752-3831e49d89ba"

# Kui vale, uuenda:
# 1. app.json → extra.eas.projectId
# 2. utils/pushNotifications.ts → EXPO_PROJECT_ID
# 3. Rebuildi äpp
```

---

## 🎓 KUIDAS SÜSTEEM TÖÖTAB (TEHNILINE ÜLEVAADE)

### 1. Token Registreerimine

```
iPhone App                    Supabase                Expo Servers
    │                            │                         │
    │ 1. Küsi permissions        │                         │
    ├───────────────────────────►│                         │
    │                            │                         │
    │ 2. Genereeri Expo token    │                         │
    ├────────────────────────────┼────────────────────────►│
    │                            │                         │
    │ 3. Expo token              │                         │
    │◄───────────────────────────┼─────────────────────────┤
    │                            │                         │
    │ 4. Salvesta token DB-sse   │                         │
    ├───────────────────────────►│                         │
    │                            │                         │
```

### 2. Notification Saatmine

```
Backend                    Expo API                  Apple APNs              iPhone
   │                          │                          │                     │
   │ 1. Võta push token       │                          │                     │
   ├──────────────────►       │                          │                     │
   │    DB-st                 │                          │                     │
   │                          │                          │                     │
   │ 2. Saada Expo API-sse    │                          │                     │
   ├─────────────────────────►│                          │                     │
   │   {to: "ExponentPush...",│                          │                     │
   │    title: "Test",        │                          │                     │
   │    body: "Hello"}        │                          │                     │
   │                          │                          │                     │
   │                          │ 3.  credKontrollientials │                     │
   │                          ├─────────────────────────►│                     │
   │                          │    (APNs Key)            │                     │
   │                          │                          │                     │
   │                          │                          │ 4. Deliver          │
   │                          │                          ├────────────────────►│
   │                          │                          │                     │
   │                          │                          │                     │
   │                          │ 5. Success               │                     │
   │                          │◄─────────────────────────┤                     │
   │                          │                          │                     │
   │ 6. Ticket                │                          │                     │
   │◄─────────────────────────┤                          │                     │
```

**Praegune probleem:**
- Samm 3 EBAÕNNESTUB, sest Expo'l puudub APNs Key
- Seega Samm 4 ei juhtu kunagi
- iPhone ei saa kunagi notificationit

### 3. Mida APNs Key teeb?

APNs Key on nagu **parool**, mis tõestab Apple'ile:
- "Jah, see notification tuleb legitiimselt Free to Hang äpist"
- "See äpp kuulub Developer Team BFHFB246UY-le"
- "Ma (Expo) olen volitatud selle äpi nimel notificationeid saatma"

Ilma selleta ütleb Apple: "Ma ei tea, kes sa oled, seega ma ei saada seda notificationit."

---

## ✅ VASTUSED TEIE KÜSIMUSTELE

### "Kuidagi peab vist siduma ära meie koodi nii apple'iga?"

**Jah, täpselt!** Sidumine toimub läbi APNs võtme:

1. **Apple Developer konto** → Loob APNs Key
2. **APNs Key** → Antakse Expo'le
3. **Expo** → Kasutab seda võtit Apple'i serveritega suhtlemiseks
4. **Apple serverid** → Saadavad notification teie iPhone'ile

### "Meie kood ütleb appelile, et tuleb saata push notification?"

**Peaaegu õige!** Täpsem voog:

1. **Teie backend** → Ütleb **Expo'le**: "Saada notification"
2. **Expo** → Ütleb **Apple'ile**: "Saada notification" (kasutades APNs võtit)
3. **Apple** → Saadab **iPhone'ile**: Notification

Te ei suhtle Apple'iga otse - Expo teeb seda teie eest. Aga Expo vajab **luba** (APNs Key) Apple'iga rääkimiseks.

### "Sama asi Androidiga?"

**Jah!** Android jaoks:

1. **Firebase/Google konto** → Loob FCM Server Key
2. **FCM Key** → Antakse Expo'le
3. **Expo** → Kasutab seda võtit Google'i serveritega suhtlemiseks
4. **Google serverid** → Saadavad notification teie Android seadmele

---

## 📝 JÄRGMISED SAMMUD (PRIORITEEDID)

### KOHE (järgmine 1 tund):

1. ✅ **Loe see dokument läbi**
2. ▶️ **Käivita EAS login:** `npx eas-cli login`
3. ▶️ **Seadista iOS credentials:** `npx eas-cli build:configure`

### TÄNA (järgmine 2-3 tundi):

4. ▶️ **Ehita iOS development build**
5. ▶️ **Testi push notificationeid iPhone'il**
6. ▶️ **Fiksi vigu, kui tulevad**

### SEE NÄDAL:

7. ▶️ **Seadista Firebase Android jaoks**
8. ▶️ **Testi Android push notificationeid**
9. ▶️ **Dokumenteeri õnnestunud seadistus**

### ENNE PRODUCTION'I:

10. ▶️ **Loo Production APNs Key (eraldi development'ist)**
11. ▶️ **Testi mõlemas keskkonnas**
12. ▶️ **Seadista monitoring (Railway logs)**

---

## 🆘 ABI VAJA?

### EAS Build Error

Kui `eas build` annab vea:
```bash
# Kontrolli EAS versiooni
npx eas-cli --version

# Uuenda EAS CLI
npm install -g eas-cli

# Tühjenda cache
npx eas-cli build --clear-cache
```

### Apple Developer Kontoga Probleemid

- Veenduge, et olete Account Holder või Admin
- Kontrollige https://developer.apple.com/account/
- Vaadake, kas maksate membership fee ($99/aasta)

### Expo Kontoga Probleemid

```bash
# Logi välja
npx eas-cli logout

# Logi uuesti sisse
npx eas-cli login

# Kontrolli kontot
npx eas-cli whoami
```

---

## 📚 KASULIKUD LINGID

- **Expo Push Notifications Docs:** https://docs.expo.dev/push-notifications/overview/
- **EAS Build Docs:** https://docs.expo.dev/build/introduction/
- **Apple Developer Portal:** https://developer.apple.com/account/
- **Firebase Console:** https://console.firebase.google.com/
- **Expo Project Dashboard:** https://expo.dev/accounts/mihkelkoobi/projects/free-to-hang

---

## ✅ CHECKLIST

Kasutage seda checklist'i, et jälgida progressi:

- [ ] EAS-i sisse logitud (`eas whoami`)
- [ ] iOS credentials seadistatud (`eas credentials`)
- [ ] APNs Key Expo'sse laaditud
- [ ] iOS development build ehitatud
- [ ] Push token iPhone'il registreeritud
- [ ] Test notification iPhone'ile saadetud ja kätte saadud
- [ ] Firebase projekt loodud
- [ ] FCM Server Key Expo'sse laaditud
- [ ] `google-services.json` Android projekti lisatud
- [ ] Android build ehitatud
- [ ] Push notification Android'il testitud
- [ ] Dokumentatsioon uuendatud

---

**Kokkuvõte:** Teie süsteem on peaaegu valmis! Peamine puuduv osa on **Apple ja Google sertifikaadid**, mis annavad Expo'le loa notificationeid saata. Järgige "Samm-sammuline plaan" sektsiooni ja peaksite 2-3 tunni jooksul saama iOS notificationid tööle. Android võtab veidi kauem (lisaks 1-2 tundi).

**Edu! 🚀**

