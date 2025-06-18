-- Friend System Database Schema
-- Facebook-like friend request system

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;

-- Create friend_requests table
-- This handles both pending requests and accepted friendships
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

-- Create indexes for performance
CREATE INDEX idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);
CREATE INDEX idx_friend_requests_sender_status ON friend_requests(sender_id, status);
CREATE INDEX idx_friend_requests_receiver_status ON friend_requests(receiver_id, status);

-- Enable Row Level Security
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friend_requests table
DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;

-- Users can view requests they sent or received
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create friend requests (as sender)
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (accept/decline) or sent (cancel)
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON friend_requests;
CREATE TRIGGER update_friend_requests_updated_at
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Helper function to get friend relationship status between two users
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

-- Function to get all friends for a user (accepted requests in both directions)
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

-- Function to get incoming friend requests for a user
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

-- Function to get outgoing friend requests for a user
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