-- Enable Supabase Realtime for friend_requests table
-- Required for friendsStore to receive INSERT/UPDATE/DELETE events

-- 1) Ensure DELETE/UPDATE payloads include full row data
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
