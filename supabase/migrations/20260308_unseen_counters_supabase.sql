-- ============================================
-- Unseen Counters Supabase Migration
-- 2026-03-08
-- ============================================
-- Enables all unseen/unread counters to be computed
-- directly client ↔ Supabase without hitting the backend.

-- ============================================
-- 1. plan_participants: invitation_seen_at
-- ============================================
-- Tracks when the current user first "opened" / "saw" a pending invitation.
-- NULL  = not yet seen (show red dot on Plans tab / Invitations tab)
-- NOT NULL = already seen (no dot)

ALTER TABLE plan_participants
  ADD COLUMN IF NOT EXISTS invitation_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_plan_participants_invitation_seen
  ON plan_participants(user_id, invitation_seen_at)
  WHERE invitation_seen_at IS NULL;

-- Allow participants to update their own row's invitation_seen_at
-- (existing "Users can manage their participation" policy already covers
--  UPDATE using auth.uid() = user_id, so no new policy needed)

-- ============================================
-- 2. user_status: friends_list_seen_at
-- ============================================
-- Tracks when the user last opened the Hang tab.
-- "New friend" = friend_requests accepted AFTER this timestamp.

ALTER TABLE user_status
  ADD COLUMN IF NOT EXISTS friends_list_seen_at TIMESTAMPTZ;

-- ============================================
-- 3. plan_update_read_receipts: ensure RLS allows direct client access
-- ============================================
-- The backend currently writes these; we want the client to do it too.

ALTER TABLE plan_update_read_receipts ENABLE ROW LEVEL SECURITY;

-- Drop any leftover service-only policy so the client can write directly.
DROP POLICY IF EXISTS "Service role can manage all plan update receipts" ON plan_update_read_receipts;

-- Re-create a policy that lets authenticated users manage their own receipts.
DROP POLICY IF EXISTS "Users can manage their plan update receipts" ON plan_update_read_receipts;
CREATE POLICY "Users can manage their plan update receipts"
ON plan_update_read_receipts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Read access: user can see their own receipts
DROP POLICY IF EXISTS "Users can view their plan update receipts" ON plan_update_read_receipts;
CREATE POLICY "Users can view their plan update receipts"
ON plan_update_read_receipts
FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- 4. Ensure plan_updates is readable by plan participants (client-side count)
-- ============================================
-- Drop any overly-restrictive existing policy and replace.
DROP POLICY IF EXISTS "Service role can manage all plan updates" ON plan_updates;

DROP POLICY IF EXISTS "Users can view updates for their plans" ON plan_updates;
CREATE POLICY "Users can view updates for their plans"
ON plan_updates
FOR SELECT
USING (
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
    UNION
    SELECT id FROM plans WHERE creator_id = auth.uid()
  )
);

-- Allow service role full access (for backend triggers)
CREATE POLICY "Service role can manage all plan updates"
ON plan_updates
FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 5. Enable realtime for new columns if not already enabled
-- ============================================
-- plan_participants already has REPLICA IDENTITY FULL from previous migrations;
-- user_status replica identity was not explicitly set before – set it now.
ALTER TABLE user_status REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_status;
  END IF;
END $$;

-- ============================================
-- Done
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ unseen_counters migration applied';
  RAISE NOTICE '  + plan_participants.invitation_seen_at';
  RAISE NOTICE '  + user_status.friends_list_seen_at';
  RAISE NOTICE '  + plan_update_read_receipts client RLS';
  RAISE NOTICE '  + plan_updates client SELECT RLS';
END $$;
