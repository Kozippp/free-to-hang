import { create } from 'zustand';
import { useRouter } from 'expo-router';
import { plansService } from '@/lib/plans-service';
import { supabase } from '@/lib/supabase';
import { prefetchAvatars } from '@/utils/avatarCache';
import useUnseenStore from './unseenStore';

export type ParticipantStatus = 'pending' | 'going' | 'maybe' | 'conditional' | 'declined';

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  status: ParticipantStatus;
  conditionalFriends?: string[]; // IDs of friends this user will join with
}

export interface Creator {
  id: string;
  name: string;
  avatar: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // Array of user IDs who voted for this option
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  type: 'when' | 'where' | 'custom' | 'invitation';
  expiresAt?: number; // For invitation polls - timestamp when it expires
  invitedUsers?: string[]; // For invitation polls - user IDs being voted on
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  type: 'normal' | 'anonymous';
  creator: Creator | null; // null for anonymous plans
  participants: Participant[];
  date: string;
  location: string;
  status?: 'active' | 'completed'; // Plan status
  isRead: boolean;
  createdAt: string;
  lastUpdatedAt?: string; // Track when plan was last updated
  updateType?: 'poll_created' | 'poll_won' | 'new_message' | 'participant_joined' | 'poll_voted'; // Type of last update
  hasUnreadUpdates?: boolean; // Whether there are unread updates
  polls?: Poll[];
  completionVotes?: string[]; // Array of participant IDs who voted for completion
  attendanceRecord?: Record<string, boolean>; // Track attendance for completed plans
}

type ChannelConnectionState = 'connected' | 'disconnected' | 'connecting' | null;

interface ChannelStatus {
  state: ChannelConnectionState;
  lastError: string | null;
}

type PlansChannelName = 'plan_updates';

interface SubscriptionMetrics {
  totalConnections: number;
  totalDisconnections: number;
  totalReconnects: number;
  failedReconnects: number;
  lastConnectionTime: string | null;
  lastDisconnectionTime: string | null;
  averageReconnectTime: number;
}

const subscriptionMetrics: SubscriptionMetrics = {
  totalConnections: 0,
  totalDisconnections: 0,
  totalReconnects: 0,
  failedReconnects: 0,
  lastConnectionTime: null,
  lastDisconnectionTime: null,
  averageReconnectTime: 0
};
const reconnectMeasurementStart: Record<string, number> = {};
let reconnectSampleCount = 0;

const resolveIsAnonymous = (plan: any): boolean => {
  if (!plan) return false;
  if (typeof plan.isAnonymous === 'boolean') return plan.isAnonymous;
  if (typeof plan.is_anonymous === 'boolean') return plan.is_anonymous;
  if (typeof plan.is_private === 'boolean') return plan.is_private;
  return false;
};

// Helper function to transform API plan to store format
const transformPlanForStore = (plan: any, currentUserId: string): Plan => {
  const userParticipant = plan.participants.find((p: any) => p.id === currentUserId);
  const userStatus = (userParticipant?.status || (userParticipant as any)?.response) || 'pending';

  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    type: resolveIsAnonymous(plan) ? 'anonymous' : 'normal',
    creator: plan.creator ? {
      id: plan.creator.id === currentUserId ? 'current' : plan.creator.id,
      name: plan.creator.name,
      avatar: plan.creator.avatar_url || ''
    } : null,
    participants: plan.participants.map((p: any) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || '',
      status: (p.status || (p as any).response) as ParticipantStatus,
      conditionalFriends: p.conditionalFriends
    })),
    date: plan.date,
    location: plan.location,
    status: plan.status || 'active',
    isRead: true, // Mark as read for now
    createdAt: plan.createdAt,
    lastUpdatedAt: plan.updatedAt,
    hasUnreadUpdates: false,
    completionVotes: plan.completionVotes || [],
    polls: plan.polls ? plan.polls.map((poll: any) => ({
      ...poll,
      expiresAt: poll.expiresAt ? new Date(poll.expiresAt).getTime() : undefined
    })) : []
  };
};

/** Poll options from API include `voters: { id, name, avatar }[]` (not in minimal PollOption type). */
const collectPollVoterAvatarTargets = (plan: Plan): { userId: string; avatarUrl: string }[] => {
  const out: { userId: string; avatarUrl: string }[] = [];
  const seen = new Set<string>();
  for (const poll of plan.polls ?? []) {
    const rawOptions = (poll as { options?: unknown }).options;
    if (!Array.isArray(rawOptions)) continue;
    for (const opt of rawOptions as { voters?: unknown }[]) {
      const voters = opt?.voters;
      if (!Array.isArray(voters)) continue;
      for (const v of voters as { id?: string; avatar?: string | null }[]) {
        const id = v?.id;
        const url = v?.avatar;
        if (!id || typeof url !== 'string' || !url.trim()) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ userId: id, avatarUrl: url });
      }
    }
  }
  return out;
};

const mergeAvatarPrefetchTargets = (
  targets: { userId: string; avatarUrl?: string | null }[]
): { userId: string; avatarUrl: string }[] => {
  const map = new Map<string, { userId: string; avatarUrl: string }>();
  for (const t of targets) {
    if (!t.userId || typeof t.avatarUrl !== 'string' || !t.avatarUrl.trim()) continue;
    map.set(t.userId, { userId: t.userId, avatarUrl: t.avatarUrl });
  }
  return Array.from(map.values());
};

const buildPlanAvatarPrefetchTargets = (plan: Plan): { userId: string; avatarUrl: string }[] =>
  mergeAvatarPrefetchTargets([
    ...plan.participants.map((p) => ({ userId: p.id, avatarUrl: p.avatar })),
    ...(plan.creator ? [{ userId: plan.creator.id, avatarUrl: plan.creator.avatar }] : []),
    ...collectPollVoterAvatarTargets(plan),
  ]);

// Helper function to ensure all plans have required fields
const ensurePlanDefaults = (plan: any): Plan => {
  return {
    ...plan,
    lastUpdatedAt: plan.lastUpdatedAt || plan.createdAt,
    hasUnreadUpdates: plan.hasUnreadUpdates ?? false,
    completionVotes: plan.completionVotes || []
  };
};

interface PlansState {
  plans: Record<string, Plan>; // planId -> Plan
  invitations: Plan[]; // computed from plans
  activePlans: Plan[]; // computed from plans
  completedPlans: Plan[]; // computed from plans
  isLoading: boolean;
  currentUserId?: string;
  subscriptionStatus: {
    isSubscribed: boolean;
    lastCheckTime: string | null;
    retryAttempts: Record<string, number>;
    channels: {
      plan_updates: ChannelStatus;
    };
  };

  // API Actions
  loadPlans: (userId?: string) => Promise<void>;
  loadCompletedPlans: (userId?: string, limit?: number, offset?: number) => Promise<number>; // Returns count
  loadPlan: (planId: string, userId?: string) => Promise<void>; // Load single plan
  updatePlan: (planId: string, plan: Plan) => void; // Update single plan
  createPlan: (planData: any) => Promise<void>;
  recalculatePlanArrays: () => void; // Recalculate computed arrays from plans object
  // markPlanAsSeen: (planId: string) => Promise<void>; // TODO: Enable when backend is ready

  // Real-time subscriptions
  startRealTimeUpdates: (userId: string) => Promise<void>;
  stopRealTimeUpdates: () => void;
  checkAndRestartSubscriptions: (userId: string, options?: { force?: boolean }) => Promise<void>;
  updateChannelStatus: (
    channel: 'plans' | 'plan_updates',
    state: ChannelConnectionState,
    error?: string
  ) => void;
  setSubscriptionActive: (active: boolean) => void;
  setChannelRetryAttempt: (channel: string, attempts: number) => void;
  recordHealthCheck: () => void;
  getSubscriptionDebugInfo: () => {
    isSubscribed: boolean;
    channels: PlansState['subscriptionStatus']['channels'];
    metrics: SubscriptionMetrics;
    activeChannels: {
      plans: boolean;
      updates: boolean;
    };
    timestamp: string;
  };

  // Actions
  markAsRead: (planId: string) => void;
  respondToPlan: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => Promise<void>;
  addPlan: (plan: Plan) => void;
  checkConditionalDependencies: (planId: string) => void;
  
  // Update tracking actions
  markPlanUpdated: (planId: string, updateType: string) => void;
  markUpdatesAsRead: (planId: string) => void;
  getSortedPlans: (plans: Plan[]) => Plan[];
  
