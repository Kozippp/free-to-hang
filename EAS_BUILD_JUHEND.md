# 🚀 EAS Build ja FCM Setup Juhend

## 📝 Ülevaade

Sinu äpp on nüüd seadistatud push notificationideks, kuid vajad uut build'i, et FCM credentials hakkaksid tööle.

---

## ✅ Tehtud muudatused

### 1. **Package.json**
✅ Lisatud `expo-notifications` ja `expo-device` paketid

### 2. **app.json**
✅ Lisatud `expo-notifications` plugin
✅ Lisatud `googleServicesFile` viide
✅ Lisatud Android package name: `com.freetohang.app`
✅ Loodud uus EAS projekt ID: `56f495c2-5308-4452-9c0a-f8a0c6f98a0d`

### 3. **Dependencies**
✅ Installitud kõik vajalikud paketid

---

## 🔑 Järgmised sammud (KOHUSTUSLIK!)

### Samm 1: Genereeri Android Keystore ja lisa FCM credentials

Sul on kaks võimalust:

#### **Variant A: Expo Dashboard (LIHTSAM)**

1. Mine: https://expo.dev/accounts/mihkelkoobi/projects/Free-to-hang/credentials

2. **Android Keystore:**
   - Kliki "Android" → "Keystore"
   - Kliki "Generate new Keystore"
   - Kinnita

3. **FCM Credentials:**
   - Kliki "Android" → "Push Notifications"
   - Vali "FCM V1 Service Account Key"
   - Upload oma Firebase service account JSON fail
   
   **Firebase Service Account key hankimine:**
   - Mine: https://console.firebase.google.com/project/free-to-hang/settings/serviceaccounts/adminsdk
   - Kliki "Generate new private key"
   - Laadi alla JSON fail
   - Upload see Expo dashboardi

#### **Variant B: EAS CLI (Interaktiivne)**

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang/Free-to-hang

# 1. Seadista credentials
npx eas-cli credentials

# Vali:
# → Select platform: Android
# → What do you want to do? Set up a new build credentials
# → Generate new Android Keystore? Yes
# → Configure FCM? Yes
# → Upload your Firebase service account JSON file

# 2. Alusta build'i
npx eas-cli build --platform android --profile preview
```

---

### Samm 2: Alusta Build'i

Pärast credentials'e seadistamist:

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang/Free-to-hang

npx eas-cli build --platform android --profile preview
```

Build võtab ~5-10 minutit. Saad jälgida progressi:
- Terminalis
- VÕI: https://expo.dev/accounts/mihkelkoobi/projects/Free-to-hang/builds

---

### Samm 3: Laadi alla ja installi APK

Kui build on valmis:

1. **Laadi alla APK:**
   ```bash
   npx eas-cli build:download --platform android --profile preview
   ```
   
   VÕI laadi alla otse Expo dashboardist:
   - https://expo.dev/accounts/mihkelkoobi/projects/Free-to-hang/builds

2. **Installi APK:**
   - Saada fail oma Android seadmesse
   - Luba "Install from Unknown Sources" (kui vaja)
   - Installi APK

---

### Samm 4: Testi Push Notificationeid

Pärast äpi installimist ja avamist (et register push token):

```bash
# Kasutaja ID: 69755d7c-50d8-4d3c-8e6e-cc9b7890287f
# Push Token: ExponentPushToken[rQlek2IA8Ldi2hGUeXXcXv]

# Test otse Expo API kaudu
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[rQlek2IA8Ldi2hGUeXXcXv]",
    "title": "🎉 FCM is working!",
    "body": "Your push notifications are now configured correctly!",
    "sound": "default",
    "priority": "high"
  }'
```

Kui kõik on õige, peaks tagastama:

```json
{
  "data": {
    "status": "ok",
    "id": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
  }
}
```

---

## 🔍 Veaotsing

### Error: "Unable to retrieve the FCM server key"

**Põhjus:** FCM credentials pole Expo'sse lisatud VÕI äpp on buildiitud enne credentials'e lisamist.

**Lahendus:**
1. Kontrolli: https://expo.dev/accounts/mihkelkoobi/projects/Free-to-hang/credentials
2. Veendu, et "Push Notifications: FCM V1" on seadistatud
3. Tee uus build (vana build ei saa FCM credentials'e kasutada)

### Build ebaõnnestub

**Kontrolli:**
- Kas keystore on genereeritud?
- Kas `google-services.json` fail on olemas?
- Kas `app.json` on korras?

---

## 📋 Kiire checklist

- [ ] Firebase service account key alla laaditud
- [ ] FCM credentials Expo'sse lisatud
- [ ] Android Keystore genereeritud
- [ ] EAS build käivitatud
- [ ] APK alla laaditud
- [ ] APK installitud seadmesse
- [ ] Äpp avatud (et registreerida push token)
- [ ] Push notification testitud

---

## 🔗 Kasulikud lingid

- **Expo Project:** https://expo.dev/accounts/mihkelkoobi/projects/Free-to-hang
- **Credentials:** https://expo.dev/accounts/mihkelkoobi/projects/Free-to-hang/credentials
- **Builds:** https://expo.dev/accounts/mihkelkoobi/projects/Free-to-hang/builds
- **Firebase Console:** https://console.firebase.google.com/project/free-to-hang
- **Expo Docs:** https://docs.expo.dev/push-notifications/fcm-credentials/

---

## 💡 Tähtis teada

1. **Ei saa testida ilma uue build'ita:** Vana äpp ei tea veel FCM credentials'est midagi
2. **FCM credentials on build-specific:** Iga kord, kui muudad credentials'e, pead tegema uue build'i
3. **Development vs Production:** Preview build sobib testimiseks. Production build'i jaoks kasuta `--profile production`
4. **Token võib muutuda:** Pärast uue äpi installimist võib push token muutuda - kontrolli `push_tokens` tabelit Supabase'is

---

**Pärast neid samme peaksid push notificationid täielikult tööle hakkama!** 🎉

