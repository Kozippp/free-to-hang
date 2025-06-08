# Quick Testing Setup

## Option 1: Temporarily Disable Email Confirmation (Testing Only!)

If you want to test the app immediately without email setup:

### Steps:
1. **Go to Supabase dashboard**: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj
2. **Select "Authentication" → "Settings"**
3. **Find "User Signups" section**
4. **Turn OFF "Enable email confirmations"**

### ⚠️ Warnings:
- This solution is ONLY for testing
- Do not use this in production environment
- After testing, turn email confirmations back ON

---

## Option 2: Complete Email Setup (Recommended)

Follow the instructions in `EMAIL_SETUP.md` or `PROFESSIONAL_EMAIL_SETUP.md`

---

## Current App Status

✅ **What Works:**
- User registration
- Email confirmation waiting screen
- Deep linking support for email confirmation
- Resend email confirmation
- Clear error messages in English

🔄 **What Needs Setup:**
- SMTP server in Supabase dashboard
- Email template customization
- Production environment URL configuration

## To Test:

1. **Choose one option:**
   - **Quick test**: Disable email confirmations (Option 1)
   - **Full setup**: Configure SMTP (PROFESSIONAL_EMAIL_SETUP.md)

2. **Start the app:**
   ```bash
   expo start --tunnel
   ```

3. **Test registration:**
   - Create a new user
   - Check if redirected to correct screen
   - Test sign in

## Recommendations:

- **For development**: Use Option 1 (disable email confirmation)
- **For production**: Use Option 2 (full SMTP setup)
- **For mobile testing**: Use `expo start --tunnel` flag 