-- Startup / badge-query performance: foreign keys flagged by Supabase advisor
CREATE INDEX IF NOT EXISTS idx_notifications_triggered_by
  ON public.notifications (triggered_by);

CREATE INDEX IF NOT EXISTS idx_plan_updates_triggered_by
  ON public.plan_updates (triggered_by);

CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_option_id
  ON public.plan_poll_votes (option_id);

CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_last_read_message_id
  ON public.chat_read_receipts (last_read_message_id);

CREATE INDEX IF NOT EXISTS idx_invitation_polls_created_by
  ON public.invitation_polls (created_by);

CREATE INDEX IF NOT EXISTS idx_plan_conditional_dependencies_friend_id
  ON public.plan_conditional_dependencies (friend_id);

CREATE INDEX IF NOT EXISTS idx_plan_conditional_dependencies_user_id
  ON public.plan_conditional_dependencies (user_id);

CREATE INDEX IF NOT EXISTS idx_username_reservations_user_id
  ON public.username_reservations (user_id);

-- Common startup filters
CREATE INDEX IF NOT EXISTS idx_plan_participants_user_status
  ON public.plan_participants (user_id, status);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_pending
  ON public.friend_requests (receiver_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);
