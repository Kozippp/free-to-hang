-- Free to Hang Database Setup
-- Run this in Supabase SQL Editor

-- Drop existing users table if it exists (be careful in production!)
-- DROP TABLE IF EXISTS users CASCADE;

-- Create users table with all required fields
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE, -- Nullable until onboarding is completed
  vibe TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if table already exists
DO $$
BEGIN
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

-- Create friends table for friendship relationships
CREATE TABLE IF NOT EXISTS friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Create user_status table for online/offline status
CREATE TABLE IF NOT EXISTS user_status (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  is_available BOOLEAN DEFAULT FALSE,
  activity TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for friends table
CREATE POLICY "Users can view own friendships" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendships" ON friends
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_status table
CREATE POLICY "Users can view friend status" ON user_status
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM friends 
      WHERE (user_id = auth.uid() AND friend_id = user_status.user_id AND status = 'accepted')
      OR (friend_id = auth.uid() AND user_id = user_status.user_id AND status = 'accepted')
    )
  );

CREATE POLICY "Users can update own status" ON user_status
  FOR ALL USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Simple user creation - no automatic username generation
  -- User must complete onboarding to set username
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
    -- If user creation fails, log the error but don't prevent auth
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

DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
CREATE TRIGGER update_user_status_updated_at
  BEFORE UPDATE ON user_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_is_available ON user_status(is_available);

-- Insert some test data if needed (optional)
-- You can remove this section in production
/*
INSERT INTO users (id, email, name, username, vibe, onboarding_completed) 
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test User', 'testuser', 'Love hanging out!', TRUE)
ON CONFLICT (id) DO NOTHING;
*/ 