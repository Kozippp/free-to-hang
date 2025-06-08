# Supabase OTP Setup Guide

## Current Status
Supabase sends magic links by default. To get 6-digit OTP codes prominently displayed in emails, we only need to modify the email template - the code already works with `signInWithOtp()`.

## Steps to Configure OTP in Supabase

### 1. Access Auth Settings
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Settings**

### 2. Configure Custom Email Template
To make the OTP code prominent in emails:

1. In **Authentication** → **Settings**, scroll to **Email Templates**
2. Click on **"Magic Link"** template (this is what `signInWithOtp` uses)
3. Replace the default template with this custom one:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Free to Hang</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your verification code</p>
    </div>
    
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">Enter this code in the app:</h2>
        <div style="font-size: 48px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 20px 0; font-family: 'Monaco', 'Menlo', monospace;">{{ .Token }}</div>
        <p style="color: #666; margin: 20px 0 0 0; font-size: 14px;">This code expires in 10 minutes</p>
    </div>
    
    <div style="text-align: center; margin-bottom: 30px;">
        <p style="color: #666; margin: 0 0 20px 0;">Or click the button below if you prefer:</p>
        <a href="{{ .ConfirmationURL }}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: 600;">Verify Account</a>
    </div>
    
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
        <p>If you didn't request this verification, you can safely ignore this email.</p>
        <p>This email was sent from Free to Hang verification system.</p>
    </div>
</body>
</html>
```

4. Click **Save** to apply the template

### 3. Test the Configuration
1. Try the email signin flow in your app
2. Check if you receive an email with a prominent 6-digit code
3. The code should be displayed in large, bold text
4. There should also be a backup link button

## Development Testing
- OTP codes are typically 6 digits
- They expire in 10 minutes by default
- Each email request generates a new code
- Previous codes become invalid when a new one is generated

## Troubleshooting
- If still receiving magic links, ensure "Enable email OTP" is ON
- If no emails arrive, check your email provider settings
- Test with different email addresses
- Check Supabase logs for any error messages

## Expected Result
With this configuration:
- Users will receive emails with a large, prominent 6-digit code
- The code will be the main focus of the email
- A backup link is provided but secondary
- The app will only show the code input interface
- Users can enter the 6-digit code to verify their account

## Alternatiivne meetod (kui OTP setting ei ole nähtav)

Kui sa ei leia "Email OTP" sätteid, kasutame emaili template muutmist:

### Samm 1: Mine Magic Link template'i
1. **Authentication** → **Settings** 
2. **Email Templates** → **Magic Link**

### Samm 2: Asenda template sisu
Template'is on vaikimisi midagi sellist:
```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

Asenda see sellega:
```html
<h2>Your verification code</h2>
<p>Hi there!</p>
<p>Your 6-digit verification code for Free2Hang is:</p>
<h1 style="font-size: 32px; letter-spacing: 4px; color: #3B82F6; text-align: center; margin: 20px 0;">{{ .Token }}</h1>
<p>Enter this code in the app to complete your registration.</p>
<p>This code will expire in 24 hours.</p>
<p>If you didn't request this code, you can safely ignore this email.</p>
<hr>
<p style="color: #666; font-size: 12px;">Free2Hang - Connect with friends when you're free to hang</p>
```

### Samm 3: Salvesta
Kliki **Save** ja testi äppi.

## Miks see töötab?
- `signInWithOtp()` saadab emaile kasutades "Magic Link" template'i
- `{{ .Token }}` muutuja sisaldab 6-kohalist OTP koodi
- Template näitab koodi suurelt ja selgelt
- Kasutaja saab koodi kopeerida ja äpis sisestada 