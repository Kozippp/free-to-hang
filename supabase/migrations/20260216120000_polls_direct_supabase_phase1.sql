-- Polls direct Supabase migration:
-- - Align RLS policies with direct DB access
-- - Add RPC function for poll payloads
-- - Add plan_updates triggers for poll lifecycle events

ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_poll_votes ENABLE ROW LEVEL SECURITY;

-- Refresh older policy variants first (safe/no-op if absent)
DROP POLICY IF EXISTS "Users can view polls for their plans" ON plan_polls;
DROP POLICY IF EXISTS "Plan participants can create polls" ON plan_polls;
DROP POLICY IF EXISTS "Poll creators can update their polls" ON plan_polls;
DROP POLICY IF EXISTS "Users can view poll options" ON plan_poll_options;
DROP POLICY IF EXISTS "Users can manage poll options" ON plan_poll_options;
DROP POLICY IF EXISTS "Users can view poll votes" ON plan_poll_votes;
DROP POLICY IF EXISTS "Users can manage their own votes" ON plan_poll_votes;

DROP POLICY IF EXISTS "Users can read polls from their plans" ON plan_polls;
DROP POLICY IF EXISTS "Going participants can create polls" ON plan_polls;
DROP POLICY IF EXISTS "Plan participants can update polls" ON plan_polls;
DROP POLICY IF EXISTS "Plan participants can delete polls" ON plan_polls;

DROP POLICY IF EXISTS "Users can read poll options from their plans" ON plan_poll_options;
DROP POLICY IF EXISTS "Plan participants can insert poll options" ON plan_poll_options;
DROP POLICY IF EXISTS "Plan participants can update poll options" ON plan_poll_options;
DROP POLICY IF EXISTS "Plan participants can delete poll options" ON plan_poll_options;
DROP POLICY IF EXISTS "Poll creators can manage poll options" ON plan_poll_options;

DROP POLICY IF EXISTS "Users can read votes from their plans" ON plan_poll_votes;
DROP POLICY IF EXISTS "Going participants can vote" ON plan_poll_votes;
DROP POLICY IF EXISTS "Going participants can insert votes" ON plan_poll_votes;
DROP POLICY IF EXISTS "Going participants can update votes" ON plan_poll_votes;
DROP POLICY IF EXISTS "Going participants can delete votes" ON plan_poll_votes;

CREATE POLICY "Users can read polls from their plans"
ON plan_polls
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM plan_participants
    WHERE plan_participants.plan_id = plan_polls.plan_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Going participants can create polls"
ON plan_polls
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_participants
    WHERE plan_participants.plan_id = plan_polls.plan_id
      AND plan_participants.user_id = auth.uid()
      AND plan_participants.status = 'going'
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Plan participants can update polls"
ON plan_polls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM plan_participants
    WHERE plan_participants.plan_id = plan_polls.plan_id
      AND plan_participants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_participants
    WHERE plan_participants.plan_id = plan_polls.plan_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Plan participants can delete polls"
ON plan_polls
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM plan_participants
    WHERE plan_participants.plan_id = plan_polls.plan_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can read poll options from their plans"
ON plan_poll_options
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_options.poll_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Plan participants can insert poll options"
ON plan_poll_options
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_options.poll_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Plan participants can update poll options"
ON plan_poll_options
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_options.poll_id
      AND plan_participants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_options.poll_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Plan participants can delete poll options"
ON plan_poll_options
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_options.poll_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can read votes from their plans"
ON plan_poll_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_votes.poll_id
      AND plan_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Going participants can insert votes"
ON plan_poll_votes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_votes.poll_id
      AND plan_participants.user_id = auth.uid()
      AND plan_participants.status = 'going'
  )
  AND user_id = auth.uid()
);

CREATE POLICY "Going participants can update votes"
ON plan_poll_votes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_votes.poll_id
      AND plan_participants.user_id = auth.uid()
      AND plan_participants.status = 'going'
  )
  AND user_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_votes.poll_id
      AND plan_participants.user_id = auth.uid()
      AND plan_participants.status = 'going'
  )
  AND user_id = auth.uid()
);

CREATE POLICY "Going participants can delete votes"
ON plan_poll_votes
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM plan_polls
    JOIN plan_participants ON plan_participants.plan_id = plan_polls.plan_id
    WHERE plan_polls.id = plan_poll_votes.poll_id
      AND plan_participants.user_id = auth.uid()
      AND plan_participants.status = 'going'
  )
  AND user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION get_plan_polls(p_plan_id UUID)