  // Helper function for conditional dependencies
  canParticipantBeAccepted: (
    participant: Participant, 
    allParticipants: Participant[], 
    dependencyGraph: Record<string, string[]>,
    visited: Set<string>
  ) => boolean;
  
  // Poll actions - These are now handled via API calls
  // The real-time subscriptions will update the store automatically
  addPoll: (planId: string, poll: Poll) => void;
  voteOnPollOptimistic: (planId: string, pollId: string, optionIds: string[], userId: string) => void;
  updatePollOption: (planId: string, pollId: string, optionId: string, newText: string) => void;
  removePollOption: (planId: string, pollId: string, optionId: string) => void;
  addPollOption: (planId: string, pollId: string, optionText: string) => void;
  deletePoll: (planId: string, pollId: string) => void;
  
  // Invitation poll actions
  processExpiredInvitationPolls: () => void;
  createInvitationPollWithAutoVote: (planId: string, friendIds: string[], friendNames: string[], creatorId: string) => void;
  
  // Completion actions
  processCompletedPlans: () => void;
  restartPlan: (completedPlan: Plan) => Plan;
  
  // Deprecated completion voting removed
  
  // Attendance tracking for completed plans
  updateAttendance: (planId: string, userId: string, attended: boolean) => void;
}

// Global variables for real-time subscriptions
// NOTE: Consolidated to single channel - plan_updates handles all notifications including new plans
let updatesChannel: any = null;
// NEW: Direct DB table listeners (chat-style, instant!)
let participantsChannel: any = null;
let pollVotesChannel: any = null;
let planPollsChannel: any = null;
let isStartingPlansRealtime = false;

// Debouncing map for per-plan refresh control
const planRefreshTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};
let plansHealthCheckInterval: ReturnType<typeof setInterval> | null = null;

// Track last optimistic updates to avoid duplicate realtime animations
const lastOptimisticUpdate: Record<string, { timestamp: number; userId: string; optionIds: string[] }> = {};
const lastPlanRefreshCallTimes: Record<string, number> = {};
const MIN_TIME_BETWEEN_PLAN_CALLS = 500;

// Reconnection tracking
const MAX_CHANNEL_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000, 60000];
const PLANS_HEALTH_CHECK_INTERVAL = 15000; // 15s (was 60s - too slow for silent failures)
const retryAttempts: Record<string, number> = {};

