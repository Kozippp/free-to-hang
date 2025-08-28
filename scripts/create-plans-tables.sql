-- Plans Backend Database Schema - UNIFIED VERSION
-- This script creates all necessary tables for the plans system
-- Fixes inconsistencies and adds missing functionality

-- 1. Create plan_polls table
CREATE TABLE IF NOT EXISTS plan_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  poll_type TEXT CHECK (poll_type IN ('when', 'where', 'custom', 'invitation')) NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  invited_users TEXT[],
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create plan_poll_options table (FIXED: was poll_options in some files)
CREATE TABLE IF NOT EXISTS plan_poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  option_order INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE, -- For When/Where poll top-2 locking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create plan_poll_votes table
CREATE TABLE IF NOT EXISTS plan_poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES plan_poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, option_id, user_id)
);

-- 4. Create plan_attendance table
CREATE TABLE IF NOT EXISTS plan_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  attended BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, user_id)
);

-- 5. Create plan_updates table
CREATE TABLE IF NOT EXISTS plan_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  update_type TEXT CHECK (update_type IN ('poll_created', 'poll_voted', 'poll_won', 'participant_joined', 'participant_left', 'plan_completed', 'new_message', 'participant_accepted_conditionally', 'invitation_poll_completed', 'conditional_status_changed')) NOT NULL,
  triggered_by UUID REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_polls_plan_id ON plan_polls(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_polls_expires_at ON plan_polls(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_poll_options_poll_id ON plan_poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_poll_id ON plan_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_user_id ON plan_poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_attendance_plan_id ON plan_attendance(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_updates_plan_id ON plan_updates(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_updates_created_at ON plan_updates(created_at);

-- 7. Enable RLS on all new tables
ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies
-- Service role policies for backend operations
DROP POLICY IF EXISTS "Service role can manage all plan data" ON plan_polls;
CREATE POLICY "Service role can manage all plan data" ON plan_polls FOR ALL USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can manage all poll options" ON plan_poll_options;
CREATE POLICY "Service role can manage all poll options" ON plan_poll_options FOR ALL USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can manage all poll votes" ON plan_poll_votes;
CREATE POLICY "Service role can manage all poll votes" ON plan_poll_votes FOR ALL USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can manage all attendance" ON plan_attendance;
CREATE POLICY "Service role can manage all attendance" ON plan_attendance FOR ALL USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can manage all plan updates" ON plan_updates;
CREATE POLICY "Service role can manage all plan updates" ON plan_updates FOR ALL USING (auth.uid() IS NULL);

-- 9. User-level RLS policies
-- Plan polls: Users can view polls for plans they're involved in
DROP POLICY IF EXISTS "Users can view polls for their plans" ON plan_polls;
CREATE POLICY "Users can view polls for their plans" ON plan_polls FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE
    creator_id = auth.uid() OR
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);

-- Plan polls: Participants can create polls
DROP POLICY IF EXISTS "Plan participants can create polls" ON plan_polls;
CREATE POLICY "Plan participants can create polls" ON plan_polls FOR INSERT WITH CHECK (
  plan_id IN (
    SELECT id FROM plans WHERE
    creator_id = auth.uid() OR
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() AND status = 'going')
  ) AND created_by = auth.uid()
);

-- Plan polls: Poll creators can update their polls
DROP POLICY IF EXISTS "Poll creators can update their polls" ON plan_polls;
CREATE POLICY "Poll creators can update their polls" ON plan_polls FOR UPDATE USING (
  created_by = auth.uid()
);

-- Poll options: Users can view options for polls they can see
DROP POLICY IF EXISTS "Users can view poll options" ON plan_poll_options;
CREATE POLICY "Users can view poll options" ON plan_poll_options FOR SELECT USING (
  poll_id IN (
    SELECT id FROM plan_polls WHERE plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  )
);

-- Poll options: Poll creators can manage options
DROP POLICY IF EXISTS "Users can manage poll options" ON plan_poll_options;
CREATE POLICY "Users can manage poll options" ON plan_poll_options FOR ALL USING (
  poll_id IN (
    SELECT id FROM plan_polls WHERE created_by = auth.uid()
  )
);

-- Poll votes: Users can view votes for polls they can see
DROP POLICY IF EXISTS "Users can view poll votes" ON plan_poll_votes;
CREATE POLICY "Users can view poll votes" ON plan_poll_votes FOR SELECT USING (
  poll_id IN (
    SELECT id FROM plan_polls WHERE plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  )
);

-- Poll votes: Users can manage their own votes
DROP POLICY IF EXISTS "Users can manage their own votes" ON plan_poll_votes;
CREATE POLICY "Users can manage their own votes" ON plan_poll_votes FOR ALL USING (
  user_id = auth.uid()
);

-- Plan attendance: Users can view attendance for plans they're involved in
DROP POLICY IF EXISTS "Users can view plan attendance" ON plan_attendance;
CREATE POLICY "Users can view plan attendance" ON plan_attendance FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE
    creator_id = auth.uid() OR
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);

-- Plan attendance: Users can manage their attendance
DROP POLICY IF EXISTS "Users can manage their attendance" ON plan_attendance;
CREATE POLICY "Users can manage their attendance" ON plan_attendance FOR ALL USING (
  user_id = auth.uid()
);

-- Plan updates: Users can view updates for plans they're involved in
DROP POLICY IF EXISTS "Users can view plan updates" ON plan_updates;
CREATE POLICY "Users can view plan updates" ON plan_updates FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE
    creator_id = auth.uid() OR
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);

