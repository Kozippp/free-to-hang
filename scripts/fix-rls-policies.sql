-- Fix RLS Policies for Friend Requests
-- This script fixes the RLS policies to work with service role operations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;

-- Create new policies that work with both authenticated users and service role
-- Policy for SELECT operations
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (
    -- Allow if user is authenticated and is sender or receiver
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    OR
    -- Allow service role operations (when auth.uid() is null)
    auth.uid() IS NULL
  );

-- Policy for INSERT operations  
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (
    -- Allow if user is authenticated and is the sender
    auth.uid() = sender_id
    OR
    -- Allow service role operations (when auth.uid() is null)
    auth.uid() IS NULL
  );

-- Policy for UPDATE operations
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (
    -- Allow if user is authenticated and is sender or receiver
    (auth.uid() = receiver_id OR auth.uid() = sender_id)
    OR
    -- Allow service role operations (when auth.uid() is null)
    auth.uid() IS NULL
  );

-- Policy for DELETE operations (for declining requests)
CREATE POLICY "Users can delete own friend requests" ON friend_requests
  FOR DELETE USING (
    -- Allow if user is authenticated and is sender or receiver
    (auth.uid() = receiver_id OR auth.uid() = sender_id)
    OR
    -- Allow service role operations (when auth.uid() is null)
    auth.uid() IS NULL
  ); 