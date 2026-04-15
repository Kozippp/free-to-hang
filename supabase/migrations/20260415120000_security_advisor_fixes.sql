-- Security Advisor fixes
-- 1. user_directory - only show users who have completed onboarding
-- 2. chat_unread_counts - restrict to current user only
-- 3. notification_stats - restrict to current user only
-- 4. chat_message_counts - restrict to plans the user belongs to
-- 5. function search_path fixes (cosmetic - no behaviour change)
-- 6. chat-images bucket - remove broad listing policy

-- ============================================================
-- 1. user_directory: filter out incomplete onboarding profiles
-- ============================================================
CREATE OR REPLACE VIEW public.user_directory AS
SELECT
  id,
  name,
  username,
  avatar_url,
  bio,
  vibe,
  onboarding_completed,
  created_at,
  updated_at
FROM users u
WHERE onboarding_completed = true;

-- ============================================================
-- 2. chat_unread_counts: restrict to current user only
-- ============================================================
CREATE OR REPLACE VIEW public.chat_unread_counts AS
SELECT
  cm.plan_id,
  pp.user_id,
  count(cm.id) AS unread_count
FROM chat_messages cm
JOIN plan_participants pp ON cm.plan_id = pp.plan_id
LEFT JOIN chat_read_receipts crr ON crr.plan_id = cm.plan_id AND crr.user_id = pp.user_id
WHERE
  cm.deleted = false
  AND cm.user_id <> pp.user_id
  AND (crr.last_read_at IS NULL OR cm.created_at > crr.last_read_at)
  AND pp.user_id = auth.uid()
GROUP BY cm.plan_id, pp.user_id;

-- ============================================================
-- 3. notification_stats: restrict to current user only
-- ============================================================
CREATE OR REPLACE VIEW public.notification_stats AS
SELECT
  user_id,
  count(*) AS total_notifications,
  count(*) FILTER (WHERE read = false) AS unread_count,
  count(*) FILTER (WHERE type = 'plan_invite') AS plan_invites,
  count(*) FILTER (WHERE type = 'chat_message') AS chat_messages,
  count(*) FILTER (WHERE type = 'friend_request') AS friend_requests,
  max(created_at) AS last_notification_at
FROM notifications
WHERE user_id = auth.uid()
GROUP BY user_id;

-- ============================================================
-- 4. chat_message_counts: restrict to plans the user belongs to
-- ============================================================
CREATE OR REPLACE VIEW public.chat_message_counts AS
SELECT
  plan_id,
  count(*) AS total_messages,
  count(DISTINCT user_id) AS active_users,
  max(created_at) AS last_message_at
FROM chat_messages
WHERE
  deleted = false
  AND plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
    UNION
    SELECT id FROM plans WHERE creator_id = auth.uid()
  )
GROUP BY plan_id;

