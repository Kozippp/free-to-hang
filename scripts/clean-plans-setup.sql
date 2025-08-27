-- CLEAN PLANS BACKEND SETUP - FRESH START
-- This script removes old plan tables and creates new ones from scratch

-- ===========================================
-- STEP 1: DELETE OLD PLAN TABLES
-- ===========================================

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS plan_poll_votes CASCADE;
DROP TABLE IF EXISTS plan_poll_options CASCADE;
DROP TABLE IF EXISTS plan_polls CASCADE;
DROP TABLE IF EXISTS plan_updates CASCADE;
DROP TABLE IF EXISTS plan_attendance CASCADE;
DROP TABLE IF EXISTS plan_participants CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS poll_votes CASCADE;
DROP TABLE IF EXISTS poll_options CASCADE;

-- ===========================================
-- STEP 2: CREATE NEW PLANS TABLES
-- ===========================================

-- Main plans table
CREATE TABLE plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  max_participants INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan participants table
CREATE TABLE plan_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'going', 'maybe', 'conditional', 'declined')) DEFAULT 'pending',
  conditional_friends UUID[], -- Array of user IDs for conditional status
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, user_id)
);

-- Plan polls table (When/Where/Custom/Invitation polls)
CREATE TABLE plan_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  poll_type TEXT CHECK (poll_type IN ('when', 'where', 'custom', 'invitation')) NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE, -- For invitation polls with timer
  invited_users UUID[], -- For invitation polls: users to potentially invite
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll options table
CREATE TABLE plan_poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  option_order INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE, -- For When/Where poll top-2 locking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll votes table
CREATE TABLE plan_poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES plan_poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, option_id, user_id)
);

-- Plan attendance tracking (for completed plans)
CREATE TABLE plan_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  attended BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, user_id)
);

-- Plan updates for realtime notifications
CREATE TABLE plan_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  update_type TEXT CHECK (update_type IN ('plan_created', 'participant_joined', 'participant_status_changed', 'poll_created', 'poll_voted', 'poll_completed', 'plan_completed', 'invitation_poll_completed', 'conditional_status_changed', 'new_message')) NOT NULL,
  triggered_by UUID REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX idx_plans_creator_id ON plans(creator_id);
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_created_at ON plans(created_at);

CREATE INDEX idx_plan_participants_plan_id ON plan_participants(plan_id);
CREATE INDEX idx_plan_participants_user_id ON plan_participants(user_id);
CREATE INDEX idx_plan_participants_status ON plan_participants(status);

CREATE INDEX idx_plan_polls_plan_id ON plan_polls(plan_id);
CREATE INDEX idx_plan_polls_ends_at ON plan_polls(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX idx_plan_polls_created_by ON plan_polls(created_by);

CREATE INDEX idx_plan_poll_options_poll_id ON plan_poll_options(poll_id);

CREATE INDEX idx_plan_poll_votes_poll_id ON plan_poll_votes(poll_id);
CREATE INDEX idx_plan_poll_votes_user_id ON plan_poll_votes(user_id);

CREATE INDEX idx_plan_attendance_plan_id ON plan_attendance(plan_id);
CREATE INDEX idx_plan_attendance_user_id ON plan_attendance(user_id);

CREATE INDEX idx_plan_updates_plan_id ON plan_updates(plan_id);
CREATE INDEX idx_plan_updates_created_at ON plan_updates(created_at);
CREATE INDEX idx_plan_updates_update_type ON plan_updates(update_type);

-- ===========================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- STEP 5: CREATE RLS POLICIES
-- ===========================================

-- Plans: Users can view plans they're involved in
DROP POLICY IF EXISTS "Users can view plans they're involved in" ON plans;
CREATE POLICY "Users can view plans they're involved in" ON plans FOR SELECT USING (
  creator_id = auth.uid() OR
  id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
);

-- Plans: Users can create plans
DROP POLICY IF EXISTS "Users can create plans" ON plans;
CREATE POLICY "Users can create plans" ON plans FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Plans: Plan creators can update their plans
DROP POLICY IF EXISTS "Plan creators can update their plans" ON plans;
CREATE POLICY "Plan creators can update their plans" ON plans FOR UPDATE USING (creator_id = auth.uid());

-- Plan participants: Users can view participants of plans they're involved in
DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;
CREATE POLICY "Users can view plan participants" ON plan_participants FOR SELECT USING (
  plan_id IN (SELECT id FROM plans WHERE creator_id = auth.uid()) OR
  user_id = auth.uid()
);

-- Plan participants: Users can manage their own participation
DROP POLICY IF EXISTS "Users can manage their participation" ON plan_participants;
CREATE POLICY "Users can manage their participation" ON plan_participants FOR ALL USING (user_id = auth.uid());

-- Plan polls: Users can view polls for plans they're involved in
DROP POLICY IF EXISTS "Users can view plan polls" ON plan_polls;
CREATE POLICY "Users can view plan polls" ON plan_polls FOR SELECT USING (
  plan_id IN (SELECT id FROM plans WHERE creator_id = auth.uid() OR id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()))
);

