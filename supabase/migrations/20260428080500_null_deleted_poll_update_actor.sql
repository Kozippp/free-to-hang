-- Account deletion can cascade poll and vote deletes for a user while the
-- parent plan remains. In that path, realtime update rows should preserve the
-- event but not reference the user row being deleted.

CREATE OR REPLACE FUNCTION notify_poll_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := COALESCE(auth.uid(), OLD.created_by);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = actor_id) THEN
    actor_id := NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM plans WHERE id = OLD.plan_id) THEN
    INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
    VALUES (
      OLD.plan_id,
      'poll_deleted',
      actor_id,
      jsonb_build_object('poll_id', OLD.id)
    );
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION notify_poll_voted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_poll_id UUID := COALESCE(NEW.poll_id, OLD.poll_id);
  target_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
  target_plan_id UUID;
  actor_id UUID := COALESCE(auth.uid(), target_user_id);
BEGIN
  SELECT plan_id
  INTO target_plan_id
  FROM plan_polls
  WHERE id = target_poll_id;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = actor_id) THEN
    actor_id := NULL;
  END IF;

  IF target_plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM plans WHERE id = target_plan_id) THEN
    INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
    VALUES (
      target_plan_id,
      'poll_voted',
      actor_id,
      jsonb_build_object('poll_id', target_poll_id)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
