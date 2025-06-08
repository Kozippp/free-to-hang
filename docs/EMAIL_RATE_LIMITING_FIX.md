# Fixing Email Rate Limit Issues

## Problem
You're seeing "email rate limit exceeded" error when trying to register.

## Why This Happens
- Supabase limits how many emails can be sent per hour
- Default limit is usually 3-4 emails per hour per email address
- This prevents spam and abuse

## Solutions

### 1. Wait and Try Again
The simplest solution is to wait 1 hour and try again.

### 2. Check Supabase Email Rate Limits
1. Go to your Supabase Dashboard
2. Navigate to **Authentication → Settings**
3. Scroll down to **Rate Limits** section
4. Look for:
   - "Email sending rate limit"
   - "SMS sending rate limit"

### 3. Adjust Rate Limits (If Available)
Some Supabase plans allow you to adjust rate limits:
1. In **Authentication → Settings**
2. Find **Rate Limits** section
3. Increase "Email sending rate limit" if possible

### 4. Use Different Email Addresses for Testing
Instead of repeatedly using the same email:
- Use different email addresses for testing
- Try: yourname+test1@gmail.com, yourname+test2@gmail.com, etc.
- Gmail treats these as different emails but delivers to same inbox

### 5. Clear Rate Limit (Temporary Fix)
If you have access to Supabase SQL Editor:

```sql
-- This might help reset rate limits (use with caution)
DELETE FROM auth.audit_log_entries 
WHERE created_at < NOW() - INTERVAL '1 hour'
AND log_type = 'signup';
```

### 6. Production Setup
For production apps, consider:
- Upgrading to higher Supabase plan with higher limits
- Using custom SMTP provider (like we set up with Resend)
- Implementing proper user flow that minimizes duplicate signups

## Current Status
✅ Email system is working (confirmed with bounced test email)
❌ Rate limit preventing immediate retries

## Next Steps
1. Wait 1 hour OR use different email address
2. Try registration again
3. If still having issues, check Supabase dashboard rate limits 