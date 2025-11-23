# 🔑 FCM Server Key Setup Guide

## 📋 Probleem

```
"Unable to retrieve the FCM server key for the recipient's app."
```

**Põhjus:** Expo vajab FCM Server Key'i, et saata push notificationeid Android seadmetele Firebase'i kaudu.

---

## ✅ Lahendus: Lisa FCM Server Key Expo'sse

### Meetod 1: Firebase Console (UUED PROJEKTID)

⚠️ **TÄHELEPANU:** Google on amortiseerinud Legacy FCM Server Key. Uutele projektidele tuleb kasutada **Firebase Cloud Messaging API (V1)**.

#### Samm 1: Luba Firebase Cloud Messaging API

1. Mine: https://console.firebase.google.com/project/free-to-hang/settings/cloudmessaging
2. Kliki "Manage API" nupule (Firebase Cloud Messaging API juures)
3. **VÕI** Mine otse: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=free-to-hang
4. Vajuta "Enable" nupule

#### Samm 2: Loo Service Account Key

1. Mine: https://console.firebase.google.com/project/free-to-hang/settings/serviceaccounts/adminsdk
2. Kliki "Generate new private key"
3. Laadi alla JSON fail (näiteks: `free-to-hang-firebase-adminsdk.json`)
4. ⚠️ **OLULINE:** Hoia see fail turvaliselt! See sisaldab täielikku ligipääsu teie Firebase projektile!

#### Samm 3: Lisa Expo'sse

**Variant A: EAS CLI (SOOVITATUD)**

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang

# Logi sisse EAS-i
npx eas-cli login

# Seadista FCM credentials
npx eas-cli credentials

# Vali:
# 1. Android
# 2. Select 'Push Notifications: FCM V1 service account key'
# 3. Upload your service account JSON file
```

**Variant B: Expo Dashboard (ALTERNATIIV)**

1. Mine: https://expo.dev/accounts/mihkelkoobi/projects/free-to-hang/credentials
2. Vali: Android → Push Notifications
3. Upload service account JSON file

---

### Meetod 2: Legacy Server Key (VANAD PROJEKTID)

⚠️ Töötab ainult projektidel, mis loodi enne 2024. aastat ja kus see on veel aktiivne.

#### Samm 1: Kontrolli Legacy Key'i olemasolu

1. Mine: https://console.firebase.google.com/project/free-to-hang/settings/cloudmessaging
2. Otsi "Cloud Messaging API (Legacy)" sektsiooni
3. Kui näed "Server key" → kopeeri see

#### Samm 2: Lisa Expo'sse

```bash
npx eas-cli credentials

# Vali:
# 1. Android
# 2. Select 'Push Notifications: FCM server key'
# 3. Paste your server key
```

---

## 🚀 Pärast FCM Key'i lisamist

### 1. Rebuildi äpp (OLULINE!)

FCM key on seotud Expo projektiga, seega peate rebuildima äpi:

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang

# Android
npx expo run:android
```

**VÕI** kasutage EAS Build'i (lihtsam):

```bash
# Development build
npx eas-cli build --platform android --profile development

# Pärast buildi valmimist, laadige alla ja installige APK
```

### 2. Testi push notificationeid

```bash
# Lihtne test
curl -X POST "https://free-to-hang-production.up.railway.app/api/notifications/simple-test/69755d7c-50d8-4d3c-8e6e-cc9b7890287f" \
  -H "Content-Type: application/json" \
  -d '{"title":"🎉 Test","body":"FCM is now working!"}'
```

**VÕI** otse Expo API-sse:

```bash
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[rQlek2IA8Ldi2hGUeXXcXv]",
    "title": "FCM Test",
    "body": "Server key configured!",
    "sound": "default",
    "priority": "high"
  }'
```

Kui kõik on õige, peaks see tagastama:

```json
{
  "data": {
    "status": "ok",
    "id": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
  }
}
```

---

## 🔍 Kontrolli credentials'e

```bash
npx eas-cli credentials

# Vali: Android
# Peaks nägema:
# ✓ Push Notifications: FCM server key (või FCM V1 service account)
```

---

## ❓ FAQ

### "Kas ma pean Firebase'is midagi muud tegema?"

**EI!** Peate ainult:
1. Lubama Firebase Cloud Messaging API
2. Genereerima service account key VÕI kasutama legacy server key
3. Lisama selle Expo'sse

### "Kas ma pean äppi uuesti buildima?"

**JAH!** FCM credentials on seotud build'iga. Pärast credentials'e lisamist peate rebuildima äpi.

### "Kas see töötab kohe?"

Peale rebuild'i ja installi **JAH**! Push notificationid peaksid kohe tööle hakkama.

### "Kas ma pean ka iOS'i jaoks midagi tegema?"

**JAH!** iOS vajab eraldi APNs Key'i. Vaata: `PUSH_NOTIFICATIONS_STATUS_ANALÜÜS.md`

---

## 🎯 Sammude kokkuvõte

### Kiire variant (5 minutit)

```bash
# 1. Hangi Firebase service account key
# → https://console.firebase.google.com/project/free-to-hang/settings/serviceaccounts/adminsdk
# → Generate new private key

# 2. Lisa Expo'sse
npx eas-cli login
npx eas-cli credentials
# → Android → FCM V1 → Upload JSON

# 3. Rebuildi
npx expo run:android

# 4. Testi
curl -X POST "https://free-to-hang-production.up.railway.app/api/notifications/simple-test/69755d7c-50d8-4d3c-8e6e-cc9b7890287f" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"It works!"}'
```

---

## 🔗 Kasulikud lingid

- **Firebase Console:** https://console.firebase.google.com/project/free-to-hang
- **Expo Credentials:** https://expo.dev/accounts/mihkelkoobi/projects/free-to-hang/credentials
- **FCM API:** https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=free-to-hang
- **Expo Docs:** https://docs.expo.dev/push-notifications/fcm-credentials/

---

**Pärast neid samme peaksid Android push notificationid täielikult tööle hakkama!** 🎉

