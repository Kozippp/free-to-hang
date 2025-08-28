-- RLS Test Script for Free to Hang
-- This script tests that Row Level Security is working correctly

-- ====================================================================================
-- 1. SETUP TEST DATA
-- ====================================================================================

-- Create test users (these should already exist from auth.users)
-- In a real scenario, these would be created through the auth system

-- Insert test users if they don't exist
INSERT INTO users (id, email, name, username)
VALUES
  ('user-a-id', 'usera@example.com', 'User A', 'usera'),
  ('user-b-id', 'userb@example.com', 'User B', 'userb'),
  ('user-c-id', 'userc@example.com', 'User C', 'userc')
ON CONFLICT (id) DO NOTHING;

-- Create a test plan by User A
INSERT INTO plans (id, creator_id, title, description, location, date, is_anonymous, status)
VALUES (
  'test-plan-1',
  'user-a-id',
  'Test Plan 1',
  'This is a test plan',
  'Test Location',
  NOW() + INTERVAL '1 day',
  false,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Add User B as participant
INSERT INTO plan_participants (plan_id, user_id, status)
VALUES ('test-plan-1', 'user-b-id', 'accepted')
ON CONFLICT (plan_id, user_id) DO NOTHING;

-- Create a poll for the test plan
INSERT INTO plan_polls (id, plan_id, title, description, poll_type, created_by)
VALUES (
  'test-poll-1',
  'test-plan-1',
  'Test Poll',
  'What time should we meet?',
  'custom',
  'user-a-id'
) ON CONFLICT (id) DO NOTHING;

-- Add poll options
INSERT INTO plan_poll_options (poll_id, option_text, option_order)
VALUES
  ('test-poll-1', '2 PM', 1),
  ('test-poll-1', '4 PM', 2),
  ('test-poll-1', '6 PM', 3)
ON CONFLICT (poll_id, option_text) DO NOTHING;

-- Add some votes
INSERT INTO plan_poll_votes (poll_id, option_id, user_id)
SELECT
  'test-poll-1',
  id,
  'user-a-id'
FROM plan_poll_options
WHERE poll_id = 'test-poll-1' AND option_text = '2 PM'
ON CONFLICT (poll_id, option_id, user_id) DO NOTHING;

INSERT INTO plan_poll_votes (poll_id, option_id, user_id)
SELECT
  'test-poll-1',
  id,
  'user-b-id'
FROM plan_poll_options
WHERE poll_id = 'test-poll-1' AND option_text = '4 PM'
ON CONFLICT (poll_id, option_id, user_id) DO NOTHING;

-- Create friend requests between users
INSERT INTO friend_requests (sender_id, receiver_id, status)
VALUES ('user-a-id', 'user-c-id', 'pending')
ON CONFLICT (sender_id, receiver_id) DO NOTHING;

-- ====================================================================================
-- 2. TEST QUERIES (these should be run as different users)
-- ====================================================================================

-- IMPORTANT: These queries should be run with different auth.uid() values
-- In Supabase, you would set the auth context for each user

/*
-- =============================================================================
-- TEST AS USER A (plan creator)
-- =============================================================================

-- Should see the test plan
SELECT id, title, creator_id, status FROM plans WHERE auth.uid()::text = 'user-a-id';

-- Should see all participants of the plan
SELECT pp.user_id, pp.status, u.name
FROM plan_participants pp
JOIN users u ON pp.user_id = u.id
WHERE pp.plan_id = 'test-plan-1' AND auth.uid()::text = 'user-a-id';

-- Should see the poll
SELECT id, title, poll_type FROM plan_polls WHERE auth.uid()::text = 'user-a-id';

-- Should see poll options
SELECT option_text FROM plan_poll_options WHERE auth.uid()::text = 'user-a-id';

-- Should see all votes
SELECT pv.user_id, po.option_text
FROM plan_poll_votes pv
JOIN plan_poll_options po ON pv.option_id = po.id
WHERE auth.uid()::text = 'user-a-id';

-- Should see friend requests
SELECT sender_id, receiver_id, status FROM friend_requests WHERE auth.uid()::text = 'user-a-id';

-- =============================================================================
-- TEST AS USER B (plan participant)
-- =============================================================================

-- Should see the test plan
SELECT id, title, creator_id, status FROM plans WHERE auth.uid()::text = 'user-b-id';

-- Should see all participants of the plan
SELECT pp.user_id, pp.status, u.name
FROM plan_participants pp
JOIN users u ON pp.user_id = u.id
WHERE pp.plan_id = 'test-plan-1' AND auth.uid()::text = 'user-b-id';

-- Should see the poll
SELECT id, title, poll_type FROM plan_polls WHERE auth.uid()::text = 'user-b-id';

-- Should see poll options
SELECT option_text FROM plan_poll_options WHERE auth.uid()::text = 'user-b-id';

-- Should see all votes
SELECT pv.user_id, po.option_text
FROM plan_poll_votes pv
JOIN plan_poll_options po ON pv.option_id = po.id
WHERE auth.uid()::text = 'user-b-id';

-- =============================================================================
-- TEST AS USER C (not involved in plan)
-- =============================================================================

-- Should NOT see the test plan (empty result)
SELECT id, title FROM plans WHERE auth.uid()::text = 'user-c-id';

-- Should NOT see plan participants (empty result)
SELECT user_id, status FROM plan_participants WHERE auth.uid()::text = 'user-c-id';

-- Should NOT see the poll (empty result)
SELECT id, title FROM plan_polls WHERE auth.uid()::text = 'user-c-id';

-- Should NOT see poll options (empty result)
SELECT option_text FROM plan_poll_options WHERE auth.uid()::text = 'user-c-id';

-- Should NOT see poll votes (empty result)
SELECT user_id FROM plan_poll_votes WHERE auth.uid()::text = 'user-c-id';

-- Should see friend request from User A
SELECT sender_id, receiver_id, status FROM friend_requests WHERE auth.uid()::text = 'user-c-id';

-- =============================================================================
-- TEST USER PROFILE VISIBILITY
-- =============================================================================

-- User A should see User B's profile (connected through plan)
SELECT id, name, username FROM users WHERE auth.uid()::text = 'user-a-id' AND id = 'user-b-id';

-- User A should see User C's profile (connected through friend request)
SELECT id, name, username FROM users WHERE auth.uid()::text = 'user-a-id' AND id = 'user-c-id';

-- User B should see User A's profile (connected through plan)
SELECT id, name, username FROM users WHERE auth.uid()::text = 'user-b-id' AND id = 'user-a-id';

-- User C should see User A's profile (connected through friend request)
SELECT id, name, username FROM users WHERE auth.uid()::text = 'user-c-id' AND id = 'user-a-id';

-- User A should NOT see a completely unrelated user's profile
-- (This would return empty if there was such a user)
SELECT id, name FROM users WHERE auth.uid()::text = 'user-a-id' AND id = 'nonexistent-user';

*/

-- ====================================================================================
-- 3. CLEANUP TEST DATA (optional)
-- ====================================================================================

/*
-- Remove test data if needed
DELETE FROM plan_poll_votes WHERE poll_id = 'test-poll-1';
DELETE FROM plan_poll_options WHERE poll_id = 'test-poll-1';
DELETE FROM plan_polls WHERE id = 'test-poll-1';
DELETE FROM plan_participants WHERE plan_id = 'test-plan-1';
DELETE FROM plans WHERE id = 'test-plan-1';
DELETE FROM friend_requests WHERE sender_id = 'user-a-id' AND receiver_id = 'user-c-id';

-- Remove test users if they were created just for testing
DELETE FROM users WHERE id IN ('user-a-id', 'user-b-id', 'user-c-id');
*/

-- ====================================================================================
-- 4. RLS STATUS CHECK
-- ====================================================================================

-- Check which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'users', 'plans', 'plan_participants', 'friend_requests',
  'plan_polls', 'plan_poll_options', 'plan_poll_votes',
  'plan_updates', 'plan_attendance'
)
ORDER BY tablename;

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as condition,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