-- 10. Database functions for business logic

-- Function to automatically complete plans after 24 hours
CREATE OR REPLACE FUNCTION auto_complete_plans()
RETURNS VOID AS $$
BEGIN
  UPDATE plans
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'active'
    AND created_at <= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process invitation poll results
CREATE OR REPLACE FUNCTION process_invitation_poll(poll_id_param UUID)
RETURNS VOID AS $$
DECLARE
  poll_record RECORD;
  majority_threshold INTEGER;
  yes_votes INTEGER;
  total_votes INTEGER;
  plan_id_var UUID;
BEGIN
  -- Get poll details
  SELECT pp.*, pp.plan_id INTO poll_record
  FROM plan_polls pp
  WHERE pp.id = poll_id_param AND pp.poll_type = 'invitation';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  plan_id_var := poll_record.plan_id;

  -- Count votes
  SELECT
    COUNT(*) FILTER (WHERE ppo.option_text = 'Yes') as yes_count,
    COUNT(*) as total_count
  INTO yes_votes, total_votes
  FROM plan_poll_votes ppv
  JOIN plan_poll_options ppo ON ppv.option_id = ppo.id
  WHERE ppv.poll_id = poll_id_param;

  -- Calculate majority (more than 50%)
  IF total_votes > 0 AND (yes_votes::numeric / total_votes) > 0.5 THEN
    -- Add invited users to plan as pending participants
    FOR i IN 1..array_length(poll_record.invited_users, 1) LOOP
      INSERT INTO plan_participants (plan_id, user_id, status, created_at)
      VALUES (plan_id_var, poll_record.invited_users[i]::uuid, 'pending', NOW())
      ON CONFLICT (plan_id, user_id) DO NOTHING;
    END LOOP;

    -- Notify plan update
    INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
    VALUES (plan_id_var, 'invitation_poll_completed', null, jsonb_build_object('poll_id', poll_id_param, 'added_users', poll_record.invited_users));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process conditional dependencies
CREATE OR REPLACE FUNCTION process_conditional_dependencies(plan_id_param UUID)
RETURNS VOID AS $$
DECLARE
  participant_record RECORD;
  conditional_friends TEXT[];
  all_friends_accepted BOOLEAN;
BEGIN
  -- Get all participants with conditional status (stored as 'maybe' with conditional data)
  FOR participant_record IN
    SELECT pp.*, pu.metadata
    FROM plan_participants pp
    LEFT JOIN plan_updates pu ON pu.plan_id = pp.plan_id
      AND pu.triggered_by = pp.user_id
      AND pu.update_type = 'participant_joined'
      AND pu.metadata->>'is_conditional' = 'true'
    WHERE pp.plan_id = plan_id_param
      AND pp.status = 'maybe'
      AND pu.metadata IS NOT NULL
  LOOP
    -- Get conditional friends list
    conditional_friends := ARRAY(SELECT jsonb_array_elements_text(participant_record.metadata->'conditional_friends'));

    IF array_length(conditional_friends, 1) > 0 THEN
      -- Check if all conditional friends are accepted
      SELECT bool_and(pp2.status = 'going') INTO all_friends_accepted
      FROM plan_participants pp2
      WHERE pp2.plan_id = plan_id_param
        AND pp2.user_id = ANY(conditional_friends);

      -- If all friends accepted, change status to going
      IF all_friends_accepted THEN
        UPDATE plan_participants
        SET status = 'going', updated_at = NOW()
        WHERE plan_id = plan_id_param AND user_id = participant_record.user_id;

        -- Create status change notification
        INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
        VALUES (plan_id_param, 'conditional_status_changed', participant_record.user_id,
                jsonb_build_object('new_status', 'going', 'conditional_friends', conditional_friends));

        -- Remove conditional data
        DELETE FROM plan_updates
        WHERE plan_id = plan_id_param
          AND triggered_by = participant_record.user_id
          AND update_type = 'participant_joined'
          AND metadata->>'is_conditional' = 'true';
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get poll results with winner determination
CREATE OR REPLACE FUNCTION get_poll_results(poll_id_param UUID)
RETURNS JSONB AS $$
DECLARE
  poll_data RECORD;
  option_data RECORD;
  total_voters INTEGER;
  going_participants INTEGER;
  winner_threshold INTEGER;
  max_votes INTEGER;
  results JSONB := '{"options": [], "winner": null, "total_votes": 0, "total_voters": 0}';
  options_array JSONB := '[]';