const usePlansStore = create<PlansState>((set, get) => ({
  plans: {},
  invitations: [],
  activePlans: [],
  completedPlans: [],
  isLoading: false,
  currentUserId: undefined,
  subscriptionStatus: {
    isSubscribed: false,
    lastCheckTime: null,
    retryAttempts: {},
    channels: {
      plan_updates: { state: null, lastError: null }
    }
  },
  updateChannelStatus: (channel, state, error) => {
    set((currentState) => ({
      subscriptionStatus: {
        ...currentState.subscriptionStatus,
        lastCheckTime: new Date().toISOString(),
        channels: {
          ...currentState.subscriptionStatus.channels,
          [channel]: {
            state,
            lastError: error ?? null
          }
        }
      }
    }));
  },
  setSubscriptionActive: (active) => {
    set((currentState) => ({
      subscriptionStatus: {
        ...currentState.subscriptionStatus,
        isSubscribed: active
      }
    }));
  },
  setChannelRetryAttempt: (channel, attempts) => {
    set((currentState) => ({
      subscriptionStatus: {
        ...currentState.subscriptionStatus,
        retryAttempts: {
          ...currentState.subscriptionStatus.retryAttempts,
          [channel]: attempts
        }
      }
    }));
  },
  recordHealthCheck: () => {
    set((currentState) => ({
      subscriptionStatus: {
        ...currentState.subscriptionStatus,
        lastCheckTime: new Date().toISOString()
      }
    }));
  },
  getSubscriptionDebugInfo: () => {
    const state = get();
    return {
      isSubscribed: state.subscriptionStatus.isSubscribed,
      channels: state.subscriptionStatus.channels,
      metrics: subscriptionMetrics,
      activeChannels: {
        plans: !!planPollsChannel,
        updates: !!updatesChannel
      },
      timestamp: new Date().toISOString()
    };
  },

  // Load single plan from API
  loadPlan: async (planId: string, userId?: string) => {
    try {
      console.log('📋 Loading single plan from API:', planId);
      const plan = await plansService.getPlan(planId);
      console.log('✅ Single plan loaded from API:', planId);

      const currentUserId = userId || get().currentUserId || 'unknown';
      const transformedPlan = transformPlanForStore(plan, currentUserId);

      // Smart diff: Only update store if data has actually changed
      const existingPlan = get().plans[planId];
      const hasChanged = !existingPlan || JSON.stringify(existingPlan) !== JSON.stringify(transformedPlan);

      if (hasChanged) {
        console.log('📝 Plan data changed, updating store:', planId);
        // Update plans object
        set(state => ({
          plans: {
            ...state.plans,
            [planId]: transformedPlan
          }
        }));

        // Recalculate computed arrays
        get().recalculatePlanArrays();
      } else {
        console.log('⏭️ Plan data unchanged, skipping store update:', planId);
      }

      void prefetchAvatars(buildPlanAvatarPrefetchTargets(transformedPlan));

      console.log('✅ Single plan load complete:', planId);
    } catch (error) {
      console.error('❌ Error loading single plan:', error);
      throw error;
    }
  },

  // Update single plan in state
  updatePlan: (planId: string, plan: Plan) => {
    set(state => ({
      plans: {
        ...state.plans,
        [planId]: plan
      }
    }));

    // Recalculate computed arrays
    get().recalculatePlanArrays();
  },

  // Recalculate invitation/active/completed arrays from plans object
  recalculatePlanArrays: () => {
    const state = get();
    const plans = Object.values(state.plans);
    const currentUserId = state.currentUserId || 'unknown';

    const invitations: Plan[] = [];
    const activePlans: Plan[] = [];
    const completedPlans: Plan[] = [];

    plans.forEach(plan => {
      const currentUser = plan.participants.find(p => p.id === currentUserId);
      const userStatus = currentUser?.status || 'pending';

      if (plan.status === 'completed') {
        // Show in completed unless the user explicitly declined
        if (userStatus !== 'declined') {
          completedPlans.push(plan);
        }
      } else if (userStatus === 'going' || userStatus === 'maybe' || userStatus === 'conditional') {
        activePlans.push(plan);
      } else if (userStatus === 'pending') {
        // Only pending items should appear under invitations
        invitations.push(plan);
      } else {
        // Declined (and any other non-supported status) should not appear in lists
      }
    });

    set({
      invitations,
      activePlans,
      completedPlans
    });
  },

  // Load active plans from API (default on start)
  loadPlans: async (userId?: string) => {
    try {
      set({ isLoading: true });
      console.log('📋 Loading active plans from API...');

      // Load only active plans initially for performance
      const plans = await plansService.getPlans('active');
      console.log('✅ Active plans loaded from API:', plans.length);

      const currentUserId = userId || get().currentUserId || 'unknown';

      // Update plans object - MERGE with existing plans to keep completed plans if loaded
      const newPlansObject: Record<string, Plan> = {};
      plans.forEach(plan => {
        const transformedPlan = transformPlanForStore(plan, currentUserId);
        newPlansObject[plan.id] = transformedPlan;
      });

      set(state => ({
        plans: {
          ...state.plans,
          ...newPlansObject
        },
        isLoading: false
      }));

      // Recalculate computed arrays
      get().recalculatePlanArrays();

      const batchAvatarTargets: { userId: string; avatarUrl: string }[] = [];
      for (const p of Object.values(newPlansObject)) {
        batchAvatarTargets.push(...buildPlanAvatarPrefetchTargets(p));
      }
      void prefetchAvatars(mergeAvatarPrefetchTargets(batchAvatarTargets));

      // Fetch invitation seen status from Supabase and apply to store
      if (currentUserId && currentUserId !== 'unknown') {
        supabase
          .from('plan_participants')
          .select('plan_id, invitation_seen_at')
          .eq('user_id', currentUserId)
          .eq('status', 'pending')
          .then(({ data, error }) => {
            if (error) {
              console.error('❌ [plansStore] invitation_seen_at fetch error:', error);
              return;
            }
            if (!data || data.length === 0) return;

            set(state => {
              const updatedPlans = { ...state.plans };
              data.forEach((row: { plan_id: string; invitation_seen_at: string | null }) => {
                if (updatedPlans[row.plan_id]) {
                  updatedPlans[row.plan_id] = {
                    ...updatedPlans[row.plan_id],
                    isRead: row.invitation_seen_at !== null,
                  };
                }
              });
              return { plans: updatedPlans };
            });

            // Recalculate after isRead update
            get().recalculatePlanArrays();
          });
      }

      // Also fetch unseen counts
      useUnseenStore.getState().fetchUnseenCounts();

    } catch (error) {
      console.error('❌ Error loading active plans:', error);
      set({ isLoading: false });
    }
  },

  // Load completed plans with pagination
  loadCompletedPlans: async (userId?: string, limit = 15, offset = 0) => {
    try {
      console.log(`📋 Loading completed plans (limit: ${limit}, offset: ${offset})...`);

      const plans = await plansService.getPlans('completed', limit, offset);
      console.log('✅ Completed plans loaded:', plans.length);

      const currentUserId = userId || get().currentUserId || 'unknown';

      const newPlansObject: Record<string, Plan> = {};
      plans.forEach(plan => {
        const transformedPlan = transformPlanForStore(plan, currentUserId);
        newPlansObject[plan.id] = transformedPlan;
      });

      set(state => ({
        plans: {
          ...state.plans,
          ...newPlansObject
        }
      }));

      get().recalculatePlanArrays();

      const batchAvatarTargets: { userId: string; avatarUrl: string }[] = [];
      for (const p of Object.values(newPlansObject)) {
        batchAvatarTargets.push(...buildPlanAvatarPrefetchTargets(p));
      }
      void prefetchAvatars(mergeAvatarPrefetchTargets(batchAvatarTargets));

      return plans.length; // Return count to determine if hasMore
    } catch (error) {
      console.error('❌ Error loading completed plans:', error);
      return 0;
    }
  },
  
  // Create new plan via API
  createPlan: async (planData: any) => {
    try {
      console.log('📝 Creating plan via API...');
      const newPlan = await plansService.createPlan(planData);
      console.log('✅ Plan created via API:', newPlan.id);
      
      // Transform API response to store format
      const transformedPlan: Plan = {
        id: newPlan.id,
        title: newPlan.title,
        description: newPlan.description,
        type: resolveIsAnonymous(newPlan) ? 'anonymous' : 'normal',
        // Since this function is called by the current user, mark creator as 'current'
        creator: newPlan.creator ? {
          id: 'current',
          name: newPlan.creator.name,
          avatar: newPlan.creator.avatar_url || ''
        } : null,
        participants: newPlan.participants.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '',
          status: p.status as ParticipantStatus,
          conditionalFriends: p.conditionalFriends
        })),
        date: newPlan.date,
        location: newPlan.location,
        isRead: true,
        createdAt: newPlan.createdAt,
        lastUpdatedAt: newPlan.updatedAt,
        hasUnreadUpdates: false,
        completionVotes: newPlan.completionVotes || [],
        polls: newPlan.polls ? newPlan.polls.map(poll => ({
          ...poll,
          expiresAt: poll.expiresAt ? new Date(poll.expiresAt).getTime() : undefined
        })) : []
      };
      
      // DISABLED: Optimistic update that causes race conditions
      // Plans will be added only after server reload via loadPlans()
      // This prevents anonymous plans from appearing in wrong tabs
      // set(state => {
      //   const planWithDefaults = ensurePlanDefaults(transformedPlan);
      //   if (planWithDefaults.type === 'anonymous') {
      //     return {
      //       invitations: [planWithDefaults, ...state.invitations]
      //     } as any;
      //   }
      //   return {
      //     activePlans: [planWithDefaults, ...state.activePlans]
      //   } as any;
      // });
      
    } catch (error) {
      console.error('❌ Error creating plan:', error);
      throw error;
    }
  },
  
  // Mark plan as seen via API
  // markPlanAsSeen: async (planId: string) => {
  //   try {
  //     console.log('👁️ Marking plan as seen via API...');
  //     await plansService.markPlanAsSeen(planId);
  //     console.log('✅ Plan marked as seen via API');
  //     
  //     // Update local state to mark as read
  //     set(state => ({
  //       invitations: state.invitations.map(plan => 
  //         plan.id === planId ? { ...plan, isRead: true } : plan
  //       )
  //     }));
  //     
  //   } catch (error) {
  //     console.error('❌ Error marking plan as seen:', error);
  //     throw error;
  //   }
  // },
  
  markAsRead: (planId: string) => {
    // Optimistic local update
    set((state) => ({
      invitations: state.invitations.map(plan =>
        plan.id === planId ? { ...plan, isRead: true } : plan
      ),
      activePlans: state.activePlans.map(plan =>
        plan.id === planId ? { ...plan, isRead: true } : plan
      ),
    }));

    // Persist to Supabase (fire-and-forget)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.id) return;
      supabase
        .from('plan_participants')
        .update({ invitation_seen_at: new Date().toISOString() })
        .eq('plan_id', planId)
        .eq('user_id', user.id)
        .is('invitation_seen_at', null)
        .then(({ error }) => {
          if (error) {
            console.error('❌ [plansStore] markAsRead – Supabase update error:', error);
          }
        });

      // Also update unseenStore invitation count
      useUnseenStore.getState().markInvitationSeen(planId);
    });
  },
  
  respondToPlan: async (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => {
    try {
      // Call API to update status with conditional friends
      const updatedPlan = await plansService.respondToPlan(planId, response, conditionalFriends);
      
      // Transform API response to store format
      const transformedPlan: Plan = {
        id: updatedPlan.id,
        title: updatedPlan.title,
        description: updatedPlan.description,
        type: resolveIsAnonymous(updatedPlan) ? 'anonymous' : 'normal',
        creator: updatedPlan.creator ? {
          id: updatedPlan.creator.id,
          name: updatedPlan.creator.name,
          avatar: updatedPlan.creator.avatar_url || ''
        } : null,
        participants: updatedPlan.participants.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '',
          status: p.status as ParticipantStatus,
          conditionalFriends: p.conditionalFriends
        })),
        date: updatedPlan.date,
        location: updatedPlan.location,
        isRead: true,
        createdAt: updatedPlan.createdAt,
        lastUpdatedAt: updatedPlan.updatedAt,
        hasUnreadUpdates: false,
        completionVotes: updatedPlan.completionVotes || [],
        polls: updatedPlan.polls ? updatedPlan.polls.map(poll => ({
          ...poll,
          expiresAt: poll.expiresAt ? new Date(poll.expiresAt).getTime() : undefined
        })) : []
      };
      
      // Update local state based on response
      set((state) => {
        const planExistsInActive = state.activePlans.some(p => p.id === planId);

        // Keep master plans map in sync for correctness
        const updatedPlansMap = {
          ...state.plans,
          [planId]: transformedPlan
        } as any;

        // If user declined, remove the plan from both invitations and active lists
        if (response === 'declined') {
          return {
            plans: updatedPlansMap,
            invitations: state.invitations.filter(p => p.id !== planId),
            activePlans: state.activePlans.filter(p => p.id !== planId),
            completedPlans: state.completedPlans
          } as any;
        }

        // If response is 'going' | 'maybe' | 'conditional' → ensure in activePlans, remove from invitations
        if (response === 'going' || response === 'maybe' || response === 'conditional') {
          return {
            plans: updatedPlansMap,
            invitations: state.invitations.filter(p => p.id !== planId),
            activePlans: planExistsInActive
              ? state.activePlans.map(p => (p.id === planId ? transformedPlan : p))
              : [...state.activePlans, transformedPlan],
            completedPlans: state.completedPlans
          } as any;
        }

        // Pending → keep under invitations, update there; also update in active if exists (edge case)
        return {
          plans: updatedPlansMap,
          invitations: state.invitations.some(p => p.id === planId)
            ? state.invitations.map(p => (p.id === planId ? transformedPlan : p))
            : [...state.invitations, transformedPlan],
          activePlans: state.activePlans.map(p => (p.id === planId ? transformedPlan : p)),
          completedPlans: state.completedPlans
        } as any;
      });
      
    } catch (error) {
      console.error('❌ Error responding to plan:', error);
      throw error;
    }
  },
  
  addPlan: (plan: Plan) => {
    set((state) => {
      // Ensure plan is marked as unread for highlighting and has completionVotes initialized
      const planWithDefaults = { 
        ...plan, 
        isRead: false,
        completionVotes: []
      };
      
      // If the plan is created by the current user and their status is non-pending, add to active
      const currentUser = plan.participants.find(p => p.id === 'current');
      if (currentUser && (currentUser.status === 'going' || currentUser.status === 'maybe' || currentUser.status === 'conditional')) {
        return {
          invitations: state.invitations,
          activePlans: [planWithDefaults, ...state.activePlans], // Add to top
          completedPlans: state.completedPlans
        };
      }
      
      // Otherwise add to invitations (pending)
      return {
        invitations: [planWithDefaults, ...state.invitations], // Add to top
        activePlans: state.activePlans,
        completedPlans: state.completedPlans
      };
    });
  },
  
  checkConditionalDependencies: (planId: string) => {
    set((state) => {
      // Find the plan in active plans
      const plan = state.activePlans.find(p => p.id === planId);
      if (!plan) return state;
      
      // Get all conditional participants
      const conditionalParticipants = plan.participants.filter(
        p => p.status === 'conditional' && p.conditionalFriends && p.conditionalFriends.length > 0
      );
      
      if (conditionalParticipants.length === 0) return state;
      
      const updatedParticipants = [...plan.participants];
      let hasChanges = false;
      
      // Keep checking until no more changes are made (handles chain reactions)
      let keepChecking = true;
      let maxIterations = 10; // Prevent infinite loops
      let iteration = 0;
      
      while (keepChecking && iteration < maxIterations) {
        keepChecking = false;
        iteration++;
        
        // Build a dependency graph
        const dependencyGraph: Record<string, string[]> = {};
        const reverseDependencyGraph: Record<string, string[]> = {};
        
        // Map all current conditional dependencies
        updatedParticipants.forEach(participant => {
          if (participant.status === 'conditional' && participant.conditionalFriends) {
            dependencyGraph[participant.id] = participant.conditionalFriends;
            
            // Build reverse dependency graph
            participant.conditionalFriends.forEach(friendId => {
              if (!reverseDependencyGraph[friendId]) {
                reverseDependencyGraph[friendId] = [];
              }
              reverseDependencyGraph[friendId].push(participant.id);
            });
          }
        });
        
        // Check each conditional participant
        const participantsToUpdate = [];
        
        for (const participant of updatedParticipants) {
          if (participant.status === 'conditional' && participant.conditionalFriends) {
            const store = get();
            const canBeAccepted = store.canParticipantBeAccepted(
              participant, 
              updatedParticipants, 
              dependencyGraph,
              new Set() // visited set for cycle detection
            );
            
            if (canBeAccepted) {
              participantsToUpdate.push(participant.id);
            }
          }
        }
        
        // Update participants who can be accepted
        participantsToUpdate.forEach(participantId => {
          const index = updatedParticipants.findIndex(p => p.id === participantId);
          if (index !== -1) {
            updatedParticipants[index] = {
              ...updatedParticipants[index],
              status: 'going',
              conditionalFriends: undefined
            };
            hasChanges = true;
            keepChecking = true;
          }
        });
      }
      
      // If there were changes, update the plan
      if (hasChanges) {
        return {
          ...state,
          activePlans: state.activePlans.map(p => 
            p.id === planId 
              ? { ...p, participants: updatedParticipants }
              : p
          )
        };
      }
      
      return state;
    });
  },
  
  // Helper function to determine if a participant can be accepted
  canParticipantBeAccepted: (
    participant: Participant, 
    allParticipants: Participant[], 
    dependencyGraph: Record<string, string[]>,
    visited: Set<string>
  ): boolean => {
    // Prevent infinite recursion in circular dependencies
    if (visited.has(participant.id)) {
      return false;
    }
    
    if (!participant.conditionalFriends || participant.conditionalFriends.length === 0) {
      return false;
    }
    
    visited.add(participant.id);
    
    // Check if all conditional friends are satisfied
    const allFriendsSatisfied = participant.conditionalFriends.every(friendId => {
      const friend = allParticipants.find(p => p.id === friendId);
      if (!friend) return false;
      
      // If friend is already going, condition is met
      if (friend.status === 'going') return true;
      
      // If friend is conditional, check if they can be accepted
      if (friend.status === 'conditional' && friend.conditionalFriends) {
        // Check for mutual dependency (circular)
        if (friend.conditionalFriends.includes(participant.id)) {
          // This is a circular dependency - both can be accepted
          return true;
        }
        
        // Recursively check if the friend can be accepted
        const store = get();
        return store.canParticipantBeAccepted(friend, allParticipants, dependencyGraph, new Set(visited));
      }
      
      return false;
    });
    
    visited.delete(participant.id);
    return allFriendsSatisfied;
  },
  
  // Poll actions - These are now handled via API calls
  // The real-time subscriptions will update the store automatically
  addPoll: (planId: string, poll: Poll) => {
    // This function is kept for backward compatibility but should not be used
    // Polls are now created via API calls
    console.warn('⚠️ addPoll should not be called directly. Use API instead.');
  },
  
  voteOnPollOptimistic: (planId: string, pollId: string, optionIds: string[], userId: string) => {
    console.log('🚀 Optimistic vote update:', { planId, pollId, optionIds, userId });
    
    // Track this optimistic update to avoid duplicate realtime updates
    lastOptimisticUpdate[pollId] = {
      timestamp: Date.now(),
      userId,
      optionIds: [...optionIds].sort() // Sort for consistent comparison
    };
    
    set((state) => {
      // Find the plan in all plan arrays
      const allPlans = [...state.invitations, ...state.activePlans, ...state.completedPlans];
      const planIndex = allPlans.findIndex(p => p.id === planId);
      
      if (planIndex === -1) {
        console.warn('⚠️ Plan not found for optimistic update:', planId);
        return state;
      }
      
      const plan = allPlans[planIndex];
      const pollIndex = plan.polls?.findIndex(p => p.id === pollId) ?? -1;
      
      if (pollIndex === -1) {
        console.warn('⚠️ Poll not found for optimistic update:', pollId);
        return state;
      }
      
      // Create updated plan with optimistic vote
      const updatedPlan = {
        ...plan,
        polls: plan.polls?.map((poll, index) => {
          if (index === pollIndex) {
            return {
              ...poll,
              options: poll.options.map(option => {
                const hasUserVote = optionIds.includes(option.id);
                const currentVotes = option.votes.filter(voteId => voteId !== userId);
                const newVotes = hasUserVote ? [...currentVotes, userId] : currentVotes;
                
                return {
                  ...option,
                  votes: newVotes
                };
              })
            };
          }
          return poll;
        })
      };
      
      // Update the appropriate plan array
      const updatePlanArray = (plans: Plan[]) => {
        return plans.map(p => p.id === planId ? updatedPlan : p);
      };
      
      return {
        invitations: updatePlanArray(state.invitations),
        activePlans: updatePlanArray(state.activePlans),
        completedPlans: updatePlanArray(state.completedPlans)
      };
    });
  },
  
  updatePollOption: (planId: string, pollId: string, optionId: string, newText: string) => {
    // This function is kept for backward compatibility but should not be used
    // Poll options are now updated via API calls
    console.warn('⚠️ updatePollOption should not be called directly. Use API instead.');
  },
  
  removePollOption: (planId: string, pollId: string, optionId: string) => {
    // This function is kept for backward compatibility but should not be used
    // Poll options are now removed via API calls
    console.warn('⚠️ removePollOption should not be called directly. Use API instead.');
  },
  
  addPollOption: (planId: string, pollId: string, optionText: string) => {
    // This function is kept for backward compatibility but should not be used
    // Poll options are now added via API calls
    console.warn('⚠️ addPollOption should not be called directly. Use API instead.');
  },
  
  deletePoll: (planId: string, pollId: string) => {
    // This function is kept for backward compatibility but should not be used
    // Polls are now deleted via API calls
    console.warn('⚠️ deletePoll should not be called directly. Use API instead.');
  },
  
  // Invitation poll actions
  processExpiredInvitationPolls: () => {
    // This function is kept for backward compatibility but should not be used
    // Expired polls are now handled via API
    //console.warn('⚠️ processExpiredInvitationPolls should not be called directly. Use API instead.');
  },
  
  createInvitationPollWithAutoVote: (planId: string, friendIds: string[], friendNames: string[], creatorId: string) => {
    // This function is kept for backward compatibility but should not be used
    // Invitation polls are now created via API calls
   // console.warn('⚠️ createInvitationPollWithAutoVote should not be called directly. Use API instead.');
  },
  
  // Completion actions
  processCompletedPlans: () => {
    const now = new Date();
    const today6AM = new Date();
    today6AM.setHours(6, 0, 0, 0);
    
    // If it's past 6 AM today, check for plans from yesterday that should be completed
    const cutoffTime = now >= today6AM ? today6AM : new Date(today6AM.getTime() - 24 * 60 * 60 * 1000);
    
    set((state) => {
      const userIdCandidates = new Set<string>(['current']);
      if (state.currentUserId) {
        userIdCandidates.add(state.currentUserId);
      }

      const plansToComplete: Plan[] = [];
      const remainingActivePlans: Plan[] = [];
      const remainingInvitations: Plan[] = [];
      
      // Helper function to process plans
      const processPlanList = (planList: Plan[], remainingList: Plan[]) => {
        planList.forEach(plan => {
          // Server is source of truth: if API says plan is still active, keep it in active list
          if (plan.status === 'active') {
            remainingList.push(plan);
            return;
          }
          const planCreatedAt = new Date(plan.createdAt);
          
          // Plan should be completed if created before the cutoff time
          if (planCreatedAt < cutoffTime) {
            // Only include the plan in completed if the current user is a participant
            const currentUser = plan.participants.find(p => userIdCandidates.has(p.id));
            if (currentUser) {
              // Create attendance record based on status
              const attendanceRecord = plan.participants.reduce((record: Record<string, boolean>, participant) => {
                if (participant.status === 'going') {
                  record[participant.id] = true;
                } else if (participant.status === 'declined') {
                  record[participant.id] = false;
                }
                return record;
              }, { ...(plan.attendanceRecord || {}) });

              const completedPlan = {
                ...plan,
                participants: plan.participants,
                attendanceRecord,
                status: 'completed' as const
              };
              
              // Only add if not declined by user
              const userStatus = currentUser.status || 'pending';
              if (userStatus !== 'declined') {
                plansToComplete.push(completedPlan);
              }
            }
          } else {
            remainingList.push(plan);
          }
        });
      };

      // Process active plans
      processPlanList(state.activePlans, remainingActivePlans);
      
      // Process invitations (pending plans)
      processPlanList(state.invitations, remainingInvitations);
      
      // Avoid duplicates when merging with existing completed plans
      const existingIds = new Set(state.completedPlans.map(p => p.id));
      const uniqueNewCompletedPlans = plansToComplete.filter(p => !existingIds.has(p.id));

      return {
        invitations: remainingInvitations,
        activePlans: remainingActivePlans,
        completedPlans: [...uniqueNewCompletedPlans, ...state.completedPlans]
      };
    });
  },
  
  markPlanAsCompleted: (planId: string) => {
    set((state) => {
      const planIndex = state.activePlans.findIndex(p => p.id === planId);
      if (planIndex === -1) return state;
      
      const planToComplete = state.activePlans[planIndex];
      const updatedActivePlans = state.activePlans.filter(p => p.id !== planId);
      
      return {
        invitations: state.invitations,
        activePlans: updatedActivePlans,
        completedPlans: [planToComplete, ...state.completedPlans]
      };
    });
  },
  
  canMarkAsCompleted: (plan: Plan) => {
    const now = new Date();
    const planCreatedAt = new Date(plan.createdAt);
    const fourHoursLater = new Date(planCreatedAt.getTime() + 4 * 60 * 60 * 1000);
    
    // Plan can be marked as completed if it's been 4+ hours AND not already completed
    const votedUsers = plan.completionVotes || [];
    const acceptedParticipants = plan.participants.filter(p => p.status === 'going');
    const maybeParticipants = plan.participants.filter(p => p.status === 'maybe');
    
    // Use new completion logic
    const totalVoteWeight = acceptedParticipants.length * 1 + maybeParticipants.length * 0.25;
    const requiredVoteWeight = Math.ceil(totalVoteWeight * 0.5);
    const requiredMinimumPeople = 2;
    
    const hasEnoughVotes = votedUsers.length >= requiredVoteWeight;
    const hasEnoughPeople = votedUsers.length >= requiredMinimumPeople;
    const isAlreadyCompleted = hasEnoughVotes && hasEnoughPeople;
    
    return now >= fourHoursLater && !isAlreadyCompleted;
  },
  
  restartPlan: (completedPlan: Plan) => {
    const newPlan: Plan = {
      ...completedPlan,
      id: `plan-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isRead: false,
      completionVotes: [], // Reset completion votes
      // Reset all participants to pending status
      participants: completedPlan.participants.map(participant => ({
        ...participant,
        status: participant.id === 'current' ? 'pending' : 'pending' as ParticipantStatus,
        conditionalFriends: undefined
      })),
      // Clear all polls
      polls: []
    };
    
    // Add the new plan to the store
    get().addPlan(newPlan);
    
    return newPlan;
  },
  
  // New completion voting functions
  voteForCompletion: (planId: string, userId: string) => {
    // This function is kept for backward compatibility but should not be used
    // Completion votes are now submitted via API calls
    console.warn('⚠️ voteForCompletion should not be called directly. Use API instead.');
  },
  
  removeCompletionVote: (planId: string, userId: string) => {
    // This function is kept for backward compatibility but should not be used
    // Completion votes are now removed via API calls
    console.warn('⚠️ removeCompletionVote should not be called directly. Use API instead.');
  },
  
  getCompletionVotingStatus: (plan: Plan) => {
    const votedUsers = plan.completionVotes || [];
    const goingParticipants = plan.participants.filter(p => p.status === 'going');
    const maybeParticipants = plan.participants.filter(p => p.status === 'maybe');
    
    // Calculate weighted votes
    const totalVoteWeight = goingParticipants.length * 1 + maybeParticipants.length * 0.25;
    const requiredVoteWeight = Math.ceil(totalVoteWeight * 0.5);
    const requiredMinimumPeople = 2;
    
    const hasUserVoted = votedUsers.includes('current');
    
    // Check if plan is completed (both conditions must be met)
    const hasEnoughVotes = votedUsers.length >= requiredVoteWeight;
    const hasEnoughPeople = votedUsers.length >= requiredMinimumPeople;
    const isCompleted = hasEnoughVotes && hasEnoughPeople;
    
    return {
      votedUsers,
      requiredVotes: Math.max(requiredVoteWeight, requiredMinimumPeople), // Show the higher requirement
      requiredVoteWeight,
      requiredMinimumPeople,
      totalVoteWeight,
      hasUserVoted,
      isCompleted
    };
  },
  
  // Attendance tracking for completed plans
  updateAttendance: (planId: string, userId: string, attended: boolean) => {
    set((state) => ({
      completedPlans: state.completedPlans.map(plan => 
        plan.id === planId
          ? {
              ...plan,
              attendanceRecord: {
                ...plan.attendanceRecord,
                [userId]: attended
              }
            }
          : plan
      )
    }));
  },
  
  // Update tracking functions
  markPlanUpdated: (planId: string, updateType: string) => {
    const now = new Date().toISOString();
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id === planId) {
          return {
            ...plan,
            lastUpdatedAt: now,
            updateType: updateType as Plan['updateType'],
            hasUnreadUpdates: true
          };
        }
        return plan;
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans
      };
    });
  },
  
  markUpdatesAsRead: (planId: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id === planId) {
          return {
            ...plan,
            hasUnreadUpdates: false
          };
        }
        return plan;
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans
      };
    });
  },
  
  getSortedPlans: (plans: Plan[]) => {
    return [...plans].sort((a, b) => {
      // First, sort by hasUnreadUpdates (unread updates first)
      if (a.hasUnreadUpdates && !b.hasUnreadUpdates) return -1;
      if (!a.hasUnreadUpdates && b.hasUnreadUpdates) return 1;
      
      // Then sort by lastUpdatedAt (most recent first)
      const aTime = new Date(a.lastUpdatedAt || a.createdAt).getTime();
      const bTime = new Date(b.lastUpdatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });
  },
  
  // Real-time subscriptions - consolidated channels
  startRealTimeUpdates: async (userId: string) => {
    if (isStartingPlansRealtime) {
      console.log('⏳ Plans real-time startup already in progress');
      return;
    }

    if (get().subscriptionStatus.isSubscribed) {
      console.log('🛑 Plans real-time subscriptions already active');
      return;
    }
    
    // If channel exists but status is not subscribed, clean it up
    if (updatesChannel) {
      console.log('⚠️ Found orphaned channel - cleaning up');
      await stopAllRealtimeChannels();
    }

    console.log('🚀 Starting plans real-time updates...');
    isStartingPlansRealtime = true;

    try {
      // Remember current user for filtering
      set({ currentUserId: userId });

      // Stop any existing channels first
      stopPlansHealthCheck();

      // Load initial data immediately when real-time starts
      console.log('📊 Loading initial plans data...');
      await get().loadPlans(userId);

      // CONSOLIDATED: Single channel for all plan notifications
      // plan_updates table receives all events including plan_created, participant changes, polls, etc.
      updatesChannel = createChannelWithRetry(
        'plan_updates',
        `plan_updates_channel_${userId}_${Date.now()}`,
        (channel) =>
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'plan_updates'
            },
            (payload: any) => {
              console.log('📢 Plan update notification:', payload);
              handlePlanUpdateNotification(payload, userId);
            }
          ),
        (closedChannel) => {
          if (updatesChannel === closedChannel) {
            updatesChannel = null;
          }
        },
        userId
      );

      // NEW: Direct DB listener for participant status changes (chat-style, instant!)
      console.log('🎯 Starting direct participant status listener...');
      const participantsCh = supabase
        .channel(`plan_participants_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'plan_participants'
          },
          async (payload: any) => {
            console.log('👥 Direct participant update received:', payload);
            handleDirectParticipantUpdate(payload, userId);
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Participants channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Direct participant listener connected!');
        } else if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
          console.log('❌ Participants channel disconnected:', status);
            // Simple retry like chat does (no MAX_RETRIES!)
            setTimeout(() => {
              // Stale callback: a newer participantsChannel may already exist after full restart
              if (participantsChannel !== participantsCh) {
                console.log('⏭️ Skipping stale participants channel retry (ref replaced)');
                return;
              }
              if (usePlansStore.getState().subscriptionStatus.isSubscribed) {
                console.log('🔄 Retrying participants channel...');
                participantsChannel = null;
                usePlansStore.getState().checkAndRestartSubscriptions(userId);
              }
            }, 5000);
          }
        });
      participantsChannel = participantsCh;

      // NEW: Direct DB listener for poll votes (chat-style, instant!)
      console.log('🗳️ Starting direct poll votes listener...');
      const pollVotesCh = supabase
        .channel(`plan_poll_votes_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'plan_poll_votes'
          },
          async (payload: any) => {
            console.log('🗳️ Direct poll vote received:', payload);
            handleDirectPollVoteUpdate(payload, userId);
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Poll votes channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Direct poll votes listener connected!');
          } else if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
            console.log('❌ Poll votes channel disconnected:', status);
            // Simple retry like chat does (no MAX_RETRIES!)
            setTimeout(() => {
              if (pollVotesChannel !== pollVotesCh) {
                console.log('⏭️ Skipping stale poll votes channel retry (ref replaced)');
                return;
              }
              if (usePlansStore.getState().subscriptionStatus.isSubscribed) {
                console.log('🔄 Retrying poll votes channel...');
                pollVotesChannel = null;
                usePlansStore.getState().checkAndRestartSubscriptions(userId);
              }
            }, 5000);
          }
        });
      pollVotesChannel = pollVotesCh;

      // NEW: Direct DB listener for poll structure changes (create/edit/delete)
      console.log('📊 Starting direct polls listener...');
      const planPollsCh = supabase
        .channel(`plan_polls_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'plan_polls'
          },
          async (payload: any) => {
            console.log('📊 Direct poll structure update received:', payload);
            handleDirectPollStructureUpdate(payload, userId);
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Polls channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Direct polls listener connected!');
          } else if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
            console.log('❌ Polls channel disconnected:', status);
            setTimeout(() => {
              if (planPollsChannel !== planPollsCh) {
                console.log('⏭️ Skipping stale polls channel retry (ref replaced)');
                return;
              }
              if (usePlansStore.getState().subscriptionStatus.isSubscribed) {
                console.log('🔄 Retrying polls channel...');
                planPollsChannel = null;
                usePlansStore.getState().checkAndRestartSubscriptions(userId);
              }
            }, 5000);
          }
        });
      planPollsChannel = planPollsCh;

      startPlansHealthCheck(userId);

      // Wait a moment for subscription to establish
      setTimeout(() => {
        usePlansStore.getState().setSubscriptionActive(true);
        console.log('✅ Plans real-time subscription started successfully!');
        console.log('🔥 Listening for: plan_updates (all notifications)');
        isStartingPlansRealtime = false;
      }, 1000);

    } catch (error) {
      console.error('❌ Error starting plans real-time updates:', error);
      usePlansStore.getState().setSubscriptionActive(false);
      await stopAllRealtimeChannels();
      isStartingPlansRealtime = false;
    }
  },
  
  stopRealTimeUpdates: () => {
    console.log('🛑 Stopping all plans real-time updates...');

    // Clear all per-plan debounced timeouts
    clearAllPlanRefreshTimeouts();
    stopPlansHealthCheck();

    stopAllRealtimeChannels();
    console.log('✅ All plans real-time updates stopped');
  },

  checkAndRestartSubscriptions: async (userId: string, options?: { force?: boolean }) => {
    console.log('🔍 Checking plans real-time subscription status...');

    const auxPresent =
      !!participantsChannel && !!pollVotesChannel && !!planPollsChannel;

    // plan_updates can look "healthy" while auxiliary channels were nulled by a stale retry
    // or never reattached — do not early-return unless all four channel refs exist.
    if (!options?.force && get().subscriptionStatus.isSubscribed && updatesChannel && auxPresent) {
      console.log('✅ Plans real-time subscription is active');
      return;
    }

    if (!options?.force && get().subscriptionStatus.isSubscribed && updatesChannel && !auxPresent) {
      console.log(
        '⚠️ plan_updates active but auxiliary channel ref(s) missing — restarting subscriptions'
      );
    }

    console.log(options?.force ? '🔄 Force restarting plans subscriptions...' : '🔄 Plans subscription missing or failed - restarting...');

    // Clear any pending timeouts
    clearAllPlanRefreshTimeouts();

    // Stop any existing channels first
    stopPlansHealthCheck();
    await stopAllRealtimeChannels();

    // Restart subscriptions
    await get().startRealTimeUpdates(userId);
  }
}));

