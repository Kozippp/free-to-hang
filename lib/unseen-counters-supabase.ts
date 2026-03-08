/**
 * Unseen Counters – Direct Supabase Service
 *
 * All unseen/unread badge data is fetched directly from Supabase,
 * without going through the Express backend.
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PlanUnseenCounts {
  chat: number;
  control: number;
  total: number;
}

export interface UnseenCountsResult {
  /** per-plan unseen breakdown */
  plans: Record<string, PlanUnseenCounts>;
  /** sum of all plan unseen counts */
  totalPlanUnseen: number;
  /** pending invitations (status='pending' AND invitation_seen_at IS NULL) */
  invitationUnreadCount: number;
  /** incoming friend requests (status='pending', receiver = me) */
  friendRequestCount: number;
  /** newly accepted friends not yet seen on Hang tab */
  newFriendsCount: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// Plan unseen counts (chat + control panel) – per plan
// ─────────────────────────────────────────────────────────────

/**
 * Fetch unseen chat message counts and control-panel update counts
 * for every plan the current user participates in.
 */
export async function fetchPlanUnseenCounts(
  userId: string
): Promise<{ plans: Record<string, PlanUnseenCounts>; totalPlanUnseen: number }> {
  // 1. Get all plan IDs for this user (participant or creator)
  const { data: participantRows, error: partErr } = await supabase
    .from('plan_participants')
    .select('plan_id')
    .eq('user_id', userId);

  if (partErr) {
    console.error('❌ [unseen] Error fetching participant plan IDs:', partErr);
    return { plans: {}, totalPlanUnseen: 0 };
  }

  const { data: creatorRows, error: creatorErr } = await supabase
    .from('plans')
    .select('id')
    .eq('creator_id', userId)
    .eq('status', 'active');

  if (creatorErr) {
    console.error('❌ [unseen] Error fetching creator plan IDs:', creatorErr);
  }

  const planIds = Array.from(
    new Set([
      ...(participantRows ?? []).map((r) => r.plan_id as string),
      ...(creatorRows ?? []).map((r) => r.id as string),
    ])
  );

  if (planIds.length === 0) {
    return { plans: {}, totalPlanUnseen: 0 };
  }

  // 2. Fetch read receipts for chat + control panel in bulk
  const [{ data: chatReceipts }, { data: controlReceipts }] = await Promise.all([
    supabase
      .from('chat_read_receipts')
      .select('plan_id, last_read_at')
      .eq('user_id', userId)
      .in('plan_id', planIds),
    supabase
      .from('plan_update_read_receipts')
      .select('plan_id, last_read_at')
      .eq('user_id', userId)
      .in('plan_id', planIds),
  ]);

  const chatReceiptMap = new Map(
    (chatReceipts ?? []).map((r) => [r.plan_id as string, r.last_read_at as string])
  );
  const controlReceiptMap = new Map(
    (controlReceipts ?? []).map((r) => [r.plan_id as string, r.last_read_at as string])
  );

  // 3. Count unseen per plan (process in small batches to avoid overwhelming Supabase)
  const BATCH = 5;
  const results: Record<string, PlanUnseenCounts> = {};

  for (let i = 0; i < planIds.length; i += BATCH) {
    const chunk = planIds.slice(i, i + BATCH);

    await Promise.all(
      chunk.map(async (planId) => {
        const lastChatReadAt = chatReceiptMap.get(planId);
        const lastControlReadAt = controlReceiptMap.get(planId);

        let chatQuery = supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('plan_id', planId)
          .eq('deleted', false)
          .neq('user_id', userId);

        if (lastChatReadAt) {
          chatQuery = chatQuery.gt('created_at', lastChatReadAt);
        }

        let controlQuery = supabase
          .from('plan_updates')
          .select('id', { count: 'exact', head: true })
          .eq('plan_id', planId)
          .or(`triggered_by.is.null,triggered_by.neq.${userId}`);

        if (lastControlReadAt) {
          controlQuery = controlQuery.gt('created_at', lastControlReadAt);
        }

        const [{ count: chatCount }, { count: controlCount }] = await Promise.all([
          chatQuery,
          controlQuery,
        ]);

        const chat = chatCount ?? 0;
        const control = controlCount ?? 0;
        results[planId] = { chat, control, total: chat + control };
      })
    );
  }

  const totalPlanUnseen = Object.values(results).reduce((sum, v) => sum + v.total, 0);
  return { plans: results, totalPlanUnseen };
}

