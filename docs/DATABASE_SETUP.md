# Database Setup Instructions

## 🚨 IMPORTANT: Run this SQL in your Supabase dashboard

Go to your Supabase project → SQL Editor → New Query and paste the contents of `scripts/setup-database.sql`

## What this script does:

### 1. **Creates proper users table**
- `id` (UUID, references auth.users)
- `email` (TEXT, NOT NULL, UNIQUE)
- `name` (TEXT, NOT NULL)
- `username` (TEXT, UNIQUE)
- `vibe` (TEXT) - for user bio/description
- `avatar_url` (TEXT)
- `onboarding_completed` (BOOLEAN, default FALSE)
- `created_at`, `updated_at` (TIMESTAMPS)

### 2. **Creates friends table**
- Handles friendship relationships
- Status: pending, accepted, blocked
- Proper foreign key relationships

### 3. **Creates user_status table**
- Handles online/offline status
- Activity tracking
- Last seen timestamps

### 4. **Sets up Row Level Security (RLS)**
- Users can only see/edit their own data
- Friends can see each other's status
- Proper security policies

### 5. **Creates triggers and functions**
- Auto-creates user profile when someone signs up
- Auto-updates timestamps
- Handles user metadata properly

### 6. **Creates indexes**
- Optimizes database performance
- Fast lookups for common queries

## After running the script:

1. **Test registration** - Create a new account
2. **Test sign-in** - Sign in with existing account  
3. **Check profile** - Verify all data shows correctly
4. **Test bio/vibe** - Should save and display properly
5. **Test default avatars** - Should show initials when no photo

## Production considerations:

- Remove the test data section if you don't want sample data
- Monitor RLS policies to ensure they meet your security requirements
- Set up proper backup strategy
- Consider adding more indexes based on usage patterns

## Troubleshooting:

If you get permission errors:
1. Make sure you're running as a superuser in Supabase
2. Check that RLS policies are correctly set up
3. Verify auth.users table exists and is accessible

If columns are missing:
1. The script includes ALTER TABLE statements to add missing columns
2. It's safe to run multiple times
3. Check information_schema.columns to verify structure 