// Helper function to stop realtime channel
async function stopAllRealtimeChannels() {
  isStartingPlansRealtime = false;

  if (updatesChannel) {
    try {
      await supabase.removeChannel(updatesChannel);
      console.log('🛑 Stopped plan_updates channel');
    } catch (error) {
      console.error('❌ Error stopping plan_updates channel:', error);
    }
    usePlansStore.getState().updateChannelStatus('plan_updates', 'disconnected');
  }

  // NEW: Stop direct DB listeners
  if (participantsChannel) {
    try {
      await supabase.removeChannel(participantsChannel);
      console.log('🛑 Stopped participants channel');
    } catch (error) {
      console.error('❌ Error stopping participants channel:', error);
    }
  }

  if (pollVotesChannel) {
    try {
      await supabase.removeChannel(pollVotesChannel);
      console.log('🛑 Stopped poll votes channel');
    } catch (error) {
      console.error('❌ Error stopping poll votes channel:', error);
    }
  }

  if (planPollsChannel) {
    try {
      await supabase.removeChannel(planPollsChannel);
      console.log('🛑 Stopped polls channel');
    } catch (error) {
      console.error('❌ Error stopping polls channel:', error);
    }
  }

  updatesChannel = null;
  participantsChannel = null;
  pollVotesChannel = null;
  planPollsChannel = null;
  Object.keys(retryAttempts).forEach((key) => {
    retryAttempts[key] = 0;
  });
  stopPlansHealthCheck();
  usePlansStore.getState().setSubscriptionActive(false);
}

