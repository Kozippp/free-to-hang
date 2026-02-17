-- ============================================
-- Direct Supabase Read Migration - Phase 1: RLS Fixes
-- ============================================
-- This migration fixes RLS policies to enable direct client access
-- to plans, participants, and user data while maintaining security.

-- ============================================
-- 1. Fix users table RLS
-- ============================================
-- Problem: Users can only view their own profile
-- Solution: Allow all authenticated users to read basic user data (name, avatar, username, bio)
--          but restrict updates to own profile only

DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can view all profiles" ON users;

-- Allow all authenticated users to read user profiles (needed for plans, friends, search)
CREATE POLICY "Users can view all profiles"
ON users FOR SELECT
TO authenticated
USING (true);

-- Users can still only update their own profile
-- (INSERT policy remains unchanged - handled by trigger)

-- ============================================
-- 2. Fix plan_participants table RLS
-- ============================================
-- Problem: Current policy only lets you see participants if you're the user OR plan creator
-- Solution: Allow viewing all participants in plans where you are a participant

DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;

-- New policy: Users can view participants in plans they're part of
CREATE POLICY "Users can view plan participants"
ON plan_participants FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM plan_participants 
    WHERE plan_id = plan_participants.plan_id
  )
  OR
  auth.uid() IN (
    SELECT creator_id
    FROM plans
    WHERE id = plan_participants.plan_id
  )
);

-- ============================================
-- 3. Verify friend_requests table exists and has proper RLS
-- ============================================
-- Note: Currently using 'friends' table, but migration plan mentions 'friend_requests'
-- Let's ensure both tables have proper RLS

-- Check if friend_requests table exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'friend_requests') THEN
    -- Create friend_requests table for new friend system
    CREATE TABLE friend_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(sender_id, receiver_id)
    );

    -- Enable RLS
    ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

    -- RLS Policies for friend_requests
    CREATE POLICY "Users can view their friend requests"
    ON friend_requests FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

    CREATE POLICY "Users can send friend requests"
    ON friend_requests FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

    CREATE POLICY "Users can update their friend requests"
    ON friend_requests FOR UPDATE
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

    CREATE POLICY "Users can delete their friend requests"
    ON friend_requests FOR DELETE
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

    -- Add trigger for updated_at
    CREATE TRIGGER update_friend_requests_updated_at 
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

    -- Add indexes for performance
    CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_id);
    CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id);
    CREATE INDEX idx_friend_requests_status ON friend_requests(status);
  END IF;
END $$;

-- ============================================
-- 4. Ensure plan_polls related tables exist with correct schema
-- ============================================
-- These should already exist from previous migrations, but verify

DO $$
BEGIN
  -- Check if plan_polls exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_polls') THEN
    CREATE TABLE plan_polls (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
      title TEXT NOT NULL,
      poll_type TEXT CHECK (poll_type IN ('when', 'where', 'custom', 'invitation')) NOT NULL,
      ends_at TIMESTAMP WITH TIME ZONE,
      invited_users UUID[],
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_plan_polls_plan_id ON plan_polls(plan_id);
    CREATE INDEX idx_plan_polls_created_at ON plan_polls(created_at DESC);
  END IF;

  -- Check if plan_poll_options exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_poll_options') THEN
    CREATE TABLE plan_poll_options (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
      option_text TEXT NOT NULL,
      option_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_plan_poll_options_poll_id ON plan_poll_options(poll_id);
    CREATE INDEX idx_plan_poll_options_order ON plan_poll_options(poll_id, option_order);
  END IF;

  -- Check if plan_poll_votes exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_poll_votes') THEN
    CREATE TABLE plan_poll_votes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
      option_id UUID REFERENCES plan_poll_options(id) ON DELETE CASCADE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(poll_id, user_id, option_id)
    );

    CREATE INDEX idx_plan_poll_votes_poll_id ON plan_poll_votes(poll_id);
    CREATE INDEX idx_plan_poll_votes_user_id ON plan_poll_votes(user_id);
    CREATE INDEX idx_plan_poll_votes_option_id ON plan_poll_votes(option_id);
  END IF;
END $$;

-- ============================================
-- 5. Ensure plan_updates table exists for realtime notifications
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_updates') THEN
    CREATE TABLE plan_updates (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
      update_type TEXT NOT NULL,
      triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_plan_updates_plan_id ON plan_updates(plan_id);
    CREATE INDEX idx_plan_updates_created_at ON plan_updates(created_at DESC);

    -- Enable RLS
    ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;

    -- Users can view updates for plans they're part of
    CREATE POLICY "Users can view updates for their plans"
    ON plan_updates FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM plan_participants
        WHERE plan_participants.plan_id = plan_updates.plan_id
          AND plan_participants.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================
-- Verification queries (for manual testing)
-- ============================================
-- Run these after migration to verify RLS is working:
--
-- 1. Test user profile visibility:
--    SELECT id, name, username, avatar_url FROM users LIMIT 5;
--    (Should return multiple users, not just your own)
--
-- 2. Test plan participants visibility:
--    SELECT * FROM plan_participants WHERE plan_id IN (
--      SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() LIMIT 1
--    );
--    (Should return all participants in your plans)
--
-- 3. Test friend requests:
--    SELECT * FROM friend_requests 
--    WHERE sender_id = auth.uid() OR receiver_id = auth.uid();
--    (Should return your friend requests)
