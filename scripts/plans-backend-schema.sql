-- Plans Backend Database Schema
-- Extends existing schema with polls and advanced plan features

-- Plan polls table
CREATE TABLE plan_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  poll_type TEXT CHECK (poll_type IN ('when', 'where', 'custom', 'invitation')) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  invited_users TEXT[], -- JSON array for invitation polls
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll options table
CREATE TABLE poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll votes table
CREATE TABLE poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, option_id, user_id) -- User can vote once per option per poll
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

-- Plan updates tracking (for real-time notifications)
CREATE TABLE plan_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  update_type TEXT CHECK (update_type IN ('poll_created', 'poll_voted', 'poll_won', 'participant_joined', 'participant_left', 'plan_completed', 'new_message')) NOT NULL,
  triggered_by UUID REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB, -- Additional data like poll_id, option_id, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_plan_polls_plan_id ON plan_polls(plan_id);
CREATE INDEX idx_plan_polls_expires_at ON plan_polls(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX idx_poll_votes_user_id ON poll_votes(user_id);
CREATE INDEX idx_plan_attendance_plan_id ON plan_attendance(plan_id);
CREATE INDEX idx_plan_updates_plan_id ON plan_updates(plan_id);
CREATE INDEX idx_plan_updates_created_at ON plan_updates(created_at);

-- RLS Policies for new tables

-- Plan polls
ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view polls for their plans" ON plan_polls FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE 
    creator_id = auth.uid() OR 
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Plan participants can create polls" ON plan_polls FOR INSERT WITH CHECK (
  plan_id IN (
    SELECT id FROM plans WHERE 
    creator_id = auth.uid() OR 
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() AND response = 'accepted')
  ) AND created_by = auth.uid()
);

CREATE POLICY "Poll creators can update their polls" ON plan_polls FOR UPDATE USING (
  created_by = auth.uid()
);

-- Poll options
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view poll options" ON poll_options FOR SELECT USING (
  poll_id IN (
    SELECT id FROM plan_polls WHERE plan_id IN (
      SELECT id FROM plans WHERE 
      creator_id = auth.uid() OR 
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can manage poll options" ON poll_options FOR ALL USING (
  poll_id IN (
    SELECT id FROM plan_polls WHERE created_by = auth.uid()
  )
);

-- Poll votes
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view poll votes" ON poll_votes FOR SELECT USING (
  poll_id IN (
    SELECT id FROM plan_polls WHERE plan_id IN (
      SELECT id FROM plans WHERE 
      creator_id = auth.uid() OR 
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can manage their own votes" ON poll_votes FOR ALL USING (
  user_id = auth.uid()
);

-- Plan attendance
ALTER TABLE plan_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view plan attendance" ON plan_attendance FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE 
    creator_id = auth.uid() OR 
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage their attendance" ON plan_attendance FOR ALL USING (
  user_id = auth.uid()
);

-- Plan updates
ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view plan updates" ON plan_updates FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE 
    creator_id = auth.uid() OR 
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);

-- Service role policies for backend operations
CREATE POLICY "Service role can manage all plan data" ON plan_polls FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all poll options" ON poll_options FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all poll votes" ON poll_votes FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all attendance" ON plan_attendance FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Service role can manage all plan updates" ON plan_updates FOR ALL USING (auth.uid() IS NULL);

-- Database functions for complex logic

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
  FROM poll_votes
  WHERE poll_id = poll_id_param;
  
  -- Count going participants for threshold calculation
  SELECT COUNT(*) INTO going_participants
  FROM plan_participants
  WHERE plan_id = poll_data.plan_id AND response = 'accepted';
  
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
    FROM poll_votes pv
    WHERE pv.poll_id = poll_id_param
    GROUP BY option_id
  ) vote_counts;
  
  -- Build options array with vote counts
  FOR option_data IN
    SELECT 
      po.id,
      po.option_text,
      COALESCE(vote_counts.vote_count, 0) as votes,
      COALESCE(vote_counts.vote_count, 0) >= winner_threshold AND 
      COALESCE(vote_counts.vote_count, 0) = max_votes AND
      total_voters >= LEAST(3, going_participants) as is_winner
    FROM poll_options po
    LEFT JOIN (
      SELECT option_id, COUNT(*) as vote_count
      FROM poll_votes
      WHERE poll_id = poll_id_param
      GROUP BY option_id
    ) vote_counts ON po.id = vote_counts.option_id
    WHERE po.poll_id = poll_id_param
    ORDER BY COALESCE(vote_counts.vote_count, 0) DESC, po.created_at ASC
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

-- Function to check if plan should be completed
-- Function to automatically complete plans after 24 hours from creation
CREATE OR REPLACE FUNCTION auto_complete_plans()
RETURNS VOID AS $$
BEGIN
  UPDATE plans 
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'active'
    AND created_at <= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at timestamps
CREATE TRIGGER update_plan_polls_updated_at BEFORE UPDATE ON plan_polls 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plan_attendance_updated_at BEFORE UPDATE ON plan_attendance 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column(); 