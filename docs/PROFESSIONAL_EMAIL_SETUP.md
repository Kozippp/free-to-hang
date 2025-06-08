# Professional Email System Setup for Free2Hang

## Complete Email System using info@freetohang.com

### Option 1: SendGrid (Recommended for Apps)

SendGrid is perfect for transactional emails and newsletters. Here's the complete setup:

#### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com/
2. Sign up for a free account (100 emails/day free)
3. Verify your account

#### Step 2: Domain Authentication
1. In SendGrid dashboard, go to **Settings → Sender Authentication**
2. Click **Authenticate Your Domain**
3. Enter your domain: `freetohang.com`
4. Choose "Yes" for branded links
5. SendGrid will provide DNS records

#### Step 3: Add DNS Records to Your Domain
You need to add these DNS records to your domain provider (where you bought freetohang.com):

**Example DNS Records (SendGrid will give you specific ones):**
```
Type: CNAME
Name: s1._domainkey
Value: s1.domainkey.u12345.wl.sendgrid.net

Type: CNAME  
Name: s2._domainkey
Value: s2.domainkey.u12345.wl.sendgrid.net

Type: CNAME
Name: em1234
Value: u12345.wl.sendgrid.net

Type: TXT
Name: @
Value: v=spf1 include:sendgrid.net ~all
```

#### Step 4: Create API Key
1. Go to **Settings → API Keys**
2. Click **Create API Key**
3. Choose "Restricted Access"
4. Give it permissions for: Mail Send, Marketing Campaigns
5. Copy the API Key (save it securely!)

#### Step 5: Configure Supabase
1. Go to your Supabase dashboard: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj
2. Navigate to **Authentication → Settings**
3. Find **SMTP Settings** section
4. Enter:
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Pass: [Your SendGrid API Key from Step 4]
   SMTP From: info@freetohang.com
   ```

#### Step 6: Test Email Configuration
1. In Supabase, scroll to **Email Templates**
2. Click **Test Email Configuration**
3. Send a test email to yourself

### Option 2: Google Workspace (For Business Email)

If you want info@freetohang.com as a full business email:

#### Step 1: Google Workspace Setup
1. Go to https://workspace.google.com/
2. Start free trial
3. Enter your domain: freetohang.com
4. Follow verification steps

#### Step 2: Create info@freetohang.com
1. In Google Admin Console
2. Add user: info@freetohang.com
3. Set strong password

#### Step 3: Configure for Supabase
1. Enable 2-Step Verification for info@freetohang.com
2. Create App Password:
   - Google Account → Security → App Passwords
   - Generate password for "Mail"
3. Use in Supabase SMTP:
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: info@freetohang.com
   SMTP Pass: [App Password from step 2]
   SMTP From: info@freetohang.com
   ```

### Email Templates Configuration

#### Confirmation Email Template
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #4CAF50; }
        .button { background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { text-align: center; font-size: 12px; color: #666; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Free2Hang</div>
            <h1>Welcome to Free2Hang!</h1>
        </div>
        
        <p>Thank you for signing up! We're excited to have you join our community.</p>
        
        <p>To complete your registration, please confirm your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
            <a href="{{ .ConfirmationURL }}" class="button">Confirm Email Address</a>
        </div>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">{{ .ConfirmationURL }}</p>
        
        <div class="footer">
            <p>This email was sent by Free2Hang</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>
```

### Newsletter Setup (Future)

For newsletters, you can use:
1. **SendGrid Marketing Campaigns** (if using SendGrid)
2. **Mailchimp** connected to your domain
3. **ConvertKit** for more advanced features

### Testing Your Setup

1. Try registering a new user in your app
2. Check if confirmation email arrives
3. Test the confirmation link
4. Monitor SendGrid dashboard for delivery stats

### Troubleshooting

**Common Issues:**
- **DNS not propagated**: Wait 24-48 hours after adding DNS records
- **Emails in spam**: Make sure SPF and DKIM records are set
- **Authentication failed**: Double-check API key and permissions

**Need Help?**
- SendGrid Support: https://support.sendgrid.com/
- Check DNS propagation: https://dnschecker.org/

### Cost Breakdown

**SendGrid:**
- Free: 100 emails/day
- Essentials: $14.95/month (40,000 emails)
- Pro: $89.95/month (120,000 emails)

**Google Workspace:**
- Business Starter: $6/user/month
- Includes full Gmail, Drive, Meet, etc.

### Next Steps After Setup

1. ✅ Complete domain verification
2. ✅ Test email sending
3. ✅ Set up email templates
4. ✅ Configure monitoring
5. 🔄 Plan newsletter campaigns
6. 🔄 Set up automated email sequences 