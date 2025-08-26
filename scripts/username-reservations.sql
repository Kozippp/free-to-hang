-- Username reservation system (functions used by onboarding and profile edit)
-- Run this in the target Supabase project's SQL editor (EBPW for prod right now)

-- 1) Reservation table
CREATE TABLE IF NOT EXISTS public.username_reservations (
  username TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes')
);

-- Ensure RLS and policies so users can manage only their own reservations
ALTER TABLE public.username_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own reservations" ON public.username_reservations;
CREATE POLICY "select own reservations" ON public.username_reservations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "manage own reservations" ON public.username_reservations;
CREATE POLICY "manage own reservations" ON public.username_reservations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) Helper: clean up expired rows
CREATE OR REPLACE FUNCTION public._cleanup_expired_username_reservations()
RETURNS void AS $$
BEGIN
  DELETE FROM public.username_reservations WHERE expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Check availability (ignores own reservation logic; pure availability)
CREATE OR REPLACE FUNCTION public.is_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  taken BOOLEAN;
  reserved BOOLEAN;
BEGIN
  PERFORM public._cleanup_expired_username_reservations();

  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE lower(username) = lower(check_username)
  ) INTO taken;

  IF taken THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.username_reservations 
    WHERE lower(username) = lower(check_username)
      AND expires_at > now()
  ) INTO reserved;

  RETURN NOT reserved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4) Reserve username for a specific user
CREATE OR REPLACE FUNCTION public.reserve_username(reserve_username TEXT, reserve_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  reserved_by_other BOOLEAN;
BEGIN
  PERFORM public._cleanup_expired_username_reservations();

  -- Already taken in users table
  IF EXISTS(SELECT 1 FROM public.users WHERE lower(username) = lower(reserve_username)) THEN
    RETURN FALSE;
  END IF;

  -- Someone else holds a valid reservation
  SELECT EXISTS(
    SELECT 1 FROM public.username_reservations
    WHERE lower(username) = lower(reserve_username)
      AND user_id <> reserve_user_id
      AND expires_at > now()
  ) INTO reserved_by_other;

  IF reserved_by_other THEN
    RETURN FALSE;
  END IF;

  -- Upsert reservation for this user, extend validity window to 15 minutes
  INSERT INTO public.username_reservations (username, user_id, reserved_at, expires_at)
  VALUES (lower(reserve_username), reserve_user_id, now(), now() + interval '15 minutes')
  ON CONFLICT (username) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      reserved_at = now(),
      expires_at = now() + interval '15 minutes';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5) Validate that a given user still owns the reservation
CREATE OR REPLACE FUNCTION public.check_username_reservation(check_username TEXT, check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  valid BOOLEAN;
BEGIN
  PERFORM public._cleanup_expired_username_reservations();

  SELECT EXISTS(
    SELECT 1 FROM public.username_reservations
    WHERE lower(username) = lower(check_username)
      AND user_id = check_user_id
      AND expires_at > now()
  ) INTO valid;

  RETURN valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6) Optional: index for faster lookup (username is already PK, so this is implicit)
-- CREATE INDEX IF NOT EXISTS idx_username_reservations_username ON public.username_reservations (username);

-- Done
SELECT 'username reservation functions installed' AS status;