-- Plan polls: Participants can create polls
DROP POLICY IF EXISTS "Participants can create polls" ON plan_polls;
CREATE POLICY "Participants can create polls" ON plan_polls FOR INSERT WITH CHECK (
  plan_id IN (SELECT id FROM plans WHERE creator_id = auth.uid() OR id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() AND status = 'going')) AND
  created_by = auth.uid()
);

-- Plan polls: Poll creators can update their polls
DROP POLICY IF EXISTS "Poll creators can update polls" ON plan_polls;
CREATE POLICY "Poll creators can update polls" ON plan_polls FOR UPDATE USING (created_by = auth.uid());

-- Poll options: Users can view options for polls they can access
DROP POLICY IF EXISTS "Users can view poll options" ON plan_poll_options;
CREATE POLICY "Users can view poll options" ON plan_poll_options FOR SELECT USING (
  poll_id IN (SELECT id FROM plan_polls WHERE plan_id IN (SELECT id FROM plans WHERE creator_id = auth.uid() OR id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())))
);

-- Poll options: Poll creators can manage options
DROP POLICY IF EXISTS "Poll creators can manage options" ON plan_poll_options;
CREATE POLICY "Poll creators can manage options" ON plan_poll_options FOR ALL USING (
  poll_id IN (SELECT id FROM plan_polls WHERE created_by = auth.uid())
);

-- Poll votes: Users can view votes for polls they can access
DROP POLICY IF EXISTS "Users can view poll votes" ON plan_poll_votes;
CREATE POLICY "Users can view poll votes" ON plan_poll_votes FOR SELECT USING (
  poll_id IN (SELECT id FROM plan_polls WHERE plan_id IN (SELECT id FROM plans WHERE creator_id = auth.uid() OR id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())))
);

-- Poll votes: Users can manage their own votes
DROP POLICY IF EXISTS "Users can manage their votes" ON plan_poll_votes;
CREATE POLICY "Users can manage their votes" ON plan_poll_votes FOR ALL USING (user_id = auth.uid());

-- Plan attendance: Users can view attendance for plans they're involved in
DROP POLICY IF EXISTS "Users can view plan attendance" ON plan_attendance;
CREATE POLICY "Users can view plan attendance" ON plan_attendance FOR SELECT USING (
  plan_id IN (SELECT id FROM plans WHERE creator_id = auth.uid() OR id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()))
);

-- Plan attendance: Users can manage their attendance
DROP POLICY IF EXISTS "Users can manage their attendance" ON plan_attendance;
CREATE POLICY "Users can manage their attendance" ON plan_attendance FOR ALL USING (user_id = auth.uid());

-- Plan updates: Users can view updates for plans they're involved in
DROP POLICY IF EXISTS "Users can view plan updates" ON plan_updates;
CREATE POLICY "Users can view plan updates" ON plan_updates FOR SELECT USING (
  plan_id IN (SELECT id FROM plans WHERE creator_id = auth.uid() OR id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()))
);

-- Service role policies (for backend operations)
CREATE POLICY "Service role can manage all plans" ON plans FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all participants" ON plan_participants FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all polls" ON plan_polls FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all poll options" ON plan_poll_options FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all poll votes" ON plan_poll_votes FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all attendance" ON plan_attendance FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all plan updates" ON plan_updates FOR ALL USING (auth.uid() IS NULL);

-- ===========================================
-- STEP 6: CREATE DATABASE FUNCTIONS
-- ===========================================

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
  yes_votes INTEGER;
  total_votes INTEGER;