RETURNS TABLE (
  poll_id UUID,
  title TEXT,
  poll_type TEXT,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  created_by UUID,
  creator_name TEXT,
  creator_username TEXT,
  creator_avatar TEXT,
  options JSONB,
  votes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id AS poll_id,
    pp.title,
    pp.poll_type,
    pp.ends_at,
    pp.created_at,
    pp.created_by,
    u.name AS creator_name,
    u.username AS creator_username,
    u.avatar_url AS creator_avatar,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', ppo.id,
            'text', ppo.option_text,
            'order', ppo.option_order
          )
          ORDER BY ppo.option_order
        ),
        '[]'::jsonb
      )
      FROM plan_poll_options ppo
      WHERE ppo.poll_id = pp.id
    ) AS options,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'option_id', ppv.option_id,
            'user_id', ppv.user_id,
            'voter_name', vu.name,
            'voter_avatar', vu.avatar_url
          )
        ),
        '[]'::jsonb
      )
      FROM plan_poll_votes ppv
      LEFT JOIN users vu ON vu.id = ppv.user_id
      WHERE ppv.poll_id = pp.id
    ) AS votes
  FROM plan_polls pp
  LEFT JOIN users u ON u.id = pp.created_by
  WHERE pp.plan_id = p_plan_id
  ORDER BY pp.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_plan_polls(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_plan_polls(UUID) TO authenticated;

ALTER TABLE plan_poll_votes REPLICA IDENTITY FULL;
ALTER TABLE plan_polls REPLICA IDENTITY FULL;

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'plan_updates'::regclass
      AND contype = 'c'
  LOOP
    IF constraint_record.definition ILIKE '%update_type%' THEN
      EXECUTE format(
        'ALTER TABLE plan_updates DROP CONSTRAINT %I',
        constraint_record.conname
      );
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE plan_updates
ADD CONSTRAINT plan_updates_update_type_check
CHECK (
  update_type IN (
    'poll_created',
    'poll_updated',
    'poll_deleted',
    'poll_voted',
    'poll_won',
    'poll_option_added',
    'poll_option_removed',
    'participant_joined',
    'participant_left',
    'participant_invited',
    'participant_status_changed',
    'participant_accepted_conditionally',
    'participant_conditional',
    'plan_completed',
    'new_message',
    'invitation_poll_created',
    'invitation_poll_voted',
    'invitation_poll_expired',
    'invitation_poll_rejected',
    'invitation_poll_completed',
    'conditional_status_changed'
  )
);

CREATE OR REPLACE FUNCTION notify_poll_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
  VALUES (
    NEW.plan_id,
    'poll_created',
    COALESCE(auth.uid(), NEW.created_by),
    jsonb_build_object('poll_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_poll_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
  VALUES (
    NEW.plan_id,
    'poll_updated',
    COALESCE(auth.uid(), NEW.created_by),
    jsonb_build_object('poll_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_poll_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
  VALUES (
    OLD.plan_id,
    'poll_deleted',
    COALESCE(auth.uid(), OLD.created_by),
    jsonb_build_object('poll_id', OLD.id)
  );

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

  IF target_plan_id IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS poll_created_trigger ON plan_polls;
CREATE TRIGGER poll_created_trigger
AFTER INSERT ON plan_polls
FOR EACH ROW
EXECUTE FUNCTION notify_poll_created();

DROP TRIGGER IF EXISTS poll_updated_trigger ON plan_polls;
CREATE TRIGGER poll_updated_trigger
AFTER UPDATE ON plan_polls
FOR EACH ROW
EXECUTE FUNCTION notify_poll_updated();

DROP TRIGGER IF EXISTS poll_deleted_trigger ON plan_polls;
CREATE TRIGGER poll_deleted_trigger
AFTER DELETE ON plan_polls
FOR EACH ROW
EXECUTE FUNCTION notify_poll_deleted();

DROP TRIGGER IF EXISTS poll_voted_trigger ON plan_poll_votes;
CREATE TRIGGER poll_voted_trigger
AFTER INSERT OR UPDATE OR DELETE ON plan_poll_votes
FOR EACH ROW
EXECUTE FUNCTION notify_poll_voted();
