-- Update the SELECT RLS policy for plans table
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view plans they're involved in" ON public.plans;

-- Create new SELECT policy for authenticated users
CREATE POLICY "Creators and participants can view plans"
ON public.plans FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.plan_participants pp
    WHERE pp.plan_id = plans.id
      AND pp.user_id = auth.uid()
  )
);
