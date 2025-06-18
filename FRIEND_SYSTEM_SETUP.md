# Facebook-like Friend System Setup Guide

## 🎯 Overview

This guide will help you set up the complete Facebook-like friend system with:
- ✅ Single table architecture (`friend_requests`)
- ✅ Express.js REST API backend
- ✅ Real-time updates via Supabase
- ✅ Frontend integration with React Native

## 📋 Prerequisites

1. Supabase project with access to SQL Editor
2. Node.js and npm installed
3. React Native/Expo development environment

## 🗄️ Database Setup

### Step 1: Apply Database Schema

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Run the following SQL commands **one by one**:

```sql
-- Step 1: Create the friend_requests table
CREATE TABLE friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate requests between same users
  UNIQUE(sender_id, receiver_id),
  
  -- Prevent self-requests
  CHECK (sender_id != receiver_id)
);
```

```sql
-- Step 2: Create indexes
CREATE INDEX idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);
CREATE INDEX idx_friend_requests_sender_status ON friend_requests(sender_id, status);
CREATE INDEX idx_friend_requests_receiver_status ON friend_requests(receiver_id, status);
```

```sql
-- Step 3: Enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
```

```sql
-- Step 4: Create RLS policies
-- Users can view requests they sent or received
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create friend requests (as sender)
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (accept/decline) or sent (cancel)
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
```

```sql
-- Step 5: Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

```sql
-- Step 6: Create trigger
CREATE TRIGGER update_friend_requests_updated_at
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Create Database Functions

Run these functions in the SQL Editor:

```sql
-- Function 1: Get friendship status between two users
CREATE OR REPLACE FUNCTION get_friendship_status(user1_id UUID, user2_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    request_record friend_requests%ROWTYPE;
BEGIN
    -- Check if there's a request from user1 to user2
    SELECT * INTO request_record
    FROM friend_requests
    WHERE sender_id = user1_id AND receiver_id = user2_id;
    
    IF FOUND THEN
        RETURN request_record.status || '_sent';
    END IF;
    
    -- Check if there's a request from user2 to user1
    SELECT * INTO request_record
    FROM friend_requests
    WHERE sender_id = user2_id AND receiver_id = user1_id;
    
    IF FOUND THEN
        RETURN request_record.status || '_received';
    END IF;
    
    -- No relationship found
    RETURN 'none';
END;
$$;
```

```sql
-- Function 2: Get all friends for a user
CREATE OR REPLACE FUNCTION get_user_friends(user_id UUID)
RETURNS TABLE(
    friend_id UUID,
    friend_name TEXT,
    friend_username TEXT,
    friend_avatar_url TEXT,
    friend_vibe TEXT,
    friendship_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Friends where user is sender
    SELECT 
        u.id as friend_id,
        u.name as friend_name,
        u.username as friend_username,
        u.avatar_url as friend_avatar_url,
        u.vibe as friend_vibe,
        fr.updated_at as friendship_date
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.sender_id = user_id AND fr.status = 'accepted'
    
    UNION
    
    -- Friends where user is receiver
    SELECT 
        u.id as friend_id,
        u.name as friend_name,
        u.username as friend_username,
        u.avatar_url as friend_avatar_url,
        u.vibe as friend_vibe,
        fr.updated_at as friendship_date
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = user_id AND fr.status = 'accepted'
    
    ORDER BY friendship_date DESC;
END;
$$;
```

```sql
-- Function 3: Get incoming friend requests
CREATE OR REPLACE FUNCTION get_incoming_requests(user_id UUID)
RETURNS TABLE(
    request_id UUID,
    sender_id UUID,
    sender_name TEXT,
    sender_username TEXT,
    sender_avatar_url TEXT,
    sender_vibe TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id as request_id,
        u.id as sender_id,
        u.name as sender_name,
        u.username as sender_username,
        u.avatar_url as sender_avatar_url,
        u.vibe as sender_vibe,
        fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = user_id AND fr.status = 'pending'
    ORDER BY fr.created_at DESC;
END;
$$;
```

