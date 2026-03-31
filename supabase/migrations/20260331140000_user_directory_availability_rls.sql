-- Public discovery without hang/presence/email; restrict full users row to self + accepted friends only.

CREATE OR REPLACE VIEW public.user_directory
WITH (security_invoker = false) AS
SELECT
  u.id,
  u.name,
  u.username,
  u.avatar_url,
  u.bio,
  u.vibe,
  u.onboarding_completed,
  u.created_at,
  u.updated_at
FROM public.users u;

COMMENT ON VIEW public.user_directory IS 'Discoverable profile fields only; excludes availability, activity timestamps, and email.';

GRANT SELECT ON public.user_directory TO authenticated;

-- Match device contact emails to users without exposing the users.email column via PostgREST.
CREATE OR REPLACE FUNCTION public.match_users_for_contact_discovery(
  contact_emails text[],
  exclude_user_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  avatar_url text,
  vibe text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name, u.username, u.avatar_url, u.vibe, u.bio
  FROM public.users u
  WHERE COALESCE(u.onboarding_completed, false) = true
    AND u.id <> exclude_user_id
    AND lower(btrim(u.email)) = ANY (
      SELECT lower(btrim(x))
      FROM unnest(contact_emails) AS x
      WHERE length(btrim(coalesce(x, ''))) > 0
    );
$$;

REVOKE ALL ON FUNCTION public.match_users_for_contact_discovery(text[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_users_for_contact_discovery(text[], uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can view connected users" ON public.users;

CREATE POLICY "Users can view accepted friends profiles"
ON public.users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND (
        (fr.sender_id = auth.uid() AND fr.receiver_id = users.id)
        OR (fr.receiver_id = auth.uid() AND fr.sender_id = users.id)
      )
  )
);

ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view friends' status" ON public.user_status;
DROP POLICY IF EXISTS "Users can view friends status" ON public.user_status;
DROP POLICY IF EXISTS "Users can update their own status" ON public.user_status;
DROP POLICY IF EXISTS "Users can manage their own status" ON public.user_status;
DROP POLICY IF EXISTS "Users can read own user_status" ON public.user_status;
DROP POLICY IF EXISTS "Users can update own user_status" ON public.user_status;
DROP POLICY IF EXISTS "Users can insert own user_status" ON public.user_status;

CREATE POLICY "Users can read own user_status"
ON public.user_status FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own user_status"
ON public.user_status FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_status"
ON public.user_status FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
