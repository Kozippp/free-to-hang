-- Create invitation poll tables
-- This creates a completely separate system for invitation polls

-- Main invitation polls table
CREATE TABLE IF NOT EXISTS invitation_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'processed')),
  UNIQUE(plan_id, invited_user_id, status) -- Prevent duplicate active polls for same user
);

-- Invitation poll votes table
CREATE TABLE IF NOT EXISTS invitation_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES invitation_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('allow', 'deny')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, user_id) -- One vote per user per poll
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitation_polls_plan_id ON invitation_polls(plan_id);
CREATE INDEX IF NOT EXISTS idx_invitation_polls_invited_user_id ON invitation_polls(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_polls_status ON invitation_polls(status);
CREATE INDEX IF NOT EXISTS idx_invitation_polls_expires_at ON invitation_polls(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitation_poll_votes_poll_id ON invitation_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_invitation_poll_votes_user_id ON invitation_poll_votes(user_id);

-- Function to process expired invitation polls
CREATE OR REPLACE FUNCTION process_expired_invitation_polls()
RETURNS VOID AS $$
DECLARE
  poll_record RECORD;
  allow_votes INTEGER;
  deny_votes INTEGER;
  total_votes INTEGER;
  plan_id_var UUID;
  invited_user_id_var UUID;
BEGIN
  -- Process each expired poll
  FOR poll_record IN
    SELECT ip.id, ip.plan_id, ip.invited_user_id
    FROM invitation_polls ip
    WHERE ip.status = 'active'
      AND ip.expires_at <= NOW()
  LOOP
    -- Count votes
    SELECT
      COUNT(*) FILTER (WHERE ipv.vote = 'allow') as allow_count,
      COUNT(*) FILTER (WHERE ipv.vote = 'deny') as deny_count,
      COUNT(*) as total_count
    INTO allow_votes, deny_votes, total_votes
    FROM invitation_poll_votes ipv
    WHERE ipv.poll_id = poll_record.id;

    -- If majority votes allow (>50%), add user to plan
    IF total_votes > 0 AND (allow_votes::numeric / total_votes) > 0.5 THEN
      -- Add user to plan as pending participant (if not already there)
      INSERT INTO plan_participants (plan_id, user_id, status, created_at)
      VALUES (poll_record.plan_id, poll_record.invited_user_id, 'pending', NOW())
      ON CONFLICT (plan_id, user_id) DO NOTHING;

      -- Notify about new participant
      INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
      VALUES (poll_record.plan_id, 'participant_invited', poll_record.invited_user_id,
              jsonb_build_object('via_invitation_poll', true, 'poll_id', poll_record.id));
    END IF;

    -- Mark poll as processed
    UPDATE invitation_polls
    SET status = 'processed'
    WHERE id = poll_record.id;

    RAISE NOTICE 'Processed invitation poll % for plan %, user % - allow: %, deny: %, total: %',
                 poll_record.id, poll_record.plan_id, poll_record.invited_user_id,
                 allow_votes, deny_votes, total_votes;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for invitation_polls
ALTER TABLE invitation_polls ENABLE ROW LEVEL SECURITY;

-- Users can view invitation polls for plans they participate in
CREATE POLICY "Users can view invitation polls for their plans" ON invitation_polls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plan_participants pp
      WHERE pp.plan_id = invitation_polls.plan_id
        AND pp.user_id = auth.uid()
    )
  );

-- Users can create invitation polls for plans they are "going" to
CREATE POLICY "Going participants can create invitation polls" ON invitation_polls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_participants pp
      WHERE pp.plan_id = invitation_polls.plan_id
        AND pp.user_id = auth.uid()
        AND pp.status = 'going'
    )
  );

-- RLS Policies for invitation_poll_votes
ALTER TABLE invitation_poll_votes ENABLE ROW LEVEL SECURITY;

-- Users can view votes for polls in their plans
CREATE POLICY "Users can view votes for their plan polls" ON invitation_poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invitation_polls ip
      JOIN plan_participants pp ON pp.plan_id = ip.plan_id
      WHERE ip.id = invitation_poll_votes.poll_id
        AND pp.user_id = auth.uid()
    )
  );

-- Users can vote on polls for plans they are "going" to
CREATE POLICY "Going participants can vote on invitation polls" ON invitation_poll_votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invitation_polls ip
      JOIN plan_participants pp ON pp.plan_id = ip.plan_id
      WHERE ip.id = invitation_poll_votes.poll_id
        AND pp.user_id = auth.uid()
        AND pp.status = 'going'
    )
  );

-- Users can update their own votes
CREATE POLICY "Users can update their own votes" ON invitation_poll_votes
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE invitation_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE invitation_poll_votes;

-- Create a view for easier querying
CREATE OR REPLACE VIEW invitation_poll_details AS
SELECT
  ip.*,
  u.name as invited_user_name,
  u.username as invited_user_username,
  u.avatar_url as invited_user_avatar,
  creator.name as creator_name,
  creator.username as creator_username,
  creator.avatar_url as creator_avatar,
  p.title as plan_title,
  -- Vote counts
  COALESCE(stats.allow_votes, 0) as allow_votes,
  COALESCE(stats.deny_votes, 0) as deny_votes,
  COALESCE(stats.total_votes, 0) as total_votes,
  -- Current user vote
  CASE
    WHEN current_vote.vote IS NOT NULL THEN current_vote.vote
    ELSE NULL
  END as current_user_vote
FROM invitation_polls ip
JOIN users u ON u.id = ip.invited_user_id
JOIN users creator ON creator.id = ip.created_by
JOIN plans p ON p.id = ip.plan_id
LEFT JOIN (
  SELECT
    poll_id,
    COUNT(*) FILTER (WHERE vote = 'allow') as allow_votes,
    COUNT(*) FILTER (WHERE vote = 'deny') as deny_votes,
    COUNT(*) as total_votes
  FROM invitation_poll_votes
  GROUP BY poll_id
) stats ON stats.poll_id = ip.id
LEFT JOIN invitation_poll_votes current_vote ON current_vote.poll_id = ip.id AND current_vote.user_id = auth.uid();

-- Grant permissions
GRANT SELECT ON invitation_poll_details TO authenticated;
GRANT ALL ON invitation_polls TO authenticated;
GRANT ALL ON invitation_poll_votes TO authenticated;