BEGIN
  -- Get poll info
  SELECT pp.*, p.id as plan_id INTO poll_data
  FROM plan_polls pp
  JOIN plans p ON pp.plan_id = p.id
  WHERE pp.id = poll_id_param;

  IF NOT FOUND THEN
    RETURN results;
  END IF;

  -- Count total unique voters
  SELECT COUNT(DISTINCT user_id) INTO total_voters
  FROM plan_poll_votes
  WHERE poll_id = poll_id_param;

  -- Count going participants for threshold calculation
  SELECT COUNT(*) INTO going_participants
  FROM plan_participants
  WHERE plan_id = poll_data.plan_id AND status = 'going';

  -- Calculate winner threshold (40% of going participants, 70% of voters)
  winner_threshold := GREATEST(
    CEIL(0.4 * going_participants),
    CEIL(0.7 * total_voters),
    LEAST(3, going_participants)
  );

  -- Get max votes
  SELECT COALESCE(MAX(vote_count), 0) INTO max_votes
  FROM (
    SELECT COUNT(*) as vote_count
    FROM plan_poll_votes pv
    WHERE pv.poll_id = poll_id_param
    GROUP BY option_id
  ) vote_counts;

  -- Build options array with vote counts
  FOR option_data IN
    SELECT
      ppo.id,
      ppo.option_text,
      COALESCE(vote_counts.vote_count, 0) as votes,
      COALESCE(vote_counts.vote_count, 0) >= winner_threshold AND
      COALESCE(vote_counts.vote_count, 0) = max_votes as is_winner
    FROM plan_poll_options ppo
    LEFT JOIN (
      SELECT option_id, COUNT(*) as vote_count
      FROM plan_poll_votes
      WHERE poll_id = poll_id_param
      GROUP BY option_id
    ) vote_counts ON ppo.id = vote_counts.option_id
    WHERE ppo.poll_id = poll_id_param
    ORDER BY COALESCE(vote_counts.vote_count, 0) DESC, ppo.created_at ASC
  LOOP
    options_array := options_array || jsonb_build_object(
      'id', option_data.id,
      'text', option_data.option_text,
      'votes', option_data.votes,
      'percentage', CASE WHEN total_voters > 0 THEN ROUND((option_data.votes::numeric / total_voters) * 100) ELSE 0 END,
      'is_winner', option_data.is_winner
    );

    -- Set winner if this option qualifies
    IF option_data.is_winner THEN
      results := jsonb_set(results, '{winner}', jsonb_build_object(
        'id', option_data.id,
        'text', option_data.option_text,
        'votes', option_data.votes
      ));
    END IF;
  END LOOP;

  -- Update results
  results := jsonb_set(results, '{options}', options_array);
  results := jsonb_set(results, '{total_votes}', to_jsonb(total_voters));
  results := jsonb_set(results, '{total_voters}', to_jsonb(total_voters));
  results := jsonb_set(results, '{winner_threshold}', to_jsonb(winner_threshold));

  RETURN results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_plan_polls_updated_at BEFORE UPDATE ON plan_polls
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_plan_attendance_updated_at BEFORE UPDATE ON plan_attendance
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 10. Fix plan_participants table to use 'status' instead of 'response'
-- Add status column if it doesn't exist
ALTER TABLE plan_participants ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'going', 'maybe', 'declined', 'conditional')) DEFAULT 'pending';

-- Copy data from response to status if response exists
UPDATE plan_participants SET status = response WHERE response IS NOT NULL AND status = 'pending';

-- Fix existing databases that might have 'accepted' constraint instead of 'going'
-- Drop the existing check constraint if it exists
ALTER TABLE plan_participants DROP CONSTRAINT IF EXISTS plan_participants_status_check;

-- Add the correct check constraint
ALTER TABLE plan_participants ADD CONSTRAINT plan_participants_status_check
CHECK (status IN ('pending', 'going', 'maybe', 'declined', 'conditional'));

-- Update any existing 'accepted' statuses to 'going'
UPDATE plan_participants SET status = 'going' WHERE status = 'accepted';

-- Add helpful comment
-- This migration fixes the status column to use 'going' instead of 'accepted'
-- as specified in the PLANS_FUNCTIONAL_SPEC.md

-- Drop response column if it exists
ALTER TABLE plan_participants DROP COLUMN IF EXISTS response;

 