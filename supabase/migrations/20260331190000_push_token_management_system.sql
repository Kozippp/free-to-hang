-- Push Token Management System
-- Fixes:
-- 1. Prevents push token conflicts when switching accounts on same device
-- 2. Deactivates old tokens when user signs out
-- 3. Supports multiple active devices per user (all devices receive notifications)

-- Create function to register/reassign push token
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

  -- Register/reassign the token and mark as active
  -- If token exists for another user, reassign it to current user
  -- If token exists for same user, reactivate it
  -- DO NOT deactivate other tokens for this user (multi-device support)
  INSERT INTO public.push_tokens (user_id, expo_push_token, device_type, active, last_used_at)
  VALUES (uid, p_expo_push_token, p_device_type, true, now())
  ON CONFLICT (expo_push_token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    device_type = EXCLUDED.device_type,
    active = true,
    last_used_at = EXCLUDED.last_used_at,
    updated_at = now();
END;
$$;

-- Grant execute permission
REVOKE ALL ON FUNCTION public.register_expo_push_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_expo_push_token(text, text) TO authenticated;

COMMENT ON FUNCTION public.register_expo_push_token(text, text) IS
  'Registers or reassigns Expo push token for auth.uid(); supports multiple active devices per user.';

-- Create function to deactivate push token on sign out
CREATE OR REPLACE FUNCTION public.deactivate_push_token(
  p_expo_push_token text
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

  -- Deactivate the token for this user
  UPDATE public.push_tokens
  SET active = false,
      updated_at = now()
  WHERE user_id = uid
    AND expo_push_token = p_expo_push_token;
END;
$$;

-- Grant execute permission
REVOKE ALL ON FUNCTION public.deactivate_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_push_token(text) TO authenticated;

COMMENT ON FUNCTION public.deactivate_push_token(text) IS
  'Deactivates push token for auth.uid() on sign out; keeps token in database for reactivation.';

-- Create helper function to get active push tokens for a user
CREATE OR REPLACE FUNCTION public.get_active_push_tokens(p_user_id uuid)
RETURNS TABLE (
  expo_push_token text,
  device_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT expo_push_token, device_type
  FROM public.push_tokens
  WHERE user_id = p_user_id
    AND active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_push_tokens(uuid) TO service_role;

COMMENT ON FUNCTION public.get_active_push_tokens(uuid) IS
  'Returns only active push tokens for a user; used by notification system.';