// ─────────────────────────────────────────────────────────────
// Mark control panel seen (direct Supabase upsert)
// ─────────────────────────────────────────────────────────────

export async function markControlPanelSeenDirect(planId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('plan_update_read_receipts')
    .upsert({ plan_id: planId, user_id: userId, last_read_at: now }, { onConflict: 'plan_id,user_id' });

  if (error) {
    console.error('❌ [unseen] markControlPanelSeen error:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Invitation unread count
// ─────────────────────────────────────────────────────────────

/**
 * Count pending invitations that have not been opened yet.
 * (status='pending' AND invitation_seen_at IS NULL)
 */
export async function fetchUnreadInvitationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('plan_participants')
    .select('plan_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .is('invitation_seen_at', null);

  if (error) {
    console.error('❌ [unseen] fetchUnreadInvitationCount error:', error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Mark a specific invitation as seen by setting invitation_seen_at = NOW().
 */
export async function markInvitationSeen(planId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('plan_participants')
    .update({ invitation_seen_at: new Date().toISOString() })
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .is('invitation_seen_at', null); // only update if not already seen

  if (error) {
    console.error('❌ [unseen] markInvitationSeen error:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Friend request count
// ─────────────────────────────────────────────────────────────

/**
 * Count incoming (pending) friend requests.
 */
export async function fetchPendingFriendRequestCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('friend_requests')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('❌ [unseen] fetchPendingFriendRequestCount error:', error);
    return 0;
  }
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────
// New friends (Hang tab badge)
// ─────────────────────────────────────────────────────────────

/**
 * Count friends accepted after the user last opened the Hang tab.
 * "New" means friend_requests.updated_at > user_status.friends_list_seen_at.
 */
export async function fetchNewFriendsCount(userId: string): Promise<number> {
  // Get the user's friends_list_seen_at timestamp
  const { data: statusRow, error: statusErr } = await supabase
    .from('user_status')
    .select('friends_list_seen_at')
    .eq('user_id', userId)
    .single();

  if (statusErr && statusErr.code !== 'PGRST116') {
    console.error('❌ [unseen] fetchNewFriendsCount – user_status error:', statusErr);
    return 0;
  }

  const seenAt: string | null = statusRow?.friends_list_seen_at ?? null;

  // Count accepted friendships where updated_at is after last seen
  let query = supabase
    .from('friend_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (seenAt) {
    query = query.gt('updated_at', seenAt);
  }

  const { count, error } = await query;

  if (error) {
    console.error('❌ [unseen] fetchNewFriendsCount error:', error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Mark the Hang tab as "seen" – sets friends_list_seen_at = NOW().
 */
export async function markFriendsListSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_status')
    .update({ friends_list_seen_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('❌ [unseen] markFriendsListSeen error:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Aggregate fetch – all counters in one call
// ─────────────────────────────────────────────────────────────

export async function fetchAllUnseenCounts(userId: string): Promise<UnseenCountsResult> {
  const [
    { plans, totalPlanUnseen },
    invitationUnreadCount,
    friendRequestCount,
    newFriendsCount,
  ] = await Promise.all([
    fetchPlanUnseenCounts(userId),
    fetchUnreadInvitationCount(userId),
    fetchPendingFriendRequestCount(userId),
    fetchNewFriendsCount(userId),
  ]);

  return {
    plans,
    totalPlanUnseen,
    invitationUnreadCount,
    friendRequestCount,
    newFriendsCount,
  };
}
