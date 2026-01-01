# 🍎 Apple Developer Setup Juhend

## 📋 Olukord

**Probleem**: Rakendus crashib füüsilisel iPhone'il kohe avamisel.

**Põhjus**: Native moodulid (eriti push notifications) vajavad Apple Developer konto seadistust ja õigeid sertifikaate.

**Lahendus**: Kui sul on Apple Developer konto ($99/aastas), siis järgi allolevaid samme.

---

## ✅ Sammud (Kui Apple Developer Konto on Olemas)

### 1. Apple Developer Konto Seadistamine

1. **Mine** [developer.apple.com](https://developer.apple.com)
2. **Logi sisse** oma Apple ID-ga
3. **Vali** "Certificates, Identifiers & Profiles"

### 2. Bundle Identifier Registreerimine

```
Bundle ID: com.freetohang.app
Platform: iOS
```

**Märkused:**
- See peab täpselt vastama `app.json` failis olevale `bundleIdentifier` väljale
- Luba "Push Notifications" capability

### 3. APNs Key Genereerimine (Push Notificationide jaoks)

1. **Certificates, Identifiers & Profiles** → **Keys**
2. **Vajuta** "+" nuppu uue võtme loomiseks
3. **Pane nimeks**: "Free to Hang Push Notifications"
4. **Märgi** "Apple Push Notifications service (APNs)"
5. **Vajuta** "Continue" ja "Register"
6. **Lae alla** `.p8` fail (⚠️ Salvesta kindlasse kohta, seda ei saa uuesti alla laadida!)
7. **Kopeeri** Key ID (10-märgiline kood)

### 4. EAS Build Seadistamine

```bash
# 1. Logi sisse EAS-i
npx eas-cli login

# 2. Seadista build
npx eas-cli build:configure

# Järgi juhiseid ekraanil:
# - Vali iOS platform
# - Kasuta olemasolevat Bundle ID: com.freetohang.app
# - Lae üles APNs võti (.p8 fail)
```

### 5. Ehita Development Build

```bash
# Development build testmiseks
npx eas-cli build --platform ios --profile development
```

See protsess võtab 10-20 minutit. Pärast valmimist saad QR koodi, millega saad rakenduse iPhone'ile paigaldada.

### 6. Paigalda iPhone'ile

**Variant A: QR koodiga**
```bash
# Skanni QR kood iPhone'iga
# Ava link Safari's
# Paigalda rakendus
```

**Variant B: Xcode'iga**
```bash
# Ühenda iPhone kaabliga
npx expo run:ios --device
```

---

## 🔔 Push Notificationide Lubamine

Kui kõik eelnevad sammud on tehtud:

### 1. Aktiveeri Push Notifications Koodis

```typescript
// utils/pushNotifications.ts
// Eemalda read 27-34 (kommentaarid "disabled" kohta)
// Eemalda kommentaarid real 26+ algse koodi pealt
```

### 2. Lisa APNs Key Expo'sse

```bash
# Expo saadab push notificationid läbi Apple'i serverite
npx eas-cli credentials --platform ios
```

**Vali:**
- Push Notifications Key
- Upload new key
- Anna Key ID ja Team ID
- Lae üles .p8 fail

### 3. Testi Push Notificationid

```bash
# 1. Paigalda uus build iPhone'ile
# 2. Luba notifications kui rakendus küsib
# 3. Testi: loo plaan teise kasutajaga
# 4. Kontrolli: kas saad push notification?
```

---

## 🎯 Kokkuvõte

**Ilma Apple Developer Kontota:**
- ❌ Ei saa rakendust füüsilisel seadmel testida (crashib)
- ❌ Ei saa push notifications tööle panna
- ✅ Saab simulaatoris arendada (aga ilma push notifications)

**Koos Apple Developer Kontoga ($99/aastas):**
- ✅ Rakendus töötab füüsilisel iPhone'il
- ✅ Push notifications töötavad
- ✅ Saab App Store'i üles laadida

---

## 📚 Kasulikud Lingid

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple Developer Portal](https://developer.apple.com)
- [Push Notifications Setup Guide](https://docs.expo.dev/push-notifications/push-notifications-setup/)

---

## 💡 Alternatiiv: Expo Go

Kui sa ei taha praegu Apple Developer kontot osta, saad kasutada **Expo Go** rakendust:

```bash
# 1. Installeeri Expo Go iPhone'is (App Store)
# 2. Käivita development server
npx expo start

# 3. Skanni QR kood Expo Go rakendusega
```

**⚠️ Piirangud:**
- Ei tööta Firebase
- Ei tööta push notifications
- Mõned native moodulid ei tööta
- Ainult development, mitte production

---

**Koostatud**: 16. detsember 2025  
**Autor**: AI Assistant  
**Eesmärk**: Selgitada, kuidas saada rakendus tööle füüsilisel iPhone'il

