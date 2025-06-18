-- Free to Hang Database Setup
-- Run this in Supabase SQL Editor

-- Drop existing users table if it exists (be careful in production!)
-- DROP TABLE IF EXISTS users CASCADE;

-- Create users table with all required fields (with proper status column)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  vibe TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'available')),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- Add status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'status') THEN
    ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'available'));
  END IF;
  
  -- Add vibe column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'vibe') THEN
    ALTER TABLE users ADD COLUMN vibe TEXT;
  END IF;
  
  -- Add onboarding_completed column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add username column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'username') THEN
    ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
  END IF;
END $$;

-- Create friendships table (simpler approach - only accepted friendships)
CREATE TABLE IF NOT EXISTS friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Create friend_requests table for pending requests
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Create blocked_users table for blocking functionality
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Drop the old friends table if it exists to avoid confusion
DROP TABLE IF EXISTS friends CASCADE;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view public profiles for friend search" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles for friend search" ON users
  FOR SELECT USING (onboarding_completed = true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for friendships table
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;

CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- RLS Policies for friend_requests table
DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;

CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id);

-- RLS Policies for blocked_users table
DROP POLICY IF EXISTS "Users can view own blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can create blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can delete own blocked users" ON blocked_users;

CREATE POLICY "Users can view own blocked users" ON blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocked users" ON blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocked users" ON blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Trigger to call the function when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON blocked_users(blocked_id);

-- Database functions for relationship management

-- Function to handle friend request sending/accepting
CREATE OR REPLACE FUNCTION upsert_relationship(
  user1_id UUID,
  user2_id UUID,
  new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent self-friendship
  IF user1_id = user2_id THEN
    RAISE EXCEPTION 'Cannot create relationship with yourself';
  END IF;
  
  -- Handle different relationship statuses
  CASE new_status
    WHEN 'pending_sent' THEN
      -- Send friend request
      INSERT INTO friend_requests (sender_id, receiver_id, status)
      VALUES (user1_id, user2_id, 'pending')
      ON CONFLICT (sender_id, receiver_id) 
      DO UPDATE SET status = 'pending', created_at = NOW();
      
    WHEN 'friends' THEN
      -- Accept friend request - create bidirectional friendship
      -- First, remove any existing friend request
      DELETE FROM friend_requests 
      WHERE (sender_id = user1_id AND receiver_id = user2_id) 
         OR (sender_id = user2_id AND receiver_id = user1_id);
      
      -- Create bidirectional friendship
      INSERT INTO friendships (user_id, friend_id)
      VALUES (user1_id, user2_id), (user2_id, user1_id)
      ON CONFLICT (user_id, friend_id) DO NOTHING;
      
    WHEN 'blocked_by_me' THEN
      -- Block user
      -- Remove any existing relationships
      DELETE FROM friendships 
      WHERE (user_id = user1_id AND friend_id = user2_id) 
         OR (user_id = user2_id AND friend_id = user1_id);
      DELETE FROM friend_requests 
      WHERE (sender_id = user1_id AND receiver_id = user2_id) 
         OR (sender_id = user2_id AND receiver_id = user1_id);
      
      -- Add to blocked users
      INSERT INTO blocked_users (blocker_id, blocked_id)
      VALUES (user1_id, user2_id)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
      
    ELSE
      RAISE EXCEPTION 'Invalid relationship status: %', new_status;
  END CASE;
END;
$$;

-- Function to delete/decline relationships
CREATE OR REPLACE FUNCTION delete_relationship(
  user1_id UUID,
  user2_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove friendships (bidirectional)
  DELETE FROM friendships 
  WHERE (user_id = user1_id AND friend_id = user2_id) 
     OR (user_id = user2_id AND friend_id = user1_id);
  
  -- Remove friend requests (both directions)
  DELETE FROM friend_requests 
  WHERE (sender_id = user1_id AND receiver_id = user2_id) 
     OR (sender_id = user2_id AND receiver_id = user1_id);
END;
$$;

-- Function to get user relationships (compatible with the existing code)
CREATE OR REPLACE FUNCTION get_user_relationships(user_id UUID)
RETURNS TABLE(
  friends JSONB,
  friend_requests JSONB,
  sent_requests JSONB,
  blocked_users JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Friends
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'username', u.username,
          'avatar_url', u.avatar_url,
          'vibe', u.vibe
        )
      )
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = get_user_relationships.user_id),
      '[]'::jsonb
    ) as friends,
    
    -- Friend requests received
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'username', u.username,
          'avatar_url', u.avatar_url,
          'vibe', u.vibe
        )
      )
      FROM friend_requests fr
      JOIN users u ON u.id = fr.sender_id
      WHERE fr.receiver_id = get_user_relationships.user_id AND fr.status = 'pending'),
      '[]'::jsonb
    ) as friend_requests,
    
    -- Friend requests sent
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'username', u.username,
          'avatar_url', u.avatar_url,
          'vibe', u.vibe
        )
      )
      FROM friend_requests fr
      JOIN users u ON u.id = fr.receiver_id
      WHERE fr.sender_id = get_user_relationships.user_id AND fr.status = 'pending'),
      '[]'::jsonb
    ) as sent_requests,
    
    -- Blocked users
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'username', u.username,
          'avatar_url', u.avatar_url,
          'vibe', u.vibe
        )
      )
      FROM blocked_users bu
      JOIN users u ON u.id = bu.blocked_id
      WHERE bu.blocker_id = get_user_relationships.user_id),
      '[]'::jsonb
    ) as blocked_users;
END;
$$;

-- Insert some test data if needed (optional)
-- You can remove this section in production
/*
INSERT INTO users (id, email, name, username, vibe, onboarding_completed) 
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test User', 'testuser', 'Love hanging out!', TRUE)
ON CONFLICT (id) DO NOTHING;
*/ 