function clearAllPlanRefreshTimeouts() {
  Object.keys(planRefreshTimeouts).forEach((planId) => {
    const timeout = planRefreshTimeouts[planId];
    if (timeout) {
      clearTimeout(timeout);
    }
    delete planRefreshTimeouts[planId];
  });
}

function schedulePlanRefresh(
  planId: string,
  currentUserId: string,
  delay: number,
  reason?: string
) {
  if (!planId) {
    console.warn('⚠️ Cannot schedule plan refresh without planId');
    return;
  }

  if (planRefreshTimeouts[planId]) {
    clearTimeout(planRefreshTimeouts[planId]);
    delete planRefreshTimeouts[planId];
  }

  const triggerRefresh = async () => {
    try {
      const now = Date.now();
      const lastCall = lastPlanRefreshCallTimes[planId] || 0;
      if (now - lastCall < MIN_TIME_BETWEEN_PLAN_CALLS) {
        console.log(
          `⏰ Rate limiting plan refresh for ${planId} (last call ${now - lastCall}ms ago)`
        );
        return;
      }
      lastPlanRefreshCallTimes[planId] = now;

      console.log(
        `🔄 Refreshing plan ${planId} after update${reason ? ` (${reason})` : ''}`
      );
      await usePlansStore.getState().loadPlan(planId, currentUserId);
      console.log('✅ Plan refreshed after update:', planId);
    } catch (error) {
      console.error('❌ Error refreshing plan after update:', error);
      if (error instanceof Error && error.message.includes('429')) {
        console.log(`⚠️ Rate limit hit while refreshing plan ${planId} - backing off`);
      }
    } finally {
      delete planRefreshTimeouts[planId];
    }
  };

  if (delay <= 0) {
    triggerRefresh();
    return;
  }

  planRefreshTimeouts[planId] = setTimeout(triggerRefresh, delay);
}

