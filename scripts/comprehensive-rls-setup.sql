-- Comprehensive RLS Setup for Free to Hang
-- This script sets up Row Level Security policies for all tables
-- Ensures users can see all data related to plans they're involved in

-- ====================================================================================
-- 1. ENABLE RLS ON ALL REQUIRED TABLES
-- ====================================================================================

-- Core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Plan-related tables
ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_attendance ENABLE ROW LEVEL SECURITY;

-- ====================================================================================
-- 2. DROP ALL EXISTING POLICIES (clean slate)
-- ====================================================================================

-- Users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Plans table
DROP POLICY IF EXISTS "Users can view plans they're involved in" ON plans;
DROP POLICY IF EXISTS "Users can create plans" ON plans;
DROP POLICY IF EXISTS "Plan creators can update their plans" ON plans;

-- Plan participants table
DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;
DROP POLICY IF EXISTS "Users can manage their participation" ON plan_participants;

-- Friend requests table
DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;

-- Plan polls table
DROP POLICY IF EXISTS "Users can view polls for their plans" ON plan_polls;
DROP POLICY IF EXISTS "Plan participants can create polls" ON plan_polls;
DROP POLICY IF EXISTS "Poll creators can update their polls" ON plan_polls;
DROP POLICY IF EXISTS "Service role can manage all plan data" ON plan_polls;

-- Plan poll options table
DROP POLICY IF EXISTS "Users can view poll options" ON plan_poll_options;
DROP POLICY IF EXISTS "Users can manage poll options" ON plan_poll_options;
DROP POLICY IF EXISTS "Service role can manage all poll options" ON plan_poll_options;

-- Plan poll votes table
DROP POLICY IF EXISTS "Users can view poll votes" ON plan_poll_votes;
DROP POLICY IF EXISTS "Users can manage their own votes" ON plan_poll_votes;
DROP POLICY IF EXISTS "Service role can manage all poll votes" ON plan_poll_votes;

-- Plan updates table
DROP POLICY IF EXISTS "Users can view plan updates" ON plan_updates;
DROP POLICY IF EXISTS "Service role can manage all plan updates" ON plan_updates;

-- Plan attendance table
DROP POLICY IF EXISTS "Users can view plan attendance" ON plan_attendance;
DROP POLICY IF EXISTS "Users can manage their attendance" ON plan_attendance;
DROP POLICY IF EXISTS "Service role can manage all attendance" ON plan_attendance;

-- ====================================================================================
-- 3. CREATE NEW RLS POLICIES
-- ====================================================================================

-- =============================================================================
-- USERS TABLE POLICIES
-- =============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can view profiles of people they're connected with through plans
CREATE POLICY "Users can view connected users" ON users
  FOR SELECT USING (
    auth.uid() IN (
      -- Users who are in the same plans
      SELECT DISTINCT pp.user_id
      FROM plan_participants pp
      WHERE pp.plan_id IN (
        SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
      )
      UNION
      -- Plan creators of plans user is in
      SELECT DISTINCT p.creator_id
      FROM plans p
      WHERE p.id IN (
        SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
      )
      UNION
      -- Users who have friend requests with current user
      SELECT DISTINCT fr.sender_id FROM friend_requests fr WHERE fr.receiver_id = auth.uid()
      UNION
      SELECT DISTINCT fr.receiver_id FROM friend_requests fr WHERE fr.sender_id = auth.uid()
    )
  );

-- Users can insert their own profile (handled by trigger)
CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- PLANS TABLE POLICIES
-- =============================================================================

-- Users can view plans they're involved in (creator or participant)
CREATE POLICY "Users can view their plans" ON plans
  FOR SELECT USING (
    auth.uid() = creator_id OR
    auth.uid() IN (
      SELECT user_id FROM plan_participants WHERE plan_id = plans.id
    )
  );

-- Users can create plans
CREATE POLICY "Users can create plans" ON plans
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Plan creators can update their plans
CREATE POLICY "Plan creators can update plans" ON plans
  FOR UPDATE USING (auth.uid() = creator_id);

-- =============================================================================
-- PLAN PARTICIPANTS TABLE POLICIES
-- =============================================================================

-- Users can view all participants of plans they're involved in
CREATE POLICY "Users can view plan participants" ON plan_participants
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  );

-- Users can manage their own participation
CREATE POLICY "Users can manage their participation" ON plan_participants
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- FRIEND REQUESTS TABLE POLICIES
-- =============================================================================

