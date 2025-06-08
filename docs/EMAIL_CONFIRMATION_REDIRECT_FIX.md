# Fixing Email Confirmation Redirect Issue

## Problem
Email confirmation links redirect to blank localhost page instead of your app or a proper confirmation page.

## Solution: Configure Supabase Redirect URLs

### Step 1: Configure Supabase Auth Settings

1. Go to your Supabase Dashboard: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj
2. Navigate to **Authentication → URL Configuration**
3. Update the following settings:

#### Site URL
Set your main domain:
```
https://freetohang.com
```

#### Redirect URLs
Add these redirect URLs (one per line):

**For production domain:**
```
https://freetohang.com/auth/callback
https://freetohang.com/auth/confirm
https://freetohang.com/auth/reset-password
```

**For mobile app deep linking:**
```
freetohang://auth/callback
freetohang://auth/confirm
freetohang://auth/reset-password
```

**For development (if needed):**
```
http://localhost:3000/auth/callback
http://localhost:8081/auth/callback
```

### Step 2: Create Web Confirmation Pages

You'll need to create web pages on your domain to handle redirects:

#### Option A: Simple Redirect Pages
Create these pages on your website (freetohang.com):

**`/auth/confirm.html`** - Email confirmation success:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Email Confirmed - Free2Hang</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 500px; margin: 0 auto; }
        .success { color: #4CAF50; }
        .button { 
            background: #3B82F6; 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 8px; 
            text-decoration: none; 
            display: inline-block;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="success">✅ Email Confirmed!</h1>
        <p>Your email address has been successfully confirmed.</p>
        <p>You can now close this page and return to the Free2Hang app to sign in.</p>
        
        <!-- Try to open the app -->
        <a href="freetohang://auth/confirmed" class="button">Open Free2Hang App</a>
        <br><br>
        <small>If the app doesn't open automatically, please open it manually from your device.</small>
    </div>

    <script>
        // Try to redirect to app automatically
        setTimeout(function() {
            window.location.href = 'freetohang://auth/confirmed';
        }, 2000);
    </script>
</body>
</html>
```

**`/auth/reset-password.html`** - Password reset redirect:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Reset Password - Free2Hang</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 500px; margin: 0 auto; }
        .info { color: #3B82F6; }
        .button { 
            background: #3B82F6; 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 8px; 
            text-decoration: none; 
            display: inline-block;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="info">🔒 Reset Your Password</h1>
        <p>Click the button below to open the Free2Hang app and set your new password.</p>
        
        <a href="freetohang://auth/reset-password" class="button">Open Free2Hang App</a>
        <br><br>
        <small>If the app doesn't open automatically, please open it manually from your device.</small>
    </div>

    <script>
        // Extract tokens from URL and pass to app
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
            const appUrl = `freetohang://auth/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}`;
            
            setTimeout(function() {
                window.location.href = appUrl;
            }, 2000);
        }
    </script>
</body>
</html>
```

#### Option B: Use Existing Website
If you already have a website, add these pages to handle auth callbacks.

### Step 3: Update App Deep Link Handling

Make sure your app handles these deep links in `AuthContext.tsx`:

```typescript
// In AuthContext.tsx, add this to the deep link handler:
if (url.includes('auth/confirmed')) {
  Alert.alert('Success!', 'Your email has been confirmed! You can now sign in.');
  router.replace('/(auth)/sign-in');
}

if (url.includes('auth/reset-password')) {
  // Extract tokens and redirect to reset password screen
  const urlParams = new URLSearchParams(url.split('?')[1]);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  
  if (accessToken && refreshToken) {
    router.push({
      pathname: '/(auth)/reset-password',
      params: { access_token: accessToken, refresh_token: refreshToken }
    });
  }
}
```

### Step 4: Test Your Setup

1. **Email Confirmation:**
   - Register a new account
   - Check email and click confirmation link
   - Should redirect to your domain, then back to app

2. **Password Reset:**
   - Use "Forgot Password" feature
   - Check email and click reset link
   - Should redirect to reset password form in app

### Step 5: Deployment Checklist

- [ ] Upload confirmation pages to your domain
- [ ] Update Supabase redirect URLs
- [ ] Test email confirmation flow
- [ ] Test password reset flow
- [ ] Verify deep links work on both iOS and Android

## Alternative: Custom Email Templates

You can also customize the email templates in Supabase to include better instructions:

1. Go to **Authentication → Email Templates**
2. Edit "Confirm signup" template
3. Add instructions: "After confirming, return to the Free2Hang app to continue"

## Current Status
✅ Password reset functionality implemented  
❌ Email confirmation redirects to localhost  
🔄 Need to configure proper redirect URLs

## Quick Fix for Testing
If you need a quick fix for testing, you can temporarily disable email confirmation:
1. Supabase Dashboard → Authentication → Settings  
2. Uncheck "Enable email confirmations"  
3. **⚠️ Remember to re-enable for production!** 