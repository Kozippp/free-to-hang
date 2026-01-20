-- Enable REPLICA IDENTITY FULL for plan_poll_votes table
-- This ensures DELETE events in realtime include all column values, not just the ID
-- Required for: Frontend → Direct Supabase DB → Realtime → Store pattern

ALTER TABLE plan_poll_votes REPLICA IDENTITY FULL;

-- Verify the change
SELECT relname, relreplident 
FROM pg_class 
WHERE relname = 'plan_poll_votes';

-- relreplident values:
-- 'd' = default (only primary key)
-- 'f' = full (all columns)
-- 'i' = index
-- 'n' = nothing
