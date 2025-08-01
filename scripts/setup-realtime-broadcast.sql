-- Supabase Realtime Broadcast Setup for Polling System
-- This script sets up efficient real-time polling using Broadcast instead of Postgres Changes

-- 1. Enable Realtime Authorization for Broadcast
-- Create policy to allow authenticated users to receive broadcasts
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

-- 10. Create helper function to get plan participants for authorization
CREATE OR REPLACE FUNCTION public.get_plan_participants(plan_id_param UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT user_id 
  FROM plan_participants 
  WHERE plan_id = plan_id_param
  UNION
  SELECT creator_id 
  FROM plans 
  WHERE id = plan_id_param;
$$;

-- 11. Create RLS policies for realtime.messages to control access to broadcast topics
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

-- 12. Create indexes for better performance on broadcast queries
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id_user_id ON poll_votes(poll_id, user_id);
CREATE INDEX IF NOT EXISTS idx_plan_polls_plan_id_created_by ON plan_polls(plan_id, created_by);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_plan_updates_plan_id_created_at ON plan_updates(plan_id, created_at);

-- 13. Create function to clean up old broadcast messages (optional)
CREATE OR REPLACE FUNCTION public.cleanup_old_broadcast_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function can be called periodically to clean up old broadcast messages
  -- The realtime.messages table is automatically cleaned up by Supabase after 3 days
  -- This is just a placeholder for any custom cleanup logic
  NULL;
END;
$$;

-- 14. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_poll_vote_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_poll_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_poll_option_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_plan_update_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_participants(UUID) TO authenticated;

-- 15. Create a function to test the broadcast system
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

-- 16. Create a view for monitoring broadcast activity
CREATE OR REPLACE VIEW public.broadcast_activity AS
SELECT 
  topic,
  extension,
  created_at,
  COUNT(*) as message_count
FROM realtime.messages 
WHERE extension = 'broadcast'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY topic, extension, created_at
ORDER BY created_at DESC;

-- Grant view permissions
GRANT SELECT ON public.broadcast_activity TO authenticated;

-- 17. Create a function to get broadcast statistics
CREATE OR REPLACE FUNCTION public.get_broadcast_stats(plan_id_param UUID)
RETURNS TABLE(
  topic text,
  message_count bigint,
  last_message_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    topic,
    COUNT(*) as message_count,
    MAX(created_at) as last_message_at
  FROM realtime.messages 
  WHERE extension = 'broadcast'
    AND topic LIKE '%:' || plan_id_param::text
    AND created_at > NOW() - INTERVAL '24 hours'
  GROUP BY topic
  ORDER BY last_message_at DESC;
$$;

-- Grant stats function permission
GRANT EXECUTE ON FUNCTION public.get_broadcast_stats(UUID) TO authenticated;

-- 18. Create a function to manually trigger broadcasts (for testing/debugging)
CREATE OR REPLACE FUNCTION public.trigger_poll_broadcast(
  poll_id_param UUID,
  event_type text DEFAULT 'UPDATE'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  poll_record record;
BEGIN
  -- Get poll data
  SELECT * INTO poll_record FROM plan_polls WHERE id = poll_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll not found: %', poll_id_param;
  END IF;
  
  -- Manually trigger broadcast
  PERFORM realtime.broadcast_changes(
    'plan_polls:' || poll_record.plan_id::text,
    event_type,
    event_type,
    'plan_polls',
    'public',
    poll_record,
    NULL
  );
  
  RAISE NOTICE 'Manual broadcast triggered for poll %', poll_id_param;
END;
$$;

-- Grant manual trigger function permission
GRANT EXECUTE ON FUNCTION public.trigger_poll_broadcast(UUID, text) TO authenticated;

-- 19. Create a function to get active broadcast topics for a plan
CREATE OR REPLACE FUNCTION public.get_plan_broadcast_topics(plan_id_param UUID)
RETURNS TABLE(topic text, description text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    'plan_polls:' || plan_id_param::text as topic,
    'Poll changes for plan ' || plan_id_param::text as description
  UNION ALL
  SELECT 
    'plan_poll_votes:' || id::text as topic,
    'Poll vote changes for poll ' || id::text as description
  FROM plan_polls 
  WHERE plan_id = plan_id_param
  UNION ALL
  SELECT 
    'plan_poll_options:' || plan_id_param::text as topic,
    'Poll option changes for plan ' || plan_id_param::text as description
  UNION ALL
  SELECT 
    'plan_updates:' || plan_id_param::text as topic,
    'Plan update notifications for plan ' || plan_id_param::text as description;
$$;

-- Grant topics function permission
GRANT EXECUTE ON FUNCTION public.get_plan_broadcast_topics(UUID) TO authenticated;

-- 20. Create a function to validate broadcast setup
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

-- 21. Create a function to monitor broadcast performance
CREATE OR REPLACE FUNCTION public.get_broadcast_performance_stats()
RETURNS TABLE(
  metric text,
  value numeric,
  unit text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    'Total broadcast messages (24h)'::text as metric,
    COUNT(*)::numeric as value,
    'messages'::text as unit
  FROM realtime.messages 
  WHERE extension = 'broadcast'
    AND created_at > NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    'Unique broadcast topics (24h)'::text as metric,
    COUNT(DISTINCT topic)::numeric as value,
    'topics'::text as unit
  FROM realtime.messages 
  WHERE extension = 'broadcast'
    AND created_at > NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    'Average messages per topic (24h)'::text as metric,
    ROUND(AVG(msg_count), 2) as value,
    'messages/topic'::text as unit
  FROM (
    SELECT topic, COUNT(*) as msg_count
    FROM realtime.messages 
    WHERE extension = 'broadcast'
      AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY topic
  ) topic_counts;
$$;

-- Grant performance stats function permission
GRANT EXECUTE ON FUNCTION public.get_broadcast_performance_stats() TO authenticated;

-- 22. Create a function to clean up orphaned broadcast messages
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_broadcasts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  -- This function can be called to clean up broadcast messages for deleted plans/polls
  -- Note: Supabase automatically cleans up messages after 3 days
  -- This is just a placeholder for any custom cleanup logic
  
  RAISE NOTICE 'Broadcast cleanup completed. Supabase automatically cleans up messages after 3 days.';
  RETURN deleted_count;
END;
$$;

-- Grant cleanup function permission
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_broadcasts() TO authenticated;

-- 23. Create a function to get broadcast health status
CREATE OR REPLACE FUNCTION public.get_broadcast_health()
RETURNS TABLE(
  status text,
  message text,
  last_check timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if broadcast system is working
  IF EXISTS (
    SELECT 1 FROM realtime.messages 
    WHERE extension = 'broadcast' 
    AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN QUERY SELECT 
      'HEALTHY'::text as status,
      'Broadcast system is active and receiving messages'::text as message,
      NOW() as last_check;
  ELSE
    RETURN QUERY SELECT 
      'WARNING'::text as status,
      'No recent broadcast messages detected'::text as message,
      NOW() as last_check;
  END IF;
END;
$$;

-- Grant health function permission
GRANT EXECUTE ON FUNCTION public.get_broadcast_health() TO authenticated;

-- 24. Create a function to export broadcast configuration
CREATE OR REPLACE FUNCTION public.export_broadcast_config()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'triggers', (
      SELECT json_agg(tgname)
      FROM pg_trigger 
      WHERE tgname LIKE '%broadcast%' OR tgname LIKE '%poll%'
    ),
    'policies', (
      SELECT json_agg(policyname)
      FROM pg_policies 
      WHERE tablename = 'messages' AND schemaname = 'realtime'
    ),
    'functions', (
      SELECT json_agg(proname)
      FROM pg_proc 
      WHERE proname LIKE '%broadcast%' OR proname LIKE '%poll%'
    ),
    'setup_time', NOW()
  );
$$;

-- Grant export function permission
GRANT EXECUTE ON FUNCTION public.export_broadcast_config() TO authenticated;

-- 25. Final setup verification
DO $$
BEGIN
  RAISE NOTICE 'Broadcast system setup completed successfully!';
  RAISE NOTICE 'Run SELECT * FROM public.validate_broadcast_setup(); to verify installation.';
  RAISE NOTICE 'Run SELECT * FROM public.get_broadcast_health(); to check system health.';
END $$; 