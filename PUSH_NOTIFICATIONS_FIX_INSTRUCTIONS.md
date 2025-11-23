# 🔧 PUSH NOTIFICATIONS FIX - ENGINEER INSTRUCTIONS

## 📋 EXECUTIVE SUMMARY

**Status:** CRITICAL BUG - Push notifications registration fails silently  
**Impact:** Users cannot receive push notifications  
**Root Cause:** Missing try-catch block around `getExpoPushTokenAsync()` call  
**Priority:** HIGH  
**Estimated Time:** 30 minutes  

---

## 🔍 PROBLEM DESCRIPTION

### Symptoms
- User grants notification permissions (iOS prompt shows "granted")
- No entries appear in `push_tokens` table in Supabase
- No push tokens are registered for any users

### What the Logs Show

```
✅ Notification permissions granted
🆔 Using Expo project ID: 18a79a9c-af0a-4fb5-a752-3831e49d89ba
🎟️ Getting Expo push token...
[NOTHING AFTER THIS LINE]
```

**Expected but missing:**
```
🔔 Push token received: ExponentPushToken[...]
💾 Saving push token to database...
✅ Push token saved to database successfully
```

### Root Cause Analysis

**File:** `utils/pushNotifications.ts`  
**Function:** `registerForPushNotifications()`  
**Lines:** 66-108

**The Problem:**
```typescript
// Line 70-72: This call can throw an error, but it's NOT in a try-catch!
const tokenResponse = await Notifications.getExpoPushTokenAsync(
  projectId ? { projectId } : undefined
);
const token = tokenResponse.data;

// Line 76: try-catch starts HERE (TOO LATE!)
try {
  console.log('💾 Saving push token to database...');
  // ...
```

When `getExpoPushTokenAsync()` fails (network issue, EAS auth issue, etc.), the error is:
- ❌ Not caught
- ❌ Not logged  
- ❌ Silently kills the function
- ❌ No user feedback

---

## 🛠️ SOLUTION

### Task 1: Fix pushNotifications.ts

**File:** `/Users/mihkelkoobi/Documents/free-to-hang-projects/free-to-hang/utils/pushNotifications.ts`

**Replace lines 66-108 with this:**

```typescript
  console.log('✅ Notification permissions granted');

  const projectId = resolveProjectId();
  console.log('🆔 Using Expo project ID:', projectId);
  
  // STEP 1: Get the push token (with proper error handling)
  let token: string;
  try {
    console.log('🎟️ Getting Expo push token...');
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = tokenResponse.data;
    console.log('🔔 Push token received:', token);
  } catch (error) {
    console.error('❌ Failed to get Expo push token:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Project ID used:', projectId);
    Alert.alert(
      'Push Notification Error',
      'Failed to get push notification token. Please check your internet connection and try again.'
    );
    return null;
  }

  // STEP 2: Save token to database (separate try-catch)
  try {
    console.log('💾 Saving push token to database...');
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          device_type: Platform.OS,
          active: true,
          last_used_at: new Date().toISOString()
        },
        { onConflict: 'user_id,expo_push_token' }
      );

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    console.log('✅ Push token saved to database successfully');
    console.log('📊 Token details:', {
      userId,
      token: token.substring(0, 30) + '...',
      deviceType: Platform.OS,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to save push token:', error);
    Alert.alert('Warning', 'Failed to register for push notifications. You may not receive notifications.');
  }

  return token;
}
```

**Key Changes:**
1. ✅ Declare `let token: string;` before try blocks
2. ✅ Wrap `getExpoPushTokenAsync()` in its own try-catch
3. ✅ Add detailed error logging with `JSON.stringify(error, null, 2)`
4. ✅ Add user-facing error alert
5. ✅ Return `null` if token fetch fails
6. ✅ Keep database save in separate try-catch for isolation

---

## 🗄️ DATABASE VERIFICATION

### Task 2: Verify push_tokens Table Exists

**Open Supabase SQL Editor and run:**

```sql
-- Check if table exists and its structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'push_tokens'
ORDER BY ordinal_position;

-- Check constraints
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'push_tokens';
```

**Expected Output:**
- `user_id` (uuid, not null)
- `expo_push_token` (text, not null)
- `device_type` (text, not null)
- `active` (boolean)
- `last_used_at` (timestamptz)
- UNIQUE constraint on (user_id, expo_push_token)

### If Table is Missing, Create It:

```sql
-- Create push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(active);

-- Enable Row Level Security
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own tokens
CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON push_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON push_tokens FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 🧪 TESTING PROCEDURE

### Task 3: Test the Fix

#### Step 1: Rebuild the App
```bash
# For iOS
npx expo run:ios

# OR if using EAS Build
eas build --platform ios --profile development
```

#### Step 2: Monitor Logs During Testing

**Expected Log Sequence:**
```
🔔 Starting push notification registration for user: [USER_ID]
✅ Running on physical device
📋 Checking notification permissions...
Current permission status: undetermined
🔐 Requesting notification permissions...
New permission status: granted
✅ Notification permissions granted
🆔 Using Expo project ID: 18a79a9c-af0a-4fb5-a752-3831e49d89ba
🎟️ Getting Expo push token...
🔔 Push token received: ExponentPushToken[xxxxxxxxxxxxxx]
💾 Saving push token to database...
✅ Push token saved to database successfully
📊 Token details: { userId: '...', token: 'ExponentPushToken[...]', ... }
```

#### Step 3: Verify in Database

**Run in Supabase SQL Editor:**
```sql
SELECT 
  id,
  user_id,
  expo_push_token,
  device_type,
  active,
  last_used_at,
  created_at
