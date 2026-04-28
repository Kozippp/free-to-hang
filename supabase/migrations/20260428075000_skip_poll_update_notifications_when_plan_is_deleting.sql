-- Avoid writing realtime poll updates while a parent plan is being removed.
-- Account deletion cascades user-owned plans; poll delete triggers must not
-- insert plan_updates rows for a plan that is part of the same deletion.

CREATE OR REPLACE FUNCTION notify_poll_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM plans WHERE id = OLD.plan_id) THEN
    INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
    VALUES (
      OLD.plan_id,
      'poll_deleted',
      COALESCE(auth.uid(), OLD.created_by),
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
BEGIN
  SELECT plan_id
  INTO target_plan_id
  FROM plan_polls
  WHERE id = target_poll_id;

  IF target_plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM plans WHERE id = target_plan_id) THEN
    INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
    VALUES (
      target_plan_id,
      'poll_voted',
      COALESCE(auth.uid(), target_user_id),
      jsonb_build_object('poll_id', target_poll_id)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