-- ============================================================
-- 5. Function search_path fixes (no behaviour change)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_chat_message_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = NOW()
  WHERE user_id = target_user_id AND read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_invitation_poll(poll_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  poll_record RECORD;
  yes_votes INTEGER;
  total_votes INTEGER;
BEGIN
  SELECT pp.*, pp.plan_id INTO poll_record
  FROM plan_polls pp
  WHERE pp.id = poll_id_param AND pp.poll_type = 'invitation';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE ppo.option_text = 'Yes') as yes_count,
    COUNT(*) as total_count
  INTO yes_votes, total_votes
  FROM plan_poll_votes ppv
  JOIN plan_poll_options ppo ON ppv.option_id = ppo.id
  WHERE ppv.poll_id = poll_id_param;

  IF total_votes > 0 AND (yes_votes::numeric / total_votes) > 0.5 THEN
    FOR i IN 1..array_length(poll_record.invited_users, 1) LOOP
      INSERT INTO plan_participants (plan_id, user_id, status)
      VALUES (poll_record.plan_id, poll_record.invited_users[i], 'pending')
      ON CONFLICT (plan_id, user_id) DO NOTHING;
    END LOOP;

    INSERT INTO plan_updates (plan_id, update_type, metadata)
    VALUES (poll_record.plan_id, 'invitation_poll_completed', jsonb_build_object('poll_id', poll_id_param, 'added_users', poll_record.invited_users));
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_conditional_dependencies(plan_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  participant_record RECORD;
  conditional_friends UUID[];
  all_friends_accepted BOOLEAN;
BEGIN
  FOR participant_record IN
    SELECT * FROM plan_participants
    WHERE plan_id = plan_id_param AND status = 'conditional'
    AND conditional_friends IS NOT NULL AND array_length(conditional_friends, 1) > 0
  LOOP
    SELECT bool_and(pp.status = 'going') INTO all_friends_accepted
    FROM plan_participants pp
    WHERE pp.plan_id = plan_id_param
      AND pp.user_id = ANY(participant_record.conditional_friends);

    IF all_friends_accepted THEN
      UPDATE plan_participants
      SET status = 'going', updated_at = NOW()
      WHERE plan_id = plan_id_param AND user_id = participant_record.user_id;

      INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
      VALUES (plan_id_param, 'conditional_status_changed', participant_record.user_id,
              jsonb_build_object('new_status', 'going', 'conditional_friends', participant_record.conditional_friends));

      UPDATE plan_participants
      SET conditional_friends = NULL
      WHERE plan_id = plan_id_param AND user_id = participant_record.user_id;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_poll_results(poll_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  poll_data RECORD;
  option_data RECORD;
  total_voters INTEGER;
  going_participants INTEGER;
  winner_threshold INTEGER;
  max_votes INTEGER;
  results JSONB := '{"options": [], "winner": null, "total_votes": 0, "total_voters": 0}';
  options_array JSONB := '[]';
BEGIN
  SELECT pp.*, p.id as plan_id INTO poll_data
  FROM plan_polls pp
  JOIN plans p ON pp.plan_id = p.id
  WHERE pp.id = poll_id_param;

  IF NOT FOUND THEN
    RETURN results;
  END IF;

  SELECT COUNT(DISTINCT user_id) INTO total_voters
  FROM plan_poll_votes
  WHERE poll_id = poll_id_param;

  SELECT COUNT(*) INTO going_participants
  FROM plan_participants
  WHERE plan_id = poll_data.plan_id AND status = 'going';

  winner_threshold := GREATEST(
    CEIL(0.4 * going_participants),
    CEIL(0.7 * total_voters),
    LEAST(3, going_participants)
  );

  SELECT COALESCE(MAX(vote_count), 0) INTO max_votes
  FROM (
    SELECT COUNT(*) as vote_count
    FROM plan_poll_votes pv
    WHERE pv.poll_id = poll_id_param
    GROUP BY option_id
  ) vote_counts;

  FOR option_data IN
    SELECT
      ppo.id,
      ppo.option_text,
      COALESCE(vote_counts.vote_count, 0) as votes,
      COALESCE(vote_counts.vote_count, 0) >= winner_threshold AND
      COALESCE(vote_counts.vote_count, 0) = max_votes as is_winner
    FROM plan_poll_options ppo
    LEFT JOIN (
      SELECT option_id, COUNT(*) as vote_count
      FROM plan_poll_votes
      WHERE poll_id = poll_id_param
      GROUP BY option_id
    ) vote_counts ON ppo.id = vote_counts.option_id
    WHERE ppo.poll_id = poll_id_param
    ORDER BY COALESCE(vote_counts.vote_count, 0) DESC, ppo.created_at ASC
  LOOP
    options_array := options_array || jsonb_build_object(
      'id', option_data.id,
      'text', option_data.option_text,
      'votes', option_data.votes,
      'percentage', CASE WHEN total_voters > 0 THEN ROUND((option_data.votes::numeric / total_voters) * 100) ELSE 0 END,
      'is_winner', option_data.is_winner
    );

    IF option_data.is_winner THEN
      results := jsonb_set(results, '{winner}', jsonb_build_object(
        'id', option_data.id,
        'text', option_data.option_text,
        'votes', option_data.votes
      ));
    END IF;
  END LOOP;

  results := jsonb_set(results, '{options}', options_array);
  results := jsonb_set(results, '{total_votes}', to_jsonb(total_voters));
  results := jsonb_set(results, '{total_voters}', to_jsonb(total_voters));
  results := jsonb_set(results, '{winner_threshold}', to_jsonb(winner_threshold));

  RETURN results;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_expired_invitation_polls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  poll_record RECORD;
  allow_votes INTEGER;
  deny_votes INTEGER;
  total_votes INTEGER;
  plan_id_var UUID;
  invited_user_id_var UUID;
BEGIN
  FOR poll_record IN
    SELECT ip.id, ip.plan_id, ip.invited_user_id
    FROM invitation_polls ip
    WHERE ip.status = 'active'
      AND ip.expires_at <= NOW()
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE ipv.vote = 'allow') as allow_count,
      COUNT(*) FILTER (WHERE ipv.vote = 'deny') as deny_count,
      COUNT(*) as total_count
    INTO allow_votes, deny_votes, total_votes
    FROM invitation_poll_votes ipv
    WHERE ipv.poll_id = poll_record.id;

    IF total_votes > 0 AND (allow_votes::numeric / total_votes) > 0.5 THEN
      INSERT INTO plan_participants (plan_id, user_id, status, created_at)
      VALUES (poll_record.plan_id, poll_record.invited_user_id, 'pending', NOW())
      ON CONFLICT (plan_id, user_id) DO NOTHING;

      INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
      VALUES (poll_record.plan_id, 'participant_invited', poll_record.invited_user_id,
              jsonb_build_object('via_invitation_poll', true, 'poll_id', poll_record.id, 'poll_result', 'accepted'));

      DELETE FROM invitation_poll_votes WHERE poll_id = poll_record.id;
      DELETE FROM invitation_polls WHERE id = poll_record.id;

    ELSE
      DELETE FROM invitation_poll_votes WHERE poll_id = poll_record.id;
      DELETE FROM invitation_polls WHERE id = poll_record.id;

      INSERT INTO plan_updates (plan_id, update_type, triggered_by, metadata)
      VALUES (poll_record.plan_id, 'invitation_poll_rejected', poll_record.invited_user_id,
              jsonb_build_object('poll_id', poll_record.id, 'poll_result', 'rejected'));
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_complete_plans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE plans
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'active'
    AND created_at <= NOW() - INTERVAL '24 hours';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_friendship_status(user1_id uuid, user2_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  request_record friend_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_record
  FROM friend_requests
  WHERE sender_id = user1_id AND receiver_id = user2_id;

  IF FOUND THEN
    RETURN request_record.status || '_sent';
  END IF;

  SELECT * INTO request_record
  FROM friend_requests
  WHERE sender_id = user2_id AND receiver_id = user1_id;

  IF FOUND THEN
    RETURN request_record.status || '_received';
  END IF;

  RETURN 'none';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_friends(user_id uuid)
RETURNS TABLE(friend_id uuid, friend_name text, friend_username text, friend_avatar_url text, friend_vibe text, friendship_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    u.id as friend_id,
    u.name as friend_name,
    u.username as friend_username,
    u.avatar_url as friend_avatar_url,
    u.vibe as friend_vibe,
    fr.updated_at as friendship_date
  FROM friend_requests fr
  JOIN users u ON u.id = fr.receiver_id
  WHERE fr.sender_id = user_id AND fr.status = 'accepted'

  UNION

  SELECT
    u.id as friend_id,
    u.name as friend_name,
    u.username as friend_username,
    u.avatar_url as friend_avatar_url,
    u.vibe as friend_vibe,
    fr.updated_at as friendship_date
  FROM friend_requests fr
  JOIN users u ON u.id = fr.sender_id
  WHERE fr.receiver_id = user_id AND fr.status = 'accepted'

  ORDER BY friendship_date DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_incoming_requests(user_id uuid)
RETURNS TABLE(request_id uuid, sender_id uuid, sender_name text, sender_username text, sender_avatar_url text, sender_vibe text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    fr.id as request_id,
    u.id as sender_id,
    u.name as sender_name,
    u.username as sender_username,
    u.avatar_url as sender_avatar_url,
    u.vibe as sender_vibe,
    fr.created_at
  FROM friend_requests fr
  JOIN users u ON u.id = fr.sender_id
  WHERE fr.receiver_id = user_id AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_outgoing_requests(user_id uuid)
RETURNS TABLE(request_id uuid, receiver_id uuid, receiver_name text, receiver_username text, receiver_avatar_url text, receiver_vibe text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    fr.id as request_id,
    u.id as receiver_id,
    u.name as receiver_name,
    u.username as receiver_username,
    u.avatar_url as receiver_avatar_url,
    u.vibe as receiver_vibe,
    fr.created_at
  FROM friend_requests fr
  JOIN users u ON u.id = fr.receiver_id
  WHERE fr.sender_id = user_id AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$function$;

-- ============================================================
-- 6. chat-images bucket: remove broad listing policy
--    Replace with a restricted policy that only allows listing
--    files owned by the current user (path starts with user's uid)
-- ============================================================
DROP POLICY IF EXISTS "Chat images are publicly accessible" ON storage.objects;

-- Public read by direct URL still works via the bucket being public.
-- Add a scoped SELECT policy so listing only returns own files.
CREATE POLICY "Users can view their own chat images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-images'
  AND (auth.uid())::text = (string_to_array(name, '/'))[1]
);
