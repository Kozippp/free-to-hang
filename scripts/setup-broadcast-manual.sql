-- Supabase Realtime Broadcast Setup for Polling System
-- Käivita see skript Supabase SQL editoris

-- 1. Enable Realtime Authorization for Broadcast
CREATE POLICY IF NOT EXISTS "Authenticated users can receive broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (true);

-- 2. Create trigger function for poll vote changes
CREATE OR REPLACE FUNCTION public.handle_poll_vote_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast poll vote changes to all plan participants
  PERFORM realtime.broadcast_changes(
    'plan_poll_votes:' || COALESCE(NEW.poll_id, OLD.poll_id)::text, -- topic
    TG_OP,                                             -- event
    TG_OP,                                             -- operation
    TG_TABLE_NAME,                                     -- table
    TG_TABLE_SCHEMA,                                   -- schema
    NEW,                                               -- new record
    OLD                                                -- old record
  );
  
  RETURN NULL;
END;
$$;

-- 3. Create trigger for poll votes table
DROP TRIGGER IF EXISTS handle_poll_vote_changes_trigger ON poll_votes;
CREATE TRIGGER handle_poll_vote_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON poll_votes
FOR EACH ROW
EXECUTE FUNCTION handle_poll_vote_changes();

-- 4. Create trigger function for poll changes
CREATE OR REPLACE FUNCTION public.handle_poll_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast poll changes to all plan participants
  PERFORM realtime.broadcast_changes(
    'plan_polls:' || COALESCE(NEW.plan_id, OLD.plan_id)::text, -- topic
    TG_OP,                                             -- event
    TG_OP,                                             -- operation
    TG_TABLE_NAME,                                     -- table
    TG_TABLE_SCHEMA,                                   -- schema
    NEW,                                               -- new record
    OLD                                                -- old record
  );
  
  RETURN NULL;
END;
$$;

-- 5. Create trigger for polls table
DROP TRIGGER IF EXISTS handle_poll_changes_trigger ON plan_polls;
CREATE TRIGGER handle_poll_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON plan_polls
FOR EACH ROW
EXECUTE FUNCTION handle_poll_changes();

-- 6. Create trigger function for poll options changes
CREATE OR REPLACE FUNCTION public.handle_poll_option_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  poll_plan_id UUID;
BEGIN
  -- Get the plan_id for the poll
  SELECT plan_id INTO poll_plan_id 
  FROM plan_polls 
  WHERE id = COALESCE(NEW.poll_id, OLD.poll_id);
  
  -- Broadcast poll option changes to all plan participants
  PERFORM realtime.broadcast_changes(
    'plan_poll_options:' || poll_plan_id::text, -- topic
    TG_OP,                                             -- event
    TG_OP,                                             -- operation
    TG_TABLE_NAME,                                     -- table
    TG_TABLE_SCHEMA,                                   -- schema
    NEW,                                               -- new record
    OLD                                                -- old record
  );
  
  RETURN NULL;
END;
$$;

-- 7. Create trigger for poll options table
DROP TRIGGER IF EXISTS handle_poll_option_changes_trigger ON poll_options;
CREATE TRIGGER handle_poll_option_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON poll_options
FOR EACH ROW
EXECUTE FUNCTION handle_poll_option_changes();

-- 8. Create trigger function for plan updates
CREATE OR REPLACE FUNCTION public.handle_plan_update_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast plan update changes to all plan participants
  PERFORM realtime.broadcast_changes(
    'plan_updates:' || COALESCE(NEW.plan_id, OLD.plan_id)::text, -- topic
    TG_OP,                                             -- event
    TG_OP,                                             -- operation
    TG_TABLE_NAME,                                     -- table
    TG_TABLE_SCHEMA,                                   -- schema
    NEW,                                               -- new record
    OLD                                                -- old record
  );
  
  RETURN NULL;
END;
$$;

-- 9. Create trigger for plan updates table
DROP TRIGGER IF EXISTS handle_plan_update_changes_trigger ON plan_updates;
CREATE TRIGGER handle_plan_update_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON plan_updates
FOR EACH ROW
EXECUTE FUNCTION handle_plan_update_changes();