function createChannelWithRetry(
  channelName: PlansChannelName,
  channelId: string,
  configureChannel: (channel: any) => any,
  onDisconnect: (closedChannel: any) => void,
  userId: string
) {
  usePlansStore.getState().updateChannelStatus(channelName, 'connecting');
  const channel = configureChannel(supabase.channel(channelId));

  channel.subscribe((status: string) => {
    console.log(`📡 ${channelName} status:`, status);

    if (status === 'SUBSCRIBED') {
      console.log(`✅ ${channelName} connected`);
      retryAttempts[channelName] = 0;
      const state = usePlansStore.getState();
      state.updateChannelStatus(channelName, 'connected');
      state.setChannelRetryAttempt(channelName, 0);
      subscriptionMetrics.totalConnections += 1;
      subscriptionMetrics.lastConnectionTime = new Date().toISOString();
      if (reconnectMeasurementStart[channelName]) {
        const duration = Date.now() - reconnectMeasurementStart[channelName];
        reconnectSampleCount += 1;
        subscriptionMetrics.averageReconnectTime =
          (subscriptionMetrics.averageReconnectTime * (reconnectSampleCount - 1) + duration) /
          reconnectSampleCount;
        delete reconnectMeasurementStart[channelName];
      }
      logSubscriptionMetrics();
    } else if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
      console.log(`❌ ${channelName} disconnected:`, status);
      onDisconnect(channel);
      const state = usePlansStore.getState();
      state.updateChannelStatus(channelName, 'disconnected', status);
      state.setSubscriptionActive(false);
      subscriptionMetrics.totalDisconnections += 1;
      subscriptionMetrics.lastDisconnectionTime = new Date().toISOString();
      reconnectMeasurementStart[channelName] = Date.now();
      logSubscriptionMetrics();

      const attempt = retryAttempts[channelName] || 0;

      if (attempt < MAX_CHANNEL_RETRIES) {
        const baseDelay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        console.log(`🔄 Retrying ${channelName} in ${delay.toFixed(0)}ms (attempt ${attempt + 1}/${MAX_CHANNEL_RETRIES})`);

        retryAttempts[channelName] = attempt + 1;
        state.setChannelRetryAttempt(channelName, attempt + 1);
        subscriptionMetrics.totalReconnects += 1;
        logSubscriptionMetrics();

        setTimeout(() => {
          if (
            channelName === 'plan_updates' &&
            updatesChannel != null &&
            updatesChannel !== channel
          ) {
            console.log(`⏭️ Skipping stale ${channelName} retry (ref replaced)`);
            return;
          }
          console.log(`♻️ Attempting to restart ${channelName}...`);
          usePlansStore.getState().checkAndRestartSubscriptions(userId);
        }, delay);
      } else {
        console.warn(`❌ ${channelName} failed after ${MAX_CHANNEL_RETRIES} attempts - giving up`);
        subscriptionMetrics.failedReconnects += 1;
        logSubscriptionMetrics();
      }
    }
  });

  return channel;
}

