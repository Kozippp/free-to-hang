-- Fix RLS policy for users table to allow viewing other users' profiles (needed for notifications)
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

CREATE POLICY "Users can view all profiles" 
ON users FOR SELECT 
USING (true);
