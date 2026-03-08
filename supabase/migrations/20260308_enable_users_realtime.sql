-- Enable full row payload for users table realtime (status, current_activity updates)
-- Without REPLICA IDENTITY FULL, UPDATE events may not broadcast complete data
ALTER TABLE public.users REPLICA IDENTITY FULL;