function startPlansHealthCheck(userId: string) {
  if (plansHealthCheckInterval) {
    return;
  }

  console.log('💓 Starting plans health check system...');
  let failedChecks = 0;

  plansHealthCheckInterval = setInterval(() => {
    // Health check runs silently unless there are issues
    usePlansStore.getState().recordHealthCheck();
    const channelsStatus = [
      { name: 'plan_updates', state: updatesChannel?.state },
      { name: 'participants', state: participantsChannel?.state },
      { name: 'poll_votes', state: pollVotesChannel?.state },
      { name: 'polls', state: planPollsChannel?.state },
    ];

    const planUpdatesHealthy = updatesChannel?.state === 'joined';
    const allHealthy = channelsStatus.every((channel) => channel.state === 'joined');
    const failedChannels = channelsStatus.filter((c) => c.state !== 'joined');

    if (!allHealthy) {
      failedChecks += 1;
      console.log(
        `⚠️ Health check failed (${failedChecks}) - Channel status: ${channelsStatus
          .map((channel) => `${channel.name}: ${channel.state ?? 'null'}`)
          .join(', ')}`
      );

      const auxHealthy =
        participantsChannel?.state === 'joined' &&
        pollVotesChannel?.state === 'joined' &&
        planPollsChannel?.state === 'joined';

      if (planUpdatesHealthy && !auxHealthy && failedChecks >= 1) {
        console.log(
          '🔄 Health check: plan_updates OK but auxiliary realtime broken — restarting subscriptions...'
        );
        usePlansStore.getState().checkAndRestartSubscriptions(userId);
        failedChecks = 0;
      } else if (!planUpdatesHealthy && failedChecks >= 1) {
        console.log('🔄 Failed health check (plan_updates down) - restarting subscriptions...');
        usePlansStore.getState().checkAndRestartSubscriptions(userId);
        failedChecks = 0;
      }
    } else if (failedChecks > 0) {
      // Silently reset failure count when healthy again
      failedChecks = 0;
    }
  }, PLANS_HEALTH_CHECK_INTERVAL);
}

function stopPlansHealthCheck() {
  if (plansHealthCheckInterval) {
    clearInterval(plansHealthCheckInterval);
    plansHealthCheckInterval = null;
    console.log('💓 Plans health check stopped');
  }
}

// Handle plan update notifications - CONSOLIDATED NOTIFICATION SYSTEM
function handlePlanUpdateNotification(payload: any, currentUserId: string) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  console.log('📢 Processing plan update notification:', {
    eventType,
    updateType: newRecord?.update_type,
    planId: newRecord?.plan_id,
    triggeredBy: newRecord?.triggered_by,
    currentUserId
  });

  if (eventType === 'INSERT' && newRecord) {
    const updateType = newRecord.update_type;
    const planId = newRecord.plan_id;

    if (!planId) {
      console.warn('⚠️ Plan update notification missing plan_id, skipping refresh');
      return;
    }

    // Handle different types of plan updates with per-plan debouncing
    if (updateType === 'plan_created') {
      console.log('🎯 New plan created - loading single plan');
      // Load ONLY the new plan, not everything
      usePlansStore.getState().loadPlan(planId, currentUserId).then(() => {
        console.log('✅ New plan loaded and added to list');
        // Fetch unseen counts to show badge
        useUnseenStore.getState().fetchUnseenCounts();
      }).catch(error => {
        console.error('❌ Error loading new plan:', error);
      });
      
      return; 
    }

    // Check if plan exists in store
    const planExists = !!usePlansStore.getState().plans[planId];
    
    // If plan doesn't exist in memory but we got an update (e.g. new message in old plan),
    // we should load it so it appears in the list (bubbled to top)
    if (!planExists) {
      console.log('👻 Update for missing plan detected - reviving plan:', planId);
      usePlansStore.getState().loadPlan(planId, currentUserId).then(() => {
        console.log('✅ Missing plan revived');
        useUnseenStore.getState().fetchUnseenCounts();
      });
      return;
    }

    if (
      updateType === 'participant_joined' ||
      updateType === 'participant_status_changed' ||
      updateType === 'participant_invited'
    ) {
      console.log('👥 Participant activity detected - scheduling refresh');
      schedulePlanRefresh(planId, currentUserId, 1500, updateType);
      // Participant changes affect Control Panel badge
      useUnseenStore.getState().fetchUnseenCounts();
    } else if (updateType === 'poll_voted') {
      console.log('🗳️ Poll vote detected - scheduling faster refresh');
      schedulePlanRefresh(planId, currentUserId, 1000, updateType);
      // Poll votes affect Control Panel badge
      useUnseenStore.getState().fetchUnseenCounts();
    } else if (
      updateType === 'invitation_poll_voted' ||
      updateType === 'invitation_poll_created' ||
      updateType === 'invitation_poll_expired'
    ) {
      console.log('🗳️ Invitation poll activity - scheduling quick refresh');
      schedulePlanRefresh(planId, currentUserId, 750, updateType);
      // Invitation polls affect Control Panel badge
      useUnseenStore.getState().fetchUnseenCounts();
    } else if (
      updateType === 'poll_created' ||
      updateType === 'poll_option_added' ||
      updateType === 'poll_option_removed'
    ) {
      console.log('📊 Poll structure change - scheduling refresh');
      schedulePlanRefresh(planId, currentUserId, 1200, updateType);
      // Poll changes affect Control Panel badge
      useUnseenStore.getState().fetchUnseenCounts();
    } else if (updateType === 'new_message') {
      console.log('💬 New message detected - updating unseen counts');
      // New messages affect Chat badge - immediate update needed
      useUnseenStore.getState().fetchUnseenCounts();
      // No need to refresh the whole plan for just a chat message unless it updates lastUpdatedAt
      schedulePlanRefresh(planId, currentUserId, 2000, updateType);
    } else {
      console.log(`🔄 Other update type (${updateType}) - scheduling default refresh`);
      schedulePlanRefresh(planId, currentUserId, 1000, updateType);
      // Catch-all: update unseen counts for any other relevant updates
      useUnseenStore.getState().fetchUnseenCounts();
    }
  }
}

