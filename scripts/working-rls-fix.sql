-- WORKING RLS FIX FOR FRIEND REQUESTS
-- This fix resolves the service role authentication issue

-- The problem was that auth.role() returns null for service role operations
-- Instead, we check if auth.uid() is null (which indicates service role)

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can delete own friend requests" ON friend_requests;

-- Policy for SELECT operations
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (
    -- Allow when user is authenticated and is sender/receiver
    (auth.uid() IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id))
    OR
    -- Allow when auth.uid() is null (service role operations)
    auth.uid() IS NULL
  );

-- Policy for INSERT operations
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (
    -- Allow when user is authenticated and is the sender
    (auth.uid() IS NOT NULL AND auth.uid() = sender_id)
    OR
    -- Allow when auth.uid() is null (service role operations)
    auth.uid() IS NULL
  );

-- Policy for UPDATE operations
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (
    -- Allow when user is authenticated and is sender/receiver
    (auth.uid() IS NOT NULL AND (auth.uid() = receiver_id OR auth.uid() = sender_id))
    OR
    -- Allow when auth.uid() is null (service role operations)
    auth.uid() IS NULL
  );

-- Policy for DELETE operations
CREATE POLICY "Users can delete own friend requests" ON friend_requests
  FOR DELETE USING (
    -- Allow when user is authenticated and is sender/receiver
    (auth.uid() IS NOT NULL AND (auth.uid() = receiver_id OR auth.uid() = sender_id))
    OR
    -- Allow when auth.uid() is null (service role operations)
    auth.uid() IS NULL
  ); 