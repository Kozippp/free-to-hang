-- OAuth (Apple / Google): only link verified identity + email in auth; profile (name, username,
-- vibe, avatar) comes from in-app onboarding like "Continue with Email".
-- Trigger inserts a placeholder row so signup succeeds and onboarding_completed stays false.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider text;
  v_email text;
  v_name text;
  v_username text;
  base_username text;
  username_counter integer := 0;
BEGIN
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', '');

  v_email := NULLIF(trim(COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '')), '');
  IF v_email IS NULL THEN
    v_email := lower(replace(NEW.id::text, '-', '')) || '@users.oauth.internal';
  END IF;

  IF provider IN ('apple', 'google') THEN
    v_name := 'Pending setup';
    v_username := 'tmp_' || replace(NEW.id::text, '-', '');
  ELSE
    base_username := NULLIF(trim(split_part(v_email, '@', 1)), '');
    IF base_username IS NULL OR base_username = '' THEN
      base_username := 'user';
    END IF;

    v_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      base_username,
      'User'
    );

    v_username := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''),
      base_username
    );

    WHILE EXISTS (SELECT 1 FROM public.users u WHERE u.username = v_username) LOOP
      username_counter := username_counter + 1;
      v_username := base_username || username_counter::text;
    END LOOP;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    name,
    username,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    v_email,
    v_name,
    v_username,
    FALSE
  );

  INSERT INTO public.user_status (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates public.users + user_status on auth signup. Apple/Google get placeholder profile; user completes onboarding in app.';
