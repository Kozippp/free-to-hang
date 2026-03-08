import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import {
  fetchAllUnseenCounts,
  markControlPanelSeenDirect,
  markInvitationSeen,
  markFriendsListSeen,
  type PlanUnseenCounts,
  type UnseenCountsResult,
} from '@/lib/unseen-counters-supabase';

export type { PlanUnseenCounts };

interface UnseenState {
  // Plan-level counters (chat + control panel per plan)
  plans: Record<string, PlanUnseenCounts>;
  totalPlanUnseen: number;

  // Tab-level counters
  invitationUnreadCount: number;
  friendRequestCount: number;
  newFriendsCount: number;

  // Loading / dedup
  loading: boolean;
  pendingRefetch: boolean;

  // Actions
  fetchUnseenCounts: () => Promise<void>;
  markControlPanelSeen: (planId: string) => Promise<void>;
  markChatSeen: (planId: string) => void;
  markInvitationSeen: (planId: string) => Promise<void>;
  markFriendsListSeen: () => Promise<void>;
  clear: () => void;
}

const useUnseenStore = create<UnseenState>((set, get) => ({
  plans: {},
  totalPlanUnseen: 0,
  invitationUnreadCount: 0,
  friendRequestCount: 0,
  newFriendsCount: 0,
  loading: false,
  pendingRefetch: false,

  // ─────────────────────────────────────────────────────────
  // Fetch all counters directly from Supabase
  // ─────────────────────────────────────────────────────────
  fetchUnseenCounts: async () => {
    const state = get();
    if (state.loading) {
      if (!state.pendingRefetch) {
        set({ pendingRefetch: true });
      }
      return;
    }

    set({ loading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        set({ loading: false });
        return;
      }

      const result: UnseenCountsResult = await fetchAllUnseenCounts(user.id);

      set({
        plans: result.plans,
        totalPlanUnseen: result.totalPlanUnseen,
        invitationUnreadCount: result.invitationUnreadCount,
        friendRequestCount: result.friendRequestCount,
        newFriendsCount: result.newFriendsCount,
        loading: false,
      });

      if (get().pendingRefetch) {
        set({ pendingRefetch: false });
        setTimeout(() => get().fetchUnseenCounts(), 100);
      }
    } catch (error) {
      console.error('❌ [unseenStore] fetchUnseenCounts error:', error);
      set({ loading: false });

      if (get().pendingRefetch) {
        set({ pendingRefetch: false });
        setTimeout(() => get().fetchUnseenCounts(), 2000);
      }
    }
  },

  // ─────────────────────────────────────────────────────────
  // Mark control panel seen (direct Supabase upsert)
  // ─────────────────────────────────────────────────────────
  markControlPanelSeen: async (planId: string) => {
    if (!planId) return;
    const current = get().plans[planId];
    if (current && current.control === 0) return;

    // Optimistic update first
    const previous = get().plans[planId];
    if (previous) {
      const updated = { ...previous, control: 0, total: previous.chat };
      const updatedPlans = { ...get().plans, [planId]: updated };
      const totalPlanUnseen = Object.values(updatedPlans).reduce((s, v) => s + v.total, 0);
      set({ plans: updatedPlans, totalPlanUnseen });
    }

    try {
      await markControlPanelSeenDirect(planId);
    } catch (error) {
      console.error('❌ [unseenStore] markControlPanelSeen error:', error);
      // Revert on failure
      if (previous) {
        const revertedPlans = { ...get().plans, [planId]: previous };
        const totalPlanUnseen = Object.values(revertedPlans).reduce((s, v) => s + v.total, 0);
        set({ plans: revertedPlans, totalPlanUnseen });
      }
    }
  },

  // ─────────────────────────────────────────────────────────
  // Mark chat seen (optimistic local update only;
  // actual receipt is written in chatStore via Supabase upsert)
  // ─────────────────────────────────────────────────────────
  markChatSeen: (planId: string) => {
    if (!planId) return;
    const previous = get().plans[planId];
    if (previous && previous.chat > 0) {
      const updated = { ...previous, chat: 0, total: previous.control };
      const updatedPlans = { ...get().plans, [planId]: updated };
      const totalPlanUnseen = Object.values(updatedPlans).reduce((s, v) => s + v.total, 0);
      set({ plans: updatedPlans, totalPlanUnseen });
    }
  },

  // ─────────────────────────────────────────────────────────
  // Mark invitation seen
  // ─────────────────────────────────────────────────────────
  markInvitationSeen: async (planId: string) => {
    if (!planId) return;

    // Optimistic: decrement invitation count
    set((state) => ({
      invitationUnreadCount: Math.max(0, state.invitationUnreadCount - 1),
    }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      await markInvitationSeen(planId, user.id);
    } catch (error) {
      console.error('❌ [unseenStore] markInvitationSeen error:', error);
      // Revert on failure
      set((state) => ({ invitationUnreadCount: state.invitationUnreadCount + 1 }));
    }
  },

  // ─────────────────────────────────────────────────────────
  // Mark friends list seen (Hang tab)
  // ─────────────────────────────────────────────────────────
  markFriendsListSeen: async () => {
    // Optimistic: clear the badge immediately
    set({ newFriendsCount: 0 });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      await markFriendsListSeen(user.id);
    } catch (error) {
      console.error('❌ [unseenStore] markFriendsListSeen error:', error);
    }
  },

  // ─────────────────────────────────────────────────────────
  // Clear all counters (on sign-out)
  // ─────────────────────────────────────────────────────────
  clear: () =>
    set({
      plans: {},
      totalPlanUnseen: 0,
      invitationUnreadCount: 0,
      friendRequestCount: 0,
      newFriendsCount: 0,
      loading: false,
      pendingRefetch: false,
    }),
}));

export default useUnseenStore;
