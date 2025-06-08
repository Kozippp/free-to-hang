# 🔧 Resend.com Email Troubleshooting Guide

## 📧 Current Issue
User registers → App says "check your email" → **No email appears in inbox**

## 🚀 Quick Debug Commands

```bash
# Test your email delivery right now
npm run test-email

# Check configuration
npm run setup-email
```

## 🕵️ Step-by-Step Troubleshooting

### Step 1: Check Email Delivery Logs

**In Resend Dashboard:**
1. Go to https://resend.com/emails
2. Look for recent email attempts
3. Check the status of emails sent

**Common Status Indicators:**
- ✅ **Delivered**: Email was successfully sent
- ⏳ **Queued**: Email is being processed  
- ❌ **Failed**: Email failed to send
- 🚫 **Bounced**: Email was rejected by recipient

### Step 2: Verify Supabase SMTP Configuration

**Check your Supabase settings:**
1. Go to: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj
2. Navigate: **Authentication → Settings → SMTP Settings**

**Correct Resend Configuration:**
```
SMTP Host: smtp.resend.com
SMTP Port: 587 (or 465 for SSL)
SMTP User: resend
SMTP Pass: [Your Resend API Key]
SMTP From: info@freetohang.com
```

### Step 3: Test Email Configuration in Supabase

**In Supabase Dashboard:**
1. Go to **Authentication → Settings**
2. Scroll to **SMTP Settings**
3. Click **"Send Test Email"**
4. Enter your personal email
5. Check if test email arrives

### Step 4: Check Common Email Issues

#### A) Spam/Junk Folder
- ✅ Check spam/junk folder in your email client
- ✅ Check "Promotions" tab (Gmail)
- ✅ Check "Updates" tab (Gmail)

#### B) Email Client Issues
- ✅ Try different email addresses (Gmail, Outlook, Yahoo)
- ✅ Check on mobile and desktop
- ✅ Wait 5-10 minutes (delivery delays)

#### C) Domain Verification Issues
**In Resend Dashboard:**
1. Go to **Domains** section
2. Verify `freetohang.com` shows **"Verified"** status
3. Check all DNS records are properly set:
   - SPF record
   - DKIM record
   - DMARC record (optional but recommended)

### Step 5: DNS Record Verification

**Check if DNS records are properly propagated:**
1. Go to https://dnschecker.org/
2. Enter your domain: `freetohang.com`
3. Check TXT records for SPF/DKIM

**Example DNS Records for Resend:**
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

Type: TXT  
Name: resend._domainkey
Value: [DKIM key from Resend dashboard]
```

### Step 6: Debug with Automated Testing

**Run the debug script:**
```bash
npm run test-email
```

This will:
- Test Supabase connection
- Try sending a confirmation email
- Show detailed error messages
- Guide you through troubleshooting

## 🔧 Common Solutions

### Solution 1: API Key Issues
**Problem:** Wrong or expired Resend API key

**Fix:**
1. Go to https://resend.com/api-keys
2. Create new API key with "Sending access" 
3. Update in Supabase SMTP settings

### Solution 2: Domain Not Verified
**Problem:** Domain shows "Pending" in Resend

**Fix:**
1. Check DNS records are added correctly
2. Wait 24-48 hours for DNS propagation
3. Use https://dnschecker.org/ to verify

### Solution 3: Email Templates
**Problem:** Supabase using wrong email template

**Fix:**
1. In Supabase: Authentication → Settings → Email Templates
2. Customize "Confirm signup" template
3. Use this template:

```html
<h2>Welcome to Free2Hang!</h2>
<p>Thanks for signing up!</p>
<p>Click the link below to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>If the link doesn't work, copy and paste this URL:</p>
<p>{{ .ConfirmationURL }}</p>
```

### Solution 4: Port Issues
**Problem:** SMTP port blocked

**Try these ports:**
- Port 587 (TLS)
- Port 465 (SSL)
- Port 2587 (Alternative)

### Solution 5: Rate Limiting
**Problem:** Too many emails sent

**Check:**
- Resend dashboard for rate limit warnings
- Try with different email address
- Wait and try again later

## 🚨 Emergency Fixes

### Quick Test Without Domain
If domain issues persist, temporarily test with Resend's default:

```
SMTP From: onboarding@resend.dev
```

### Disable Email Confirmation Temporarily
For immediate testing:
1. Supabase → Authentication → Settings
2. Turn OFF "Enable email confirmations"
3. Test user registration
4. Turn back ON when fixed

## 📞 Getting Help

### Check These First:
1. **Resend Logs**: https://resend.com/emails
2. **Domain Status**: https://resend.com/domains  
3. **DNS Check**: https://dnschecker.org/
4. **Supabase Logs**: Project → Logs → Auth

### Still Not Working?
1. Run: `npm run test-email`
2. Check all steps above
3. Try different email provider temporarily
4. Contact Resend support with specific error messages

## ✅ Success Checklist

- [ ] Resend domain shows "Verified"
- [ ] DNS records propagated (24-48 hours)
- [ ] Supabase SMTP config correct
- [ ] Test email from Supabase works
- [ ] Checked spam/junk folders
- [ ] Tried multiple email addresses
- [ ] API key has sending permissions

**Once all checked, your emails should be delivering successfully!** 🎉