function logSubscriptionMetrics() {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return;
  }

  const uptime =
    subscriptionMetrics.lastConnectionTime
      ? `${Math.floor(
          (Date.now() - new Date(subscriptionMetrics.lastConnectionTime).getTime()) / 1000
        )}s`
      : 'N/A';

  console.log('📊 Subscription Metrics:', {
    ...subscriptionMetrics,
    uptime
  });
}

// NEW: Direct participant update handler (chat-style, instant!)
function handleDirectParticipantUpdate(payload: any, currentUserId: string) {
  const { new: newData, old: oldData } = payload;
  
  if (!newData || !newData.plan_id || !newData.user_id) {
    console.warn('⚠️ Invalid participant update payload:', payload);
    return;
  }

  const planId = newData.plan_id;
  const userId = newData.user_id;
  const newStatus = newData.status;
  const oldStatus = oldData?.status;

  console.log(`👥 INSTANT participant update: Plan ${planId}, User ${userId}: ${oldStatus} → ${newStatus}`);

  // Update store directly (no API call needed!)
  const store = usePlansStore.getState();
  const plan = store.plans[planId];

  if (!plan) {
    console.log('⚠️ Plan not in store yet, will be loaded via plan_updates notification');
    return;
  }

  // Update participant status in the plan
  const updatedParticipants = plan.participants.map(p => 
    p.id === userId 
      ? { ...p, status: newStatus as ParticipantStatus }
      : p
  );

  const updatedPlan: Plan = {
    ...plan,
    participants: updatedParticipants,
    lastUpdatedAt: new Date().toISOString()
  };

  // Update store (instant, like chat!)
  store.updatePlan(planId, updatedPlan);

  console.log(`✅ INSTANT update complete! Status changed to: ${newStatus}`);
  
  // Update unseen counts
  useUnseenStore.getState().fetchUnseenCounts();
}

// NEW: Direct poll vote update handler (chat-style, instant!)
function handleDirectPollVoteUpdate(payload: any, currentUserId: string) {
  const eventType = payload.eventType;
  const newVote = payload.new;
  const oldVote = payload.old;
  
  console.log(`🗳️ Processing poll vote ${eventType}:`, { newVote, oldVote });

  // Get poll_id and plan_id from the vote
  const pollId = newVote?.poll_id || oldVote?.poll_id;
  const userId = newVote?.user_id || oldVote?.user_id;
  const optionId = newVote?.option_id || oldVote?.option_id;

  if (!pollId || !userId) {
    console.warn('⚠️ Invalid poll vote payload (missing poll_id or user_id):', payload);
    return;
  }

  // Need to get planId from poll - fetch from store
  const store = usePlansStore.getState();
  const allPlans = Object.values(store.plans);
  
  // Find plan that contains this poll
  const plan = allPlans.find(p => p.polls?.some(poll => poll.id === pollId));
  
  if (!plan) {
    console.log('⚠️ Plan with poll not in store yet');
    return;
  }

  const poll = plan.polls?.find(p => p.id === pollId);
  if (!poll) {
    console.log('⚠️ Poll not found in plan');
    return;
  }

  console.log(`🗳️ INSTANT poll vote update for poll ${pollId} in plan ${plan.id}`);

  // Check if this is a duplicate of a recent optimistic update (within 2 seconds)
  const lastOptimistic = lastOptimisticUpdate[pollId];
  if (lastOptimistic && userId === currentUserId) {
    const timeSinceOptimistic = Date.now() - lastOptimistic.timestamp;
    
    if (timeSinceOptimistic < 2000) {
      // Check if the vote state matches the optimistic update
      const currentUserVotes = poll.options
        .filter(opt => opt.votes.includes(userId))
        .map(opt => opt.id)
        .sort();
      
      const optimisticVotes = lastOptimistic.optionIds;
      
      // If votes match, skip this realtime update (it's a duplicate of optimistic)
      if (JSON.stringify(currentUserVotes) === JSON.stringify(optimisticVotes)) {
        console.log(`⏭️ Skipping duplicate realtime update (matches optimistic update from ${timeSinceOptimistic}ms ago)`);
        return;
      }
    }
  }

  // Update poll votes based on event type
  let updatedPoll: Poll;
  
  if (eventType === 'INSERT') {
    // Add vote to option (prevent duplicates)
    updatedPoll = {
      ...poll,
      options: poll.options.map(opt => 
        opt.id === optionId
          ? { ...opt, votes: opt.votes.includes(userId) ? opt.votes : [...opt.votes, userId] }
          : opt
      )
    };
  } else if (eventType === 'DELETE') {
    // Remove vote from option
    updatedPoll = {
      ...poll,
      options: poll.options.map(opt => 
        opt.id === optionId
          ? { ...opt, votes: opt.votes.filter(v => v !== userId) }
          : opt
      )
    };
  } else if (eventType === 'UPDATE') {
    // User changed their vote - remove from old, add to new
    const oldOptionId = oldVote?.option_id;
    updatedPoll = {
      ...poll,
      options: poll.options.map(opt => {
        if (opt.id === oldOptionId) {
          // Remove from old option
          return { ...opt, votes: opt.votes.filter(v => v !== userId) };
        } else if (opt.id === optionId) {
          // Add to new option
          return { ...opt, votes: [...opt.votes.filter(v => v !== userId), userId] };
        }
        return opt;
      })
    };
  } else {
    console.warn('⚠️ Unknown event type:', eventType);
    return;
  }

  // Update plan with new poll
  const updatedPlan: Plan = {
    ...plan,
    polls: plan.polls?.map(p => p.id === pollId ? updatedPoll : p),
    lastUpdatedAt: new Date().toISOString()
  };

  // Update store (instant, like chat!)
  store.updatePlan(plan.id, updatedPlan);

  console.log(`✅ INSTANT poll vote update complete! User ${userId} vote on option ${optionId}`);
  
  // Update unseen counts
  useUnseenStore.getState().fetchUnseenCounts();
}

function handleDirectPollStructureUpdate(payload: any, currentUserId: string) {
  const eventType = payload.eventType;
  const newPoll = payload.new;
  const oldPoll = payload.old;

  const pollId = newPoll?.id || oldPoll?.id;
  const planIdFromPayload = newPoll?.plan_id || oldPoll?.plan_id;

  let planId = planIdFromPayload;
  if (!planId && pollId) {
    const store = usePlansStore.getState();
    const plan = Object.values(store.plans).find((candidate) =>
      candidate.polls?.some((poll) => poll.id === pollId)
    );
    planId = plan?.id;
  }

  if (!planId) {
    console.log('⚠️ Poll update missing plan id, skipping refresh');
    return;
  }

  console.log(`📊 INSTANT poll structure ${eventType} for plan ${planId}`);
  schedulePlanRefresh(planId, currentUserId, 500, 'poll_structure_changed');
  useUnseenStore.getState().fetchUnseenCounts();
}

export default usePlansStore;