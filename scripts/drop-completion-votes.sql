-- Drop completion voting artifacts safely (idempotent)

-- Drop policies if exist
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view completion votes" ON plan_completion_votes';
  EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage their completion votes" ON plan_completion_votes';
  EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role can manage all completion votes" ON plan_completion_votes';
  EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop index if exists
DO $$ BEGIN
  EXECUTE 'DROP INDEX IF EXISTS idx_plan_completion_votes_plan_id';
  EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop table if exists
DROP TABLE IF EXISTS plan_completion_votes;

-- Update auto-complete function to 24h rule (if present)
CREATE OR REPLACE FUNCTION auto_complete_plans()
RETURNS VOID AS $$
BEGIN
  UPDATE plans 
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'active'
    AND created_at <= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


