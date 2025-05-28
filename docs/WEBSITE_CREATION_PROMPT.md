# Free2Hang Website Creation Prompt

Copy and paste this entire prompt to an AI assistant in a new project to create the Free2Hang website:

---

## PROJECT BRIEF: Free2Hang Website Creation

I need you to create a complete website for my mobile app "Free2Hang" using Next.js 14, Tailwind CSS, and deploy it to Vercel. The website needs to serve as both a landing page and handle authentication redirects from Supabase.

## ABOUT THE APP
**Free2Hang** is a social mobile app that helps friends coordinate plans and meetups. Key features:
- Friends can see each other's availability status (free/busy)
- Create and join hangout plans
- Real-time location sharing
- Status updates and notifications
- User-friendly interface with blue (#3B82F6) primary color and green (#4CAF50) accents

## TECHNICAL REQUIREMENTS

### Technology Stack:
- **Next.js 14** (App Router)
- **Tailwind CSS** for styling
- **TypeScript** for type safety
- **Shadcn/ui** components for consistency
- **Responsive design** (mobile-first)
- **SEO optimized**

### Color Scheme (match the mobile app):
```css
Primary Blue: #3B82F6
Success Green: #4CAF50
Background: #FFFFFF
Secondary Text: #6B7280
Dark Text: #1F2937
Light Background: #F9FAFB
Button Background: #F1F5F9
```

### Domain:
- Primary domain: **freetohang.com**
- Will be deployed to Vercel
- DNS managed at zone.ee

## REQUIRED PAGES

### 1. Landing Page (/)
Create a modern, attractive landing page with:

**Header:**
- Logo: "Free2Hang" text with toggle switch icon (green, like in app)
- Navigation: Features, Download, Contact
- Mobile hamburger menu

**Hero Section:**
- Main headline: "Stay Connected with Your Friends"
- Subheadline: "See when your friends are free to hang out and make plans together"
- Call-to-action buttons: "Download for iOS" and "Download for Android"
- Hero image/illustration of friends using phones

**Features Section:**
- **Real-time Status**: "See when friends are available"
- **Easy Planning**: "Create and join hangout plans effortlessly"
- **Location Sharing**: "Share your location with trusted friends"
- **Smart Notifications**: "Get notified about plans and friend activity"

**How It Works:**
1. Add friends to your network
2. Set your availability status
3. Create or join plans
4. Meet up and have fun!

**Download Section:**
- App Store and Google Play buttons (placeholder links for now)
- QR code for easy download
- "Available on iOS and Android"

**Footer:**
- Contact: info@freetohang.com
- Privacy Policy, Terms of Service (placeholder links)
- Social media links (placeholder)
- Copyright © 2024 Free2Hang

### 2. Email Confirmation Page (/auth/confirm)
**CRITICAL: This page handles email confirmation redirects from Supabase**

Create a page that:
- Shows success message: "✅ Email Confirmed!"
- Explains: "Your email address has been successfully confirmed."
- Instructions: "You can now close this page and return to the Free2Hang app to sign in."
- Button: "Open Free2Hang App" (links to `freetohang://auth/confirmed`)
- Auto-redirect script (see JavaScript below)

**Required JavaScript:**
```javascript
// Auto-redirect to mobile app after 3 seconds
setTimeout(function() {
    // Try to open the mobile app
    window.location.href = 'freetohang://auth/confirmed';
}, 3000);

// Fallback: handle URL parameters from Supabase
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('access_token');
const refreshToken = urlParams.get('refresh_token');

if (accessToken && refreshToken) {
    // Success - tokens are present
    console.log('Email confirmation successful');
}
```

### 3. Password Reset Page (/auth/reset-password)
**CRITICAL: This page handles password reset redirects from Supabase**

Create a page that:
- Shows message: "🔒 Reset Your Password"
- Instructions: "Click the button below to open the Free2Hang app and set your new password."
- Button: "Open Free2Hang App" (handles token passing)
- Auto-redirect script (see JavaScript below)

**Required JavaScript:**
```javascript
// Extract tokens from URL and pass to mobile app
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('access_token');
const refreshToken = urlParams.get('refresh_token');

if (accessToken && refreshToken) {
    // Build deep link with tokens
    const appUrl = `freetohang://auth/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}`;
    
    // Auto-redirect after 3 seconds
    setTimeout(function() {
        window.location.href = appUrl;
    }, 3000);
    
    // Also provide manual button
    document.getElementById('openAppButton').href = appUrl;
} else {
    // No tokens - show error
    document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h1>Invalid Reset Link</h1><p>This password reset link is invalid or has expired.</p></div>';
}
```

### 4. General Auth Callback (/auth/callback)
Simple page that handles any other auth redirects and shows appropriate messages.

## DESIGN REQUIREMENTS

### Visual Style:
- **Modern and clean** design
- **Mobile-first** responsive design
- **Smooth animations** and transitions
- **Professional but friendly** tone
- **Consistent with mobile app** styling

### Typography:
- Primary font: System fonts (Arial, Helvetica, sans-serif)
- Font sizes: Tailwind scale (text-sm, text-base, text-lg, etc.)
- Bold weights for headings

### Layout:
- **Maximum width**: 1200px centered
- **Sections**: Adequate padding and margins
- **Mobile**: Single column, easy navigation
- **Desktop**: Multi-column where appropriate

### Components:
- Use Shadcn/ui components where possible
- Custom button styles matching the app
- Consistent spacing (Tailwind spacing scale)

## DEPLOYMENT INSTRUCTIONS

### 1. Vercel Setup:
- Deploy to Vercel
- Connect to GitHub repository
- Set up custom domain: freetohang.com
- Enable automatic deployments

### 2. Environment Variables:
```
NEXT_PUBLIC_APP_URL=https://freetohang.com
NEXT_PUBLIC_APP_SCHEME=freetohang
```

### 3. Vercel Configuration (vercel.json):
```json
{
  "redirects": [
    {
      "source": "/app",
      "destination": "freetohang://",
      "permanent": false
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

## SEO REQUIREMENTS

### Meta Tags:
```html
<title>Free2Hang - Stay Connected with Your Friends</title>
<meta name="description" content="See when your friends are free to hang out and make plans together. Real-time status, easy planning, and location sharing." />
<meta name="keywords" content="friends, hangout, plans, social app, availability, meetup" />
<meta property="og:title" content="Free2Hang - Stay Connected with Your Friends" />
<meta property="og:description" content="See when your friends are free to hang out and make plans together." />
<meta property="og:image" content="/og-image.png" />
<meta property="og:url" content="https://freetohang.com" />
```

### Structured Data:
Add JSON-LD structured data for mobile app.

## TECHNICAL NOTES

### Deep Links:
- All mobile app links should use scheme: `freetohang://`
- Test deep links work on both iOS and Android
- Provide fallbacks for when app is not installed

### Security:
- HTTPS only
- Secure headers
- No sensitive data in URLs
- Validate all URL parameters

### Performance:
- Optimize images (use Next.js Image component)
- Minimize JavaScript bundles
- Fast page load times
- Good Core Web Vitals scores

## COMPLETION CHECKLIST

After building, ensure:
- [ ] Landing page is attractive and functional
- [ ] Auth pages correctly handle Supabase redirects
- [ ] Deep links work correctly
- [ ] Mobile responsive design
- [ ] Fast loading times
- [ ] SEO meta tags are present
- [ ] All links work correctly
- [ ] JavaScript redirect functions work
- [ ] Ready for Vercel deployment
- [ ] Matches mobile app design consistency

## DNS SETUP INSTRUCTIONS (for later)

Once deployed to Vercel, configure DNS at zone.ee:
- Add CNAME record: `freetohang.com` → `your-vercel-app.vercel.app`
- Add CNAME record: `www.freetohang.com` → `your-vercel-app.vercel.app`

---

**BUILD THIS COMPLETE WEBSITE FOLLOWING ALL REQUIREMENTS ABOVE. Ask clarifying questions if anything is unclear, but aim to build a production-ready website that matches the mobile app's design and handles all authentication flows correctly.** 