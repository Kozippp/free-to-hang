-- Production-Ready RLS Policies for Friend Requests
-- This maintains security while allowing proper service role operations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can delete own friend requests" ON friend_requests;

-- Policy for SELECT operations
-- Users can view requests they sent or received
-- Service role can view all (needed for backend operations)
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (
    -- Allow authenticated users to see their own requests
    (auth.role() = 'authenticated' AND (auth.uid() = sender_id OR auth.uid() = receiver_id))
    OR
    -- Allow service role for backend operations
    auth.role() = 'service_role'
  );

-- Policy for INSERT operations
-- Users can create requests as sender
-- Service role can create any request (backend validates the sender)
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (
    -- Allow authenticated users to create requests as sender
    (auth.role() = 'authenticated' AND auth.uid() = sender_id)
    OR
    -- Allow service role for backend operations
    auth.role() = 'service_role'
  );

-- Policy for UPDATE operations  
-- Users can update requests they sent or received
-- Service role can update any request (backend validates permissions)
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (
    -- Allow authenticated users to update their own requests
    (auth.role() = 'authenticated' AND (auth.uid() = receiver_id OR auth.uid() = sender_id))
    OR
    -- Allow service role for backend operations
    auth.role() = 'service_role'
  );

-- Policy for DELETE operations (for declining requests)
-- Users can delete requests they sent or received
-- Service role can delete any request (backend validates permissions)
CREATE POLICY "Users can delete own friend requests" ON friend_requests
  FOR DELETE USING (
    -- Allow authenticated users to delete their own requests
    (auth.role() = 'authenticated' AND (auth.uid() = receiver_id OR auth.uid() = sender_id))
    OR
    -- Allow service role for backend operations  
    auth.role() = 'service_role'
  ); 