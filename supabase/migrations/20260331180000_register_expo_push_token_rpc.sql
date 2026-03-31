-- Fix 23505 on push_tokens: UNIQUE(expo_push_token) + RLS blocks cross-user upsert from client.
-- Same device / new account must reassign the row; only SECURITY DEFINER can update any matching token row.

CREATE OR REPLACE FUNCTION public.register_expo_push_token(
  p_expo_push_token text,
  p_device_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_expo_push_token IS NULL OR length(trim(p_expo_push_token)) = 0 THEN
    RAISE EXCEPTION 'Invalid push token';
  END IF;

  IF p_device_type IS NULL OR p_device_type NOT IN ('ios', 'android', 'web') THEN
    RAISE EXCEPTION 'Invalid device_type';
  END IF;

  INSERT INTO public.push_tokens (user_id, expo_push_token, device_type, active, last_used_at)
  VALUES (uid, p_expo_push_token, p_device_type, true, now())
  ON CONFLICT (expo_push_token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    device_type = EXCLUDED.device_type,
    active = true,
    last_used_at = EXCLUDED.last_used_at;
END;
$$;

REVOKE ALL ON FUNCTION public.register_expo_push_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_expo_push_token(text, text) TO authenticated;

COMMENT ON FUNCTION public.register_expo_push_token(text, text) IS
  'Registers or reassigns Expo push token for auth.uid(); required when UNIQUE(expo_push_token) collides across account switches.';
