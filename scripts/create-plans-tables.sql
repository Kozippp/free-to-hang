-- Plans Backend Database Schema
-- This script creates all necessary tables for the plans system

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

-- 2. Create plan_poll_options table
CREATE TABLE IF NOT EXISTS plan_poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  option_order INTEGER DEFAULT 0,
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

-- 6. Create plan_updates table
CREATE TABLE IF NOT EXISTS plan_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  update_type TEXT CHECK (update_type IN ('poll_created', 'poll_voted', 'poll_won', 'participant_joined', 'participant_left', 'plan_completed', 'new_message', 'participant_accepted_conditionally')) NOT NULL,
  triggered_by UUID REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_polls_plan_id ON plan_polls(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_polls_expires_at ON plan_polls(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_poll_options_poll_id ON plan_poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_poll_id ON plan_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_user_id ON plan_poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_attendance_plan_id ON plan_attendance(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_updates_plan_id ON plan_updates(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_updates_created_at ON plan_updates(created_at);

-- 8. Enable RLS on all new tables
ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies
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

-- 10. Fix plan_participants table to use 'status' instead of 'response'
-- Add status column if it doesn't exist
ALTER TABLE plan_participants ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'accepted', 'maybe', 'declined', 'conditional')) DEFAULT 'pending';

-- Copy data from response to status if response exists
UPDATE plan_participants SET status = response WHERE response IS NOT NULL AND status = 'pending';

-- Drop response column if it exists
ALTER TABLE plan_participants DROP COLUMN IF EXISTS response;

-- 11. Add triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_plan_polls_updated_at BEFORE UPDATE ON plan_polls 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_plan_attendance_updated_at BEFORE UPDATE ON plan_attendance 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column(); 