FROM push_tokens 
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected Result:** You should see a new entry with:
- `user_id`: Your test user's ID
- `expo_push_token`: Starting with "ExponentPushToken["
- `device_type`: "ios" or "android"
- `active`: true
- `created_at`: Recent timestamp

#### Step 4: Test Push Notification

Use the test script or manual test:

```bash
# If there's a test script
./test-push-notifications.sh

# Or test manually with curl
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN_HERE]",
    "title": "Test Notification",
    "body": "If you see this, push notifications are working!",
    "sound": "default"
  }'
```

---

## 🚨 TROUBLESHOOTING

### Issue 1: Still No Token After Fix

**Possible Causes:**

#### A) Using Expo Go (Won't Work)
❌ Push notifications don't work in Expo Go on physical devices  
✅ **Solution:** Use `npx expo run:ios` or `eas build`

Check with:
```bash
# If this shows Expo Go, that's the problem
grep -r "Expo Go" ios/
```

#### B) Not Logged into EAS
```bash
# Check if logged in
eas whoami

# If not logged in
eas login
```

#### C) Network/Firewall Issues
The app needs to reach Expo's push notification servers.

**Test connectivity:**
```bash
curl -v https://exp.host/--/api/v2/push/send
```

Should return `{"errors":[{"code":"MISSING_MESSAGE"...]}` (this is good - means server is reachable)

#### D) Invalid Project ID
Check these match:

**In `app.json`:**
```json
"extra": {
  "eas": {
    "projectId": "18a79a9c-af0a-4fb5-a752-3831e49d89ba"
  }
}
```

**In `utils/pushNotifications.ts`:**
```typescript
const EXPO_PROJECT_ID = '18a79a9c-af0a-4fb5-a752-3831e49d89ba';
```

**Verify with EAS:**
```bash
eas project:info
```

### Issue 2: Token Received But Not Saved to DB

**Check RLS Policies:**
```sql
-- Check if RLS is blocking inserts
SELECT * FROM push_tokens WHERE user_id = '[YOUR_USER_ID]';

-- Temporarily disable RLS to test (ONLY FOR TESTING)
ALTER TABLE push_tokens DISABLE ROW LEVEL SECURITY;
-- Try registration again
-- Then re-enable:
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
```

**Check if user_id is valid:**
```sql
SELECT id, email FROM auth.users WHERE id = '[USER_ID_FROM_LOGS]';
```

### Issue 3: Permission Denied Errors

**Check Supabase Service Role Key:**
If backend is saving tokens, ensure it uses service role key:

```javascript
// In backend, use service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

---

## 📝 COMMIT GUIDELINES

After successful testing:

```bash
# Add the fixed file
git add utils/pushNotifications.ts

# Commit with descriptive message
git commit -m "Fix: Add try-catch for getExpoPushTokenAsync to handle token fetching errors

- Wrap token fetch in try-catch to catch network/auth errors
- Add detailed error logging with JSON.stringify for debugging
- Add user-facing error alert for better UX
- Separate token fetch and DB save into distinct try-catch blocks
- Return null on failure to prevent undefined behavior

Fixes issue where push notification registration silently failed,
leaving no tokens in push_tokens table."

# Push to current branch
git push origin Hakkame-chati-looma
```

---

## ✅ ACCEPTANCE CRITERIA

Before marking this as complete, verify:

- [ ] Code changes implemented in `utils/pushNotifications.ts`
- [ ] App successfully rebuilds without errors
- [ ] Logs show complete token registration flow
- [ ] New entry appears in `push_tokens` table
- [ ] Push token starts with "ExponentPushToken["
- [ ] Test push notification received on device
- [ ] Changes committed to Git
- [ ] Changes pushed to remote branch

---

## 📚 REFERENCES

- **Current Branch:** `Hakkame-chati-looma`
- **Project ID:** `18a79a9c-af0a-4fb5-a752-3831e49d89ba`
- **Expo Docs:** https://docs.expo.dev/push-notifications/overview/
- **Supabase Project:** https://supabase.com/dashboard/project/

---

## 🆘 NEED HELP?

If issues persist after following all steps:

1. **Collect Full Logs:**
   ```bash
   npx expo start --clear
   # Then reproduce the issue and save all console output
   ```

2. **Check EAS Build Logs:**
   ```bash
   eas build:list
   eas build:view [BUILD_ID]
   ```

3. **Verify Certificates (iOS):**
   ```bash
   eas credentials
   ```

4. **Share Debug Info:**
   - Full console logs from app startup to notification permission grant
   - Results of SQL queries from "Database Verification" section
   - Output of `eas whoami` and `eas project:info`
   - Screenshot of any error alerts shown to user

---

**Last Updated:** 2025-11-22  
**Created by:** Engineering Manager  
**For:** Push Notifications Fix - Sprint  

