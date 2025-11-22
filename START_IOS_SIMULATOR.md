# 🚀 iOS Simulaatoris App Avamine - LIHTSAD SAMMUD

## ⚡ KIIRE VIIS (Soovitatav)

### 1. Ava Terminal (uus aken kui vaja)

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang
```

### 2. Käivita Expo

```bash
npx expo start
```

**Oota kuni näed:**
```
Metro waiting on exp://...
› Press i │ open iOS simulator
```

### 3. Vajuta `i` klahvi

Terminal küsib:
```
› Opening on iPhone 15 Pro
```

**App avaneb simulaatoris automaatselt!** ✅

---

## 🔧 KUI PORT 8081 ON KINNI

**Kui näed errori "Port 8081 is already in use":**

```bash
# Kustuta vanad protsessid
lsof -ti:8081 | xargs kill -9

# Käivita uuesti
npx expo start
```

---

## 📱 ALTERNATIVE: Ava Simulator Kõigepealt

### 1. Ava iOS Simulator Xcode-st

```bash
# Või käsurealt:
open -a Simulator
```

### 2. Vali seade

- **Xcode menu:** Device → Choose iOS 17.x → iPhone 15 Pro (või mis tahes)

### 3. Käivita Expo

```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang
npx expo start
```

### 4. Vajuta `i`

App avaneb juba käivitatud simulaatoris!

---

## ✅ KONTROLLI LOGI

**Pärast app avamist vaata terminali:**

```
LOG  🚀 Starting real-time friend status updates...
LOG  📡 Status channel status: SUBSCRIBED  ✅
LOG  ✅ Hang channel SUBSCRIBED
```

**Peaks NÄGEMA:**
- ✅ SUBSCRIBED staatus
- ✅ Ei mingit "CHANNEL_ERROR"

---

## 🧪 TESTI NOTIFICATION SÜSTEEMI

### 1. Kontrolli Tab Bar-i

Peaksid nägema **4 tab-i**:
- Hang
- Plans
- **Notifications** ← UUS!
- Profile

### 2. Loo Plaan

1. Mine "Plans" tab-ile
2. Vajuta "+"
3. Loo plaan
4. Kutsu kedagi

**Kontrolli:** Kas error kadus? ✅

### 3. Vaata Notifications Tab-i

- Peaks olema tühi (esimene kord)
- Badge näitab lugemata teavitusi (praegu 0)

---

## 🎯 KUI MIDAGI FAILIBKI

### Metro ei käivitu?

```bash
# Kustuta cache ja node_modules
rm -rf node_modules
rm -rf .expo
npm install
npx expo start --clear
```

### Simulator ei leia app-i?

```bash
# Reset simulator
xcrun simctl erase all
npx expo start
# Vajuta 'i'
```

### Port 8081 viga ei kao?

```bash
# Leia kõik protsessid
lsof -i:8081

# Kustuta kõik
killall -9 node
killall -9 expo

# Käivita uuesti
npx expo start
```

---

## 📊 OODATAV TULEMUS

Pärast `npx expo start` ja `i` vajutamist:

1. ✅ Simulator avaneb (või kasutab olemasolevat)
2. ✅ App installib (~30 sec)
3. ✅ App avaneb
4. ✅ Terminal näitab loge
5. ✅ Hang channel SUBSCRIBED
6. ✅ 4 tab-i (koos Notifications-iga)

---

## 🚀 ALUSTA SIIT

**Terminal käsk:**
```bash
cd /Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang && npx expo start
```

**Siis vajuta:** `i`

**Ongi kõik!** 🎉

---

_Kui näed "Port 8081" errori, vaata "KUI PORT 8081 ON KINNI" sektsiooni._