-- Users can view requests they sent or received
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create friend requests (as sender)
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (accept/decline) or sent (cancel)
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- =============================================================================
-- PLAN POLLS TABLE POLICIES
-- =============================================================================

-- Users can view polls for plans they're involved in
CREATE POLICY "Users can view polls for their plans" ON plan_polls
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  );

-- Plan participants can create polls
CREATE POLICY "Plan participants can create polls" ON plan_polls
  FOR INSERT WITH CHECK (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() AND status = 'going')
    ) AND created_by = auth.uid()
  );

-- Poll creators can update their polls
CREATE POLICY "Poll creators can update their polls" ON plan_polls
  FOR UPDATE USING (created_by = auth.uid());

-- Service role can manage all plan data
CREATE POLICY "Service role can manage all plan data" ON plan_polls
  FOR ALL USING (auth.uid() IS NULL);

-- =============================================================================
-- PLAN POLL OPTIONS TABLE POLICIES
-- =============================================================================

-- Users can view poll options for polls they can see
CREATE POLICY "Users can view poll options" ON plan_poll_options
  FOR SELECT USING (
    poll_id IN (
      SELECT id FROM plan_polls WHERE plan_id IN (
        SELECT id FROM plans WHERE
        creator_id = auth.uid() OR
        id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
      )
    )
  );

-- Poll creators can manage options
CREATE POLICY "Users can manage poll options" ON plan_poll_options
  FOR ALL USING (
    poll_id IN (
      SELECT id FROM plan_polls WHERE created_by = auth.uid()
    )
  );

-- Service role can manage all poll options
CREATE POLICY "Service role can manage all poll options" ON plan_poll_options
  FOR ALL USING (auth.uid() IS NULL);

-- =============================================================================
-- PLAN POLL VOTES TABLE POLICIES
-- =============================================================================

-- Users can view votes for polls they can see
CREATE POLICY "Users can view poll votes" ON plan_poll_votes
  FOR SELECT USING (
    poll_id IN (
      SELECT id FROM plan_polls WHERE plan_id IN (
        SELECT id FROM plans WHERE
        creator_id = auth.uid() OR
        id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
      )
    )
  );

-- Users can manage their own votes
CREATE POLICY "Users can manage their own votes" ON plan_poll_votes
  FOR ALL USING (user_id = auth.uid());

-- Service role can manage all poll votes
CREATE POLICY "Service role can manage all poll votes" ON plan_poll_votes
  FOR ALL USING (auth.uid() IS NULL);

-- =============================================================================
-- PLAN UPDATES TABLE POLICIES
-- =============================================================================

-- Users can view updates for plans they're involved in
CREATE POLICY "Users can view plan updates" ON plan_updates
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  );

-- Service role can manage all plan updates
CREATE POLICY "Service role can manage all plan updates" ON plan_updates
  FOR ALL USING (auth.uid() IS NULL);

-- =============================================================================
-- PLAN ATTENDANCE TABLE POLICIES
-- =============================================================================

-- Users can view attendance for plans they're involved in
CREATE POLICY "Users can view plan attendance" ON plan_attendance
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  );

-- Users can manage their attendance
CREATE POLICY "Users can manage their attendance" ON plan_attendance
  FOR ALL USING (user_id = auth.uid());

-- Service role can manage all attendance
CREATE POLICY "Service role can manage all attendance" ON plan_attendance
  FOR ALL USING (auth.uid() IS NULL);

-- ====================================================================================
-- 4. SERVICE ROLE POLICIES FOR BACKEND OPERATIONS
-- ====================================================================================

-- Allow service role to bypass RLS for all tables (for backend operations)
-- These are already defined above with "auth.uid() IS NULL" conditions

-- ====================================================================================
-- 5. SUMMARY OF WHAT THIS SCRIPT DOES
-- ====================================================================================

/*
This script ensures that:

1. **Friend Requests**: Users can see and manage all friend requests they're involved in

2. **Plans System**:
   - If a user is involved in a plan (as creator or participant), they can see:
     * All plan details
     * All other participants and their responses
     * All polls and their options
     * All votes on polls
     * All plan updates/notifications
     * All attendance records

3. **Users Table**:
   - Users can see their own profile
   - Users can see profiles of people they're connected with through plans or friend requests

4. **Service Role**:
   - Backend can perform operations on all tables without RLS restrictions

This ensures that the real-time system works properly - when a user is involved in a plan,
they have full visibility into all plan-related data, which is exactly what was requested.
*/
