-- Fix infinite recursion in plan_participants RLS policy
-- The previous policy referenced plan_participants in its own USING clause, causing recursion.
-- Solution: Use a SECURITY DEFINER function in public schema that bypasses RLS.

-- 1. Create helper function (runs with owner rights, bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_accessible_plan_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  UNION
  SELECT id FROM plans WHERE creator_id = auth.uid();
$$;

-- 2. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_accessible_plan_ids() TO authenticated;

-- 3. Drop the problematic policy
DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;

-- 4. Create new policy using the helper function (no self-reference)
CREATE POLICY "Users can view plan participants"
ON plan_participants FOR SELECT
USING (plan_id IN (SELECT public.user_accessible_plan_ids()));