```sql
-- Function 4: Get outgoing friend requests
CREATE OR REPLACE FUNCTION get_outgoing_requests(user_id UUID)
RETURNS TABLE(
    request_id UUID,
    receiver_id UUID,
    receiver_name TEXT,
    receiver_username TEXT,
    receiver_avatar_url TEXT,
    receiver_vibe TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id as request_id,
        u.id as receiver_id,
        u.name as receiver_name,
        u.username as receiver_username,
        u.avatar_url as receiver_avatar_url,
        u.vibe as receiver_vibe,
        fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.sender_id = user_id AND fr.status = 'pending'
    ORDER BY fr.created_at DESC;
END;
$$;
```

## 🌐 Backend Setup

### Step 1: Create Environment Variables

Create a `.env` file in the `backend/` directory:

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NODE_ENV=development
PORT=3000
```

### Step 2: Start the Backend Server

```bash
cd backend
npm install
npm start
```

The server should start on `http://localhost:3000`

## 📱 Frontend Setup

The frontend is already configured and ready to use. Just make sure:

1. Your `.env.local` file has the correct API URL:
```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

2. Start the React Native app:
```bash
npx expo start --clear --tunnel
```

## 🔗 API Endpoints

The friend system provides these REST endpoints:

### Friend Requests
- `POST /friends/request` - Send friend request
- `POST /friends/request/accept` - Accept friend request  
- `POST /friends/request/decline` - Decline friend request
- `POST /friends/request/cancel` - Cancel sent request

### Data Retrieval
- `GET /friends` - Get all friends
- `GET /friends/requests/incoming` - Get incoming requests
- `GET /friends/requests/outgoing` - Get outgoing requests
- `GET /friends/status/:user_id` - Get relationship status
- `GET /friends/search?query=username` - Search users

### Friend Management
- `POST /friends/remove` - Remove friend

## 🎮 Frontend Usage

### Profile Screen Tabs

1. **Friends Tab**: Shows confirmed friends
2. **Requests Tab**: Shows incoming friend requests with Accept/Decline buttons
3. **Add Tab**: 
   - Search bar for usernames
   - "Pending Requests" section showing sent requests

### Button Logic

- **Search Results**:
  - No relationship → "Add" button
  - Request sent → "Pending" tag
  - Request received → "Accept" and "Decline" buttons
  - Already friends → "Friends" tag

## ⚡ Real-time Features

- Automatic updates when friend requests are sent/received
- Live status changes when requests are accepted/declined
- Real-time friend list updates

## 🧪 Testing

1. Create two user accounts
2. Search for users by username
3. Send friend requests
4. Accept/decline requests
5. Verify real-time updates
6. Test removing friends

## 🚀 Deployment

### Backend (Railway)
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy the backend

### Frontend (Expo)
1. Update `EXPO_PUBLIC_API_URL` to your deployed backend URL
2. Build and deploy your Expo app

## 🐛 Troubleshooting

### Backend Not Starting
- Check environment variables are set correctly
- Ensure Supabase URL and service role key are valid
- Verify port 3000 is not in use

### Database Errors
- Ensure all SQL functions are created
- Check RLS policies are applied
- Verify `users` table exists with required fields

### Frontend Issues
- Check API URL configuration
- Verify authentication is working
- Check console logs for errors

## ✅ Success Checklist

- [ ] Database schema applied
- [ ] Database functions created
- [ ] Backend server running
- [ ] Frontend connecting to backend
- [ ] Friend requests working
- [ ] Real-time updates functioning
- [ ] Search working
- [ ] Accept/decline working
- [ ] Remove friends working

## 📞 Support

If you encounter issues:
1. Check the console logs
2. Verify database setup
3. Test API endpoints manually
4. Check authentication tokens

Your Facebook-like friend system is now ready! 🎉 