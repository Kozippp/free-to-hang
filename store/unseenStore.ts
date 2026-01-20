import { create } from 'zustand';
import { plansService } from '@/lib/plans-service';

export type PlanUnseenCounts = {
  chat: number;
  control: number;
  total: number;
};

interface UnseenState {
  plans: Record<string, PlanUnseenCounts>;
  totalUnseen: number;
  loading: boolean;
  pendingRefetch: boolean;
  fetchUnseenCounts: () => Promise<void>;
  markControlPanelSeen: (planId: string) => Promise<void>;
  markChatSeen: (planId: string) => void;
  clear: () => void;
}

const useUnseenStore = create<UnseenState>((set, get) => ({
  plans: {},
  totalUnseen: 0,
  loading: false,
  pendingRefetch: false,

  fetchUnseenCounts: async () => {
    const state = get();
    if (state.loading) {
      // If already loading, mark that we need another fetch after this one
      // This prevents parallel requests but ensures we eventually get the latest data
      if (!state.pendingRefetch) {
        console.log('⏳ Unseen counts fetch already in progress, queuing refetch');
        set({ pendingRefetch: true });
      }
      return;
    }

    set({ loading: true });
    try {
      const result = await plansService.getUnseenCounts();
      set({
        plans: result.plans || {},
        totalUnseen: result.totalUnseen || 0,
        loading: false
      });
      
      // If a refetch was requested while we were loading, trigger it now
      if (get().pendingRefetch) {
        console.log('🔄 Processing queued unseen counts refetch');
        set({ pendingRefetch: false });
        // Small delay to let UI breathe
        setTimeout(() => get().fetchUnseenCounts(), 100);
      }
    } catch (error) {
      console.error('❌ Failed to fetch unseen counts:', error);
      set({ loading: false });
      
      // If pending refetch, retry after a delay
      if (get().pendingRefetch) {
        set({ pendingRefetch: false });
        setTimeout(() => get().fetchUnseenCounts(), 2000);
      }
    }
  },

  markControlPanelSeen: async (planId: string) => {
    if (!planId) return;
    const current = get().plans[planId];
    if (current && current.control === 0) {
      return;
    }

    try {
      await plansService.markControlPanelSeen(planId);
    } catch (error) {
      console.error('❌ Failed to mark control panel seen:', error);
      // We don't return here because we want to perform the optimistic update anyway
      // to clear the badge for the user
    }

    const previous = get().plans[planId];
    if (previous) {
      const updatedPlan = { ...previous, control: 0, total: previous.chat };
      const updatedPlans = { ...get().plans, [planId]: updatedPlan };
      const totalUnseen = Object.values(updatedPlans).reduce((sum, item) => sum + item.total, 0);
      set({ plans: updatedPlans, totalUnseen });
    } else {
      await get().fetchUnseenCounts();
    }
  },

  markChatSeen: (planId: string) => {
    if (!planId) return;
    const previous = get().plans[planId];
    if (previous && previous.chat > 0) {
      const updatedPlan = { ...previous, chat: 0, total: previous.control };
      const updatedPlans = { ...get().plans, [planId]: updatedPlan };
      const totalUnseen = Object.values(updatedPlans).reduce((sum, item) => sum + item.total, 0);
      set({ plans: updatedPlans, totalUnseen });
    }
  },

  clear: () => set({ plans: {}, totalUnseen: 0, loading: false, pendingRefetch: false })
}));

export default useUnseenStore;
