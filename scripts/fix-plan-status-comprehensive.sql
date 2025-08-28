-- Comprehensive migration to fix plan participant status from 'accepted' to 'going'
-- This fixes the issue where normal plans don't appear in the Plans tab

-- Step 1: Check if the table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_participants') THEN
        RAISE NOTICE 'Table plan_participants does not exist. Please run the main schema setup first.';
        RETURN;
    END IF;
END $$;

-- Step 2: Check current table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'plan_participants' AND table_schema = 'public';

-- Step 3: Check current constraints
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'plan_participants' AND c.contype = 'c';

-- Step 4: Check current data
SELECT status, COUNT(*) as count
FROM plan_participants
GROUP BY status
ORDER BY status;

-- Step 5: Fix existing databases that might have 'accepted' constraint instead of 'going'
-- Drop the existing check constraint if it exists
ALTER TABLE plan_participants DROP CONSTRAINT IF EXISTS plan_participants_status_check;

-- Step 6: Add the correct check constraint
ALTER TABLE plan_participants ADD CONSTRAINT plan_participants_status_check
CHECK (status IN ('pending', 'going', 'maybe', 'declined', 'conditional'));

-- Step 7: Update any existing 'accepted' statuses to 'going'
UPDATE plan_participants SET status = 'going' WHERE status = 'accepted';

-- Step 8: Verify the changes
SELECT status, COUNT(*) as count
FROM plan_participants
GROUP BY status
ORDER BY status;

-- Add helpful comment
-- This migration fixes the status column to use 'going' instead of 'accepted'
-- as specified in the PLANS_FUNCTIONAL_SPEC.md
-- This ensures normal plan creators appear in the Plans tab immediately
