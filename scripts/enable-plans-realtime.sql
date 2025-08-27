-- Enable Supabase Realtime for plans tables
-- Run this in the target project's SQL Editor

-- 1) Ensure DELETE/UPDATE payloads include enough data for all plans tables
ALTER TABLE public.plans REPLICA IDENTITY FULL;
ALTER TABLE public.plan_participants REPLICA IDENTITY FULL;
ALTER TABLE public.plan_updates REPLICA IDENTITY FULL;
ALTER TABLE public.plan_polls REPLICA IDENTITY FULL;
ALTER TABLE public.plan_poll_options REPLICA IDENTITY FULL;
ALTER TABLE public.plan_poll_votes REPLICA IDENTITY FULL;
ALTER TABLE public.plan_attendance REPLICA IDENTITY FULL;

-- 2) Add tables to supabase_realtime publication (idempotent)
DO $$
BEGIN
  -- Add plans table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plans')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
  END IF;

  -- Add plan_participants table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plan_participants')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_participants;
  END IF;

  -- Add plan_updates table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plan_updates')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_updates;
  END IF;

  -- Add plan_polls table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plan_polls')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_polls;
  END IF;

  -- Add plan_poll_options table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plan_poll_options')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_poll_options;
  END IF;

  -- Add plan_poll_votes table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plan_poll_votes')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_poll_votes;
  END IF;

  -- Add plan_attendance table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plan_attendance')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_attendance;
  END IF;
END $$;

-- 3) Verification query (should return 7 rows after running)
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('plans', 'plan_participants', 'plan_updates', 'plan_polls', 'plan_poll_options', 'plan_poll_votes', 'plan_attendance')
ORDER BY tablename;

-- Done</contents>
</xai:function_call_explanation>Creating a script to enable realtime for all plans-related tables in Supabase
