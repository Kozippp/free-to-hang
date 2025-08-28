-- Simple step-by-step migration to fix plan participant status

-- Step 1: First, let's check what we have
SELECT 'Current status values:' as info;
SELECT status, COUNT(*) as count
FROM plan_participants
GROUP BY status
ORDER BY status;

-- Step 2: Remove the old constraint (if it exists)
ALTER TABLE plan_participants DROP CONSTRAINT IF EXISTS plan_participants_status_check;

-- Step 3: Add the correct constraint with 'going' instead of 'accepted'
ALTER TABLE plan_participants ADD CONSTRAINT plan_participants_status_check
CHECK (status IN ('pending', 'going', 'maybe', 'declined', 'conditional'));

-- Step 4: Update any existing 'accepted' statuses to 'going'
UPDATE plan_participants SET status = 'going' WHERE status = 'accepted';

-- Step 5: Verify the changes
SELECT 'Updated status values:' as info;
SELECT status, COUNT(*) as count
FROM plan_participants
GROUP BY status
ORDER BY status;

SELECT 'Migration completed successfully!' as result;
