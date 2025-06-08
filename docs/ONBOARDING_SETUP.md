# Onboarding System Setup

## Overview

The Free2Hang app now includes a modern 3-step onboarding process that guides new users through:

1. **Bio & Interests** - Users select their hangout preferences and write a bio
2. **Profile Photo** - Users can add a profile picture (camera or gallery)
3. **Friends & Invitations** - Users can search for friends and invite new ones

## Database Migration Required

Before the onboarding system works, you need to add the `onboarding_completed` field to your users table:

### Step 1: Run the Migration

1. Go to your [Supabase Dashboard](https://app.supabase.com/project/nfzbvuyntzgszqdlsusj)
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"New Query"**
4. Copy and paste the contents of `scripts/add-onboarding-field.sql`
5. Click **"Run"**

Alternatively, run:
```bash
npm run migrate-onboarding
```

This will remind you to run the SQL script manually.

## How It Works

### Navigation Flow

1. **Sign Up** → Email Confirmation → **Onboarding Step 1**
2. **Sign In** (existing users) → Check `onboarding_completed` field:
   - `false` → Redirect to Onboarding Step 1
   - `true` → Redirect to Main App (Tabs)

### User Experience

- **Progress Indicator**: Shows current step (1 of 3, 2 of 3, 3 of 3)
- **Skip Options**: All steps can be skipped except interests selection (step 1 requires at least one interest)
- **Modern Design**: Clean white background with card-based layout, similar to popular apps
- **Humor**: Step 3 includes a light joke about the app being "useless without friends"

### Technical Implementation

- **AuthContext Integration**: Automatically checks onboarding status on login
- **Database Field**: `users.onboarding_completed` boolean field
- **Route Protection**: Only authenticated users can access onboarding
- **Completion**: Step 3 marks `onboarding_completed = true` in database

## Files Created

- `app/(onboarding)/_layout.tsx` - Layout for onboarding screens
- `app/(onboarding)/step-1.tsx` - Bio and interests selection
- `app/(onboarding)/step-2.tsx` - Profile photo upload
- `app/(onboarding)/step-3.tsx` - Friends and invitations
- `scripts/add-onboarding-field.sql` - Database migration script

## Files Modified

- `app/_layout.tsx` - Added onboarding route to root stack
- `contexts/AuthContext.tsx` - Added onboarding status checking
- `package.json` - Added migration reminder script

## Future Enhancements

The onboarding system is designed to be extensible:

- Save bio and interests to user profile
- Save profile photos to Supabase storage
- Implement friend search functionality
- Add contact import capabilities
- Track onboarding completion analytics

## Testing

To test the onboarding flow:

1. Create a new account (sign up)
2. Confirm email
3. Should automatically redirect to onboarding
4. Complete all 3 steps
5. Should redirect to main app
6. Sign out and sign in again - should go directly to main app

## Troubleshooting

**Issue**: Onboarding doesn't appear after sign up
- **Solution**: Check if database migration was run correctly
- **Check**: Verify `onboarding_completed` field exists in users table

**Issue**: User gets stuck in onboarding loop
- **Solution**: Manually set `onboarding_completed = true` for that user in database

**Issue**: Navigation errors
- **Solution**: Ensure all route names match exactly in navigation calls 