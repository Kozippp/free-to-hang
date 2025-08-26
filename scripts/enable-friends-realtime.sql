-- Enable Supabase Realtime for the friend_requests table (EBPW project)
-- Run this in the target project's SQL Editor

-- 1) Ensure DELETE/UPDATE payloads include enough data
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;

-- 2) Add table to supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'friend_requests')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  END IF;
END $$;

-- 3) Quick verification query (should return one row after run)
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests';

-- Done

