-- Allow authenticated users to view any onboarding-completed profile.
-- This is needed for user search / friend discovery via user_directory view.
-- The user_directory view has security_invoker=true, so it runs with the
-- querying user's RLS permissions. Without this policy, users could only
-- see their own profile and accepted friends in search results.
CREATE POLICY "Users can view completed profiles for search"
ON public.users
FOR SELECT
TO authenticated
USING (onboarding_completed = true);
