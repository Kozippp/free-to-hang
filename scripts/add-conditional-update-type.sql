-- Add participant_conditional to plan_updates.update_type constraint
-- This allows storing conditional participation metadata

-- First, drop the existing constraint
ALTER TABLE plan_updates DROP CONSTRAINT IF EXISTS plan_updates_update_type_check;

-- Add the new constraint with participant_conditional included
ALTER TABLE plan_updates ADD CONSTRAINT plan_updates_update_type_check 
CHECK (update_type IN (
  'poll_created', 
  'poll_voted', 
  'poll_won', 
  'participant_joined', 
  'participant_left', 
  'participant_conditional',
  'participant_accepted_conditionally',
  'plan_completed', 
  'new_message'
));

-- Also add some indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_updates_conditional 
ON plan_updates(plan_id, update_type) 
WHERE update_type = 'participant_conditional';

-- Comment explaining the new update types
COMMENT ON CONSTRAINT plan_updates_update_type_check ON plan_updates IS 
'Allowed update types including conditional participation tracking'; 