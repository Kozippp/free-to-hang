# Plans Database Schema Setup Guide

## Overview
This guide explains how to manually apply the plans database schema to enable real-time polls functionality.

## Prerequisites
1. Access to Supabase dashboard
2. Service role key for database operations
3. Backend server running locally

## Steps to Apply Schema

### 1. Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: `free-to-hang`
3. Go to SQL Editor

### 2. Run the Schema Script
Copy and paste the contents of `scripts/create-plans-tables.sql` into the SQL Editor and execute it.

### 3. Verify Tables Created
After running the script, verify these tables exist:
- `plan_polls`
- `plan_poll_options`
- `plan_poll_votes`
- `plan_completion_votes`
- `plan_attendance`
- `plan_updates`

### 4. Test Backend API
Run the test script to verify the backend works:
```bash
node scripts/test-plans-api.js
```

### 5. Test Real-time Functionality
1. Start the backend server: `cd backend && npm start`
2. Start the frontend: `npm start`
3. Create a plan and test poll creation
4. Verify real-time updates work

## Troubleshooting

### Common Issues
1. **RLS Policy Errors**: Make sure service role policies are created
2. **Table Not Found**: Verify all tables were created successfully
3. **Authentication Errors**: Check that JWT tokens are being passed correctly

### Manual Table Creation
If the script fails, you can create tables manually one by one:

```sql
-- Create plan_polls table
CREATE TABLE IF NOT EXISTS plan_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  poll_type TEXT CHECK (poll_type IN ('when', 'where', 'custom', 'invitation')) NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  invited_users TEXT[],
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Next Steps
After applying the schema:
1. Test poll creation functionality
2. Test real-time updates
3. Deploy to production
4. Monitor for any issues

## Support
If you encounter issues:
1. Check the backend logs
2. Verify database connections
3. Test individual API endpoints
4. Check RLS policies 