-- 10. Create RLS policies for realtime.messages to control access to broadcast topics
-- Policy for poll vote broadcasts
CREATE POLICY IF NOT EXISTS "Plan participants can receive poll vote broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast' AND
  topic LIKE 'plan_poll_votes:%' AND
  EXISTS (
    SELECT 1 FROM poll_votes pv
    JOIN plan_polls pp ON pv.poll_id = pp.id
    WHERE pp.plan_id::text = substring(topic from 'plan_poll_votes:(.+)')
    AND pv.user_id = auth.uid()
  )
);

-- Policy for poll broadcasts
CREATE POLICY IF NOT EXISTS "Plan participants can receive poll broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast' AND
  topic LIKE 'plan_polls:%' AND
  EXISTS (
    SELECT 1 FROM plan_participants pp
    WHERE pp.plan_id::text = substring(topic from 'plan_polls:(.+)')
    AND pp.user_id = auth.uid()
  )
);

-- Policy for poll option broadcasts
CREATE POLICY IF NOT EXISTS "Plan participants can receive poll option broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast' AND
  topic LIKE 'plan_poll_options:%' AND
  EXISTS (
    SELECT 1 FROM plan_participants pp
    WHERE pp.plan_id::text = substring(topic from 'plan_poll_options:(.+)')
    AND pp.user_id = auth.uid()
  )
);

-- Policy for plan update broadcasts
CREATE POLICY IF NOT EXISTS "Plan participants can receive plan update broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast' AND
  topic LIKE 'plan_updates:%' AND
  EXISTS (
    SELECT 1 FROM plan_participants pp
    WHERE pp.plan_id::text = substring(topic from 'plan_updates:(.+)')
    AND pp.user_id = auth.uid()
  )
);

-- 11. Create indexes for better performance on broadcast queries
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id_user_id ON poll_votes(poll_id, user_id);
CREATE INDEX IF NOT EXISTS idx_plan_polls_plan_id_created_by ON plan_polls(plan_id, created_by);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_plan_updates_plan_id_created_at ON plan_updates(plan_id, created_at);

-- 12. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_poll_vote_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_poll_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_poll_option_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_plan_update_changes() TO authenticated;

-- 13. Create a function to test the broadcast system
CREATE OR REPLACE FUNCTION public.test_broadcast_system(plan_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert a test plan update to trigger broadcast
  INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
  VALUES (plan_id_param, 'poll_voted', auth.uid(), '{"test": true}');
  
  RAISE NOTICE 'Test broadcast triggered for plan %', plan_id_param;
END;
$$;

-- Grant test function permission
GRANT EXECUTE ON FUNCTION public.test_broadcast_system(UUID) TO authenticated;

-- 14. Create a function to validate broadcast setup
CREATE OR REPLACE FUNCTION public.validate_broadcast_setup()
RETURNS TABLE(
  component text,
  status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if triggers exist
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_poll_vote_changes_trigger') THEN
    RETURN QUERY SELECT 'Poll Vote Trigger'::text, 'OK'::text, 'Trigger exists'::text;
  ELSE
    RETURN QUERY SELECT 'Poll Vote Trigger'::text, 'MISSING'::text, 'Trigger not found'::text;
  END IF;
  
  -- Check if policies exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'realtime' AND policyname = 'Authenticated users can receive broadcasts') THEN
    RETURN QUERY SELECT 'Broadcast Policy'::text, 'OK'::text, 'Policy exists'::text;
  ELSE
    RETURN QUERY SELECT 'Broadcast Policy'::text, 'MISSING'::text, 'Policy not found'::text;
  END IF;
  
  -- Check if functions exist
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_poll_vote_changes') THEN
    RETURN QUERY SELECT 'Poll Vote Function'::text, 'OK'::text, 'Function exists'::text;
  ELSE
    RETURN QUERY SELECT 'Poll Vote Function'::text, 'MISSING'::text, 'Function not found'::text;
  END IF;
  
  -- Check if realtime extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'realtime') THEN
    RETURN QUERY SELECT 'Realtime Extension'::text, 'OK'::text, 'Extension loaded'::text;
  ELSE
    RETURN QUERY SELECT 'Realtime Extension'::text, 'MISSING'::text, 'Extension not loaded'::text;
  END IF;
END;
$$;

-- Grant validation function permission
GRANT EXECUTE ON FUNCTION public.validate_broadcast_setup() TO authenticated;

-- 15. Final setup verification
DO $$
BEGIN
  RAISE NOTICE 'Broadcast system setup completed successfully!';
  RAISE NOTICE 'Run SELECT * FROM public.validate_broadcast_setup(); to verify installation.';
END $$; 