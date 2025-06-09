-- Add RLS policy to allow users to view public profiles for friend search
-- This allows users to search for other users who have completed onboarding

-- Drop the policy if it already exists
DROP POLICY IF EXISTS "Users can view public profiles for friend search" ON users;

-- Create new policy that allows viewing public user info for friend search
CREATE POLICY "Users can view public profiles for friend search" ON users
  FOR SELECT USING (onboarding_completed = true);

-- Verify the policy was created
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'; 