# Quick Fix for Notification Errors

## Problem
- Error: Cannot find native module 'ExpoPushTokenManager'
- Warning: Route "./_layout.tsx" is missing the required default export

## ✅ Solution (Step by Step)

### Step 1: Stop Metro Bundler
Press `Ctrl+C` or `Cmd+C` in terminal where Expo is running

### Step 2: Clean everything
```bash
# Clean Metro cache
npx expo start -c

# Stop it (Ctrl+C) and continue
```

### Step 3: Prebuild iOS (if ios folder doesn't exist)
```bash
npx expo prebuild --platform ios
```

### Step 4: Install iOS Pods with UTF-8 encoding
```bash
cd ios && export LANG=en_US.UTF-8 && export LC_ALL=en_US.UTF-8 && pod install && cd ..
```

### Step 5: Rebuild and run
```bash
npx expo run:ios
```

## Why This Works
- `expo prebuild` generates native iOS code for expo-notifications
- `pod install` installs native dependencies (EXNotifications, ExpoDevice)
- `expo run:ios` compiles everything together with native modules
- UTF-8 encoding fixes CocoaPods compatibility issues

## 📱 Testing on Physical Device

**IMPORTANT:** After fixing the errors above, test on a physical device:

1. **Push notifications require a real device** - simulators can't receive push notifications
2. **Check permissions:**
   - Open the app
   - Grant notification permissions when prompted
   - Go to iOS Settings → Free to Hang → Notifications → Enable
3. **Verify registration:**
   - Check console logs for "✅ Push token saved"
   - Push token should appear in `push_tokens` table in Supabase

### To run on physical device:
```bash
# Connect iPhone via cable
npx expo run:ios --device
```

## 🔧 Future Improvements

### 1. Expo Install (when Bun becomes available)
To keep Expo CLI logs clean, run:
```bash
npx expo install expo-notifications expo-device
```

This ensures packages are compatible with your Expo SDK version.

### 2. React 19 Compatibility Issue
Current setup uses `lucide-react-native` which may have peer dependency issues with React 19.

**Check for warnings:**
```bash
npm list react
```

**If you see peer dependency warnings:**
- Monitor `lucide-react-native` GitHub for React 19 support
- Consider creating `.npmrc` with `legacy-peer-deps=true` temporarily
- Or switch to a React 19 compatible icon library

**Current status:**
- App works with React 19
- Warnings can be safely ignored for now
- No --legacy-peer-deps needed in this build

## Alternative (If Above Fails)
```bash
# Complete clean and rebuild
rm -rf node_modules ios
npm install
npx expo prebuild --platform ios
cd ios && export LANG=en_US.UTF-8 && pod install && cd ..
npx expo run:ios
```

## 🎯 What Was Fixed
✅ Installed EXNotifications (0.31.4)  
✅ Installed ExpoDevice (7.1.4)  
✅ Fixed CocoaPods UTF-8 encoding  
✅ Rebuilt iOS native modules  
✅ App now starts without errors