BEGIN
  -- Get poll details
  SELECT pp.*, pp.plan_id INTO poll_record
  FROM plan_polls pp
  WHERE pp.id = poll_id_param AND pp.poll_type = 'invitation';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Count votes
  SELECT
    COUNT(*) FILTER (WHERE ppo.option_text = 'Yes') as yes_count,
    COUNT(*) as total_count
  INTO yes_votes, total_votes
  FROM plan_poll_votes ppv
  JOIN plan_poll_options ppo ON ppv.option_id = ppo.id
  WHERE ppv.poll_id = poll_id_param;

  -- If majority voted yes, add invited users to plan
  IF total_votes > 0 AND (yes_votes::numeric / total_votes) > 0.5 THEN
    -- Add invited users to plan as pending participants
    FOR i IN 1..array_length(poll_record.invited_users, 1) LOOP
      INSERT INTO plan_participants (plan_id, user_id, status)
      VALUES (poll_record.plan_id, poll_record.invited_users[i], 'pending')
      ON CONFLICT (plan_id, user_id) DO NOTHING;
    END LOOP;

    -- Create plan update notification
    INSERT INTO plan_updates (plan_id, update_type, metadata)
    VALUES (poll_record.plan_id, 'invitation_poll_completed', jsonb_build_object('poll_id', poll_id_param, 'added_users', poll_record.invited_users));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process conditional dependencies
CREATE OR REPLACE FUNCTION process_conditional_dependencies(plan_id_param UUID)
RETURNS VOID AS $$
DECLARE
  participant_record RECORD;
  conditional_friends UUID[];
  all_friends_accepted BOOLEAN;
BEGIN
  -- Process participants with conditional status
  FOR participant_record IN
    SELECT * FROM plan_participants
    WHERE plan_id = plan_id_param AND status = 'conditional'
    AND conditional_friends IS NOT NULL AND array_length(conditional_friends, 1) > 0
  LOOP
    -- Check if all conditional friends are accepted
    SELECT bool_and(pp.status = 'going') INTO all_friends_accepted
    FROM plan_participants pp
    WHERE pp.plan_id = plan_id_param
      AND pp.user_id = ANY(participant_record.conditional_friends);

    -- If all friends accepted, change status to going
    IF all_friends_accepted THEN
      UPDATE plan_participants
      SET status = 'going', updated_at = NOW()
      WHERE plan_id = plan_id_param AND user_id = participant_record.user_id;

      -- Create status change notification
      INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
      VALUES (plan_id_param, 'conditional_status_changed', participant_record.user_id,
              jsonb_build_object('new_status', 'going', 'conditional_friends', participant_record.conditional_friends));

      -- Remove conditional data
      UPDATE plan_participants
      SET conditional_friends = NULL
      WHERE plan_id = plan_id_param AND user_id = participant_record.user_id;
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

-- ===========================================
-- STEP 7: CREATE TRIGGERS
-- ===========================================

-- Trigger to update updated_at timestamp for plans
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plan_participants_updated_at BEFORE UPDATE ON plan_participants
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plan_polls_updated_at BEFORE UPDATE ON plan_polls
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plan_attendance_updated_at BEFORE UPDATE ON plan_attendance
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ===========================================
-- SETUP COMPLETE!
-- ===========================================

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '=====================================';
    RAISE NOTICE 'PLANS BACKEND SETUP COMPLETE!';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '';
    RAISE NOTICE 'New tables created:';
    RAISE NOTICE '✅ plans';
    RAISE NOTICE '✅ plan_participants';
    RAISE NOTICE '✅ plan_polls';
    RAISE NOTICE '✅ plan_poll_options';
    RAISE NOTICE '✅ plan_poll_votes';
    RAISE NOTICE '✅ plan_attendance';
    RAISE NOTICE '✅ plan_updates';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '✅ auto_complete_plans()';
    RAISE NOTICE '✅ process_invitation_poll(UUID)';
    RAISE NOTICE '✅ process_conditional_dependencies(UUID)';
    RAISE NOTICE '✅ get_poll_results(UUID)';
    RAISE NOTICE '';
    RAISE NOTICE 'Old tables deleted:';
    RAISE NOTICE '🗑️  plan_attendance';
    RAISE NOTICE '🗑️  plan_participants (old)';
    RAISE NOTICE '🗑️  plan_polls (old)';
    RAISE NOTICE '🗑️  plan_updates (old)';
    RAISE NOTICE '🗑️  plans (old)';
    RAISE NOTICE '🗑️  poll_options';
    RAISE NOTICE '🗑️  poll_votes';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables preserved:';
    RAISE NOTICE '✅ users';
    RAISE NOTICE '✅ friends';
    RAISE NOTICE '✅ friend_requests';
    RAISE NOTICE '✅ user_status';
    RAISE NOTICE '✅ blocked_users';
    RAISE NOTICE '✅ username_reservations';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now test the plans backend!';
    RAISE NOTICE '=====================================';
END $$;
