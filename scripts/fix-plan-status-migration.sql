-- Migration to fix plan participant status from 'accepted' to 'going'
-- This fixes the issue where normal plans don't appear in the Plans tab

-- Fix existing databases that might have 'accepted' constraint instead of 'going'
-- Drop the existing check constraint if it exists
ALTER TABLE plan_participants DROP CONSTRAINT IF EXISTS plan_participants_status_check;

-- Add the correct check constraint
ALTER TABLE plan_participants ADD CONSTRAINT plan_participants_status_check
CHECK (status IN ('pending', 'going', 'maybe', 'declined', 'conditional'));

-- Update any existing 'accepted' statuses to 'going'
UPDATE plan_participants SET status = 'going' WHERE status = 'accepted';

-- Add helpful comment
-- This migration fixes the status column to use 'going' instead of 'accepted'
-- as specified in the PLANS_FUNCTIONAL_SPEC.md
-- This ensures normal plan creators appear in the Plans tab immediately
