import { create } from 'zustand';
import { useRouter } from 'expo-router';
import { notifyPlanUpdate } from '@/utils/notifications';
import { plansService } from '@/lib/plans-service';
import { supabase } from '@/lib/supabase';

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
  isRead: boolean;
  createdAt: string;
  lastUpdatedAt?: string; // Track when plan was last updated
  updateType?: 'poll_created' | 'poll_won' | 'new_message' | 'participant_joined' | 'poll_voted'; // Type of last update
  hasUnreadUpdates?: boolean; // Whether there are unread updates
  polls?: Poll[];
  completionVotes?: string[]; // Array of participant IDs who voted for completion
  attendanceRecord?: Record<string, boolean>; // Track attendance for completed plans
}

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
  invitations: Plan[];
  activePlans: Plan[];
  completedPlans: Plan[];
  isLoading: boolean;
  currentUserId?: string;
  
  // API Actions
  loadPlans: (userId?: string) => Promise<void>;
  createPlan: (planData: any) => Promise<void>;
  // markPlanAsSeen: (planId: string) => Promise<void>; // TODO: Enable when backend is ready
  
  // Real-time subscriptions
  startRealTimeUpdates: (userId: string) => Promise<void>;
  stopRealTimeUpdates: () => void;
  checkAndRestartSubscriptions: (userId: string) => Promise<void>;
  
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
  voteOnPoll: (planId: string, pollId: string, optionIds: string[], userId: string) => void;
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
let plansChannel: any = null;
let participantsChannel: any = null;
let pollsChannel: any = null;
let pollOptionsChannel: any = null;
let pollVotesChannel: any = null;
let updatesChannel: any = null;
let attendanceChannel: any = null;
let isSubscribed = false;

// Debouncing for real-time updates to prevent rate limiting
let plansRefreshTimeout: NodeJS.Timeout | null = null;
let participantsRefreshTimeout: NodeJS.Timeout | null = null;
let pollsRefreshTimeout: NodeJS.Timeout | null = null;
let pollVotesRefreshTimeout: NodeJS.Timeout | null = null;

// Track which polls are currently being updated to prevent duplicate requests
let updatingPolls = new Set<string>();

const usePlansStore = create<PlansState>((set, get) => ({
  invitations: [],
  activePlans: [],
  completedPlans: [],
  isLoading: false,
  currentUserId: undefined,
  
  // Load plans from API
  loadPlans: async (userId?: string) => {
    try {
      set({ isLoading: true });
      console.log('📋 Loading plans from API...');
      
      const plans = await plansService.getPlans();
      console.log('✅ Plans loaded from API:', plans.length);
      
      // Separate plans into categories based on user's participation status
      const currentUserId = userId || get().currentUserId || 'unknown';
      
      const invitations: Plan[] = [];
      const activePlans: Plan[] = [];
      const completedPlans: Plan[] = [];
      
      plans.forEach(plan => {
        const userParticipant = plan.participants.find(p => p.id === currentUserId);
        const userStatus = (userParticipant?.status || (userParticipant as any)?.response) || 'pending';
        
        // Transform API plan to store format
        const transformedPlan: Plan = {
          id: plan.id,
          title: plan.title,
          description: plan.description,
          type: plan.isAnonymous ? 'anonymous' : 'normal',
          creator: plan.creator ? {
            id: plan.creator.id === currentUserId ? 'current' : plan.creator.id,
            name: plan.creator.name,
            avatar: plan.creator.avatar_url || ''
          } : null,
          participants: plan.participants.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar || '',
            status: (p.status || (p as any).response) as ParticipantStatus,
            conditionalFriends: p.conditionalFriends
          })),
          date: plan.date,
          location: plan.location,
          isRead: true, // Mark as read for now
          createdAt: plan.createdAt,
          lastUpdatedAt: plan.updatedAt,
          hasUnreadUpdates: false,
          completionVotes: plan.completionVotes || [],
          polls: plan.polls ? plan.polls.map(poll => ({
            ...poll,
            expiresAt: poll.expiresAt ? new Date(poll.expiresAt).getTime() : undefined
          })) : []
        };
        
        if (plan.status === 'completed') {
          completedPlans.push(transformedPlan);
        } else if (userStatus === 'pending') {
          invitations.push(transformedPlan);
        } else if (userStatus === 'going' || userStatus === 'maybe' || userStatus === 'conditional') {
          activePlans.push(transformedPlan);
        }
      });
      
      set({
        invitations: invitations.map(ensurePlanDefaults),
        activePlans: activePlans.map(ensurePlanDefaults),
        completedPlans: completedPlans.map(ensurePlanDefaults),
        isLoading: false
      });
      
    } catch (error) {
      console.error('❌ Error loading plans:', error);
      set({ isLoading: false });
      // Keep mock data on error for now
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
        type: newPlan.isAnonymous ? 'anonymous' : 'normal',
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
    set((state) => ({
      invitations: state.invitations.map(plan => 
        plan.id === planId ? { ...plan, isRead: true } : plan
      ),
      activePlans: state.activePlans.map(plan => 
        plan.id === planId ? { ...plan, isRead: true } : plan
      )
    }));
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
        type: updatedPlan.isAnonymous ? 'anonymous' : 'normal',
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
        // Find the plan in either invitations or activePlans
        const invitation = state.invitations.find(p => p.id === planId);
        const activePlan = state.activePlans.find(p => p.id === planId);
        
        // If the plan is already in activePlans, just update it there
        if (activePlan) {
          return {
            invitations: state.invitations,
            activePlans: state.activePlans.map(p => p.id === planId ? transformedPlan : p),
            completedPlans: state.completedPlans
          };
        }
        
        // If response is 'going', 'maybe', or 'conditional', move to activePlans
        if (response === 'going' || response === 'maybe' || response === 'conditional') {
          return {
            invitations: state.invitations.filter(p => p.id !== planId),
            activePlans: [...state.activePlans, transformedPlan],
            completedPlans: state.completedPlans
          };
        }
        
        // If response is 'declined', remove from invitations
        if (response === 'declined') {
          return {
            invitations: state.invitations.filter(p => p.id !== planId),
            activePlans: state.activePlans,
            completedPlans: state.completedPlans
          };
        }
        
        // If response is 'pending', keep in invitations but update the status
        return {
          invitations: state.invitations.map(p => p.id === planId ? transformedPlan : p),
          activePlans: state.activePlans,
          completedPlans: state.completedPlans
        };
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
  
  voteOnPoll: (planId: string, pollId: string, optionIds: string[], userId: string) => {
    // This function is kept for backward compatibility but should not be used
    // Poll votes are now submitted via API calls
    console.warn('⚠️ voteOnPoll should not be called directly. Use API instead.');
  },
  
  voteOnPollOptimistic: (planId: string, pollId: string, optionIds: string[], userId: string) => {
    console.log('🚀 Optimistic vote update:', { planId, pollId, optionIds, userId });
    
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
      const plansToComplete: Plan[] = [];
      const remainingActivePlans: Plan[] = [];
      
      state.activePlans.forEach(plan => {
        const planCreatedAt = new Date(plan.createdAt);
        
        // Plan should be completed if created before the cutoff time
        if (planCreatedAt < cutoffTime) {
          // Filter participants based on their response
          const respondedParticipants = plan.participants.filter(p => 
            p.status === 'going' || p.status === 'declined'
          );
          
          // Only include the plan in completed if current user responded
          const currentUser = plan.participants.find(p => p.id === 'current');
          if (currentUser && (currentUser.status === 'going' || currentUser.status === 'declined')) {
            const completedPlan = {
              ...plan,
              participants: respondedParticipants,
              // Add attendance record - automatically mark "going" users as attended
              attendanceRecord: respondedParticipants.reduce((record: Record<string, boolean>, participant) => {
                record[participant.id] = participant.status === 'going';
                return record;
              }, {}),
            };
            
            plansToComplete.push(completedPlan);
          }
          // If current user didn't respond, plan won't appear in completed plans
        } else {
          remainingActivePlans.push(plan);
        }
      });
      
      return {
        invitations: state.invitations,
        activePlans: remainingActivePlans,
        completedPlans: [...plansToComplete, ...state.completedPlans]
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
          // Saada teavitus kui see pole kasutaja enda tegevus
          if (plan.creator?.id !== 'current') {
            notifyPlanUpdate(plan.title, updateType);
          }
          
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
  
  // Real-time subscriptions - separate channels for each table
  startRealTimeUpdates: async (userId: string) => {
    if (isSubscribed) {
      console.log('🛑 Plans real-time subscriptions already active');
      return;
    }

    console.log('🚀 Starting plans real-time updates with separate channels...');

    try {
      // Remember current user for filtering
      set({ currentUserId: userId });

      // Stop any existing channels first
      await stopAllRealtimeChannels();

      // Load initial data immediately when real-time starts
      console.log('📊 Loading initial plans data...');
      await get().loadPlans(userId);

      // Get user's plans for filtering other subscriptions
      const userPlans = await plansService.getPlans();
      const userPlanIds = userPlans.map(plan => plan.id);

      // 0. PLANS CHANNEL - Listen for new plans (main table INSERT events)
      plansChannel = supabase
        .channel(`plans_channel_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'plans'
          },
          (payload) => {
            console.log('🆕 New plan INSERT event:', payload);
            handlePlansInsert(payload, userId);
          }
        )
        .subscribe((status) => {
          console.log('📡 Plans channel status:', status);

          if (status === 'SUBSCRIBED') {
            console.log('✅ Plans channel subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Plans channel error - marking as unsubscribed');
            isSubscribed = false;
            plansChannel = null;
          } else if (status === 'CLOSED') {
            console.log('🔒 Plans channel closed - marking as unsubscribed');
            isSubscribed = false;
            plansChannel = null;
          } else if (status === 'TIMED_OUT') {
            console.log('⏰ Plans channel timed out - marking as unsubscribed');
            isSubscribed = false;
            plansChannel = null;
          }
        });

      // 1. PLAN UPDATES CHANNEL - The main notification system
      updatesChannel = supabase
        .channel(`plan_updates_channel_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'plan_updates'
          },
          (payload) => {
            console.log('📢 Plan update notification:', payload);
            handlePlanUpdateNotification(payload, userId);
          }
        )
        .subscribe((status) => {
          console.log('📡 Plan updates channel status:', status);

          if (status === 'SUBSCRIBED') {
            console.log('✅ Plan updates channel subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Plan updates channel error - marking as unsubscribed');
            isSubscribed = false;
            updatesChannel = null;
          } else if (status === 'CLOSED') {
            console.log('🔒 Plan updates channel closed - marking as unsubscribed');
            isSubscribed = false;
            updatesChannel = null;
          } else if (status === 'TIMED_OUT') {
            console.log('⏰ Plan updates channel timed out - marking as unsubscribed');
            isSubscribed = false;
            updatesChannel = null;
          }
        });

      // 2. PARTICIPANTS CHANNEL - Listen for participant changes in user's plans
      participantsChannel = supabase
        .channel(`participants_channel_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'plan_participants'
          },
          (payload) => {
            console.log('👥 Participants table change:', payload);
            handleParticipantsChange(payload, userId);
          }
        )
        .subscribe((status) => {
          console.log('📡 Participants channel status:', status);

          if (status === 'SUBSCRIBED') {
            console.log('✅ Participants channel subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Participants channel error - marking as unsubscribed');
            isSubscribed = false;
            participantsChannel = null;
          } else if (status === 'CLOSED') {
            console.log('🔒 Participants channel closed - marking as unsubscribed');
            isSubscribed = false;
            participantsChannel = null;
          } else if (status === 'TIMED_OUT') {
            console.log('⏰ Participants channel timed out - marking as unsubscribed');
            isSubscribed = false;
            participantsChannel = null;
          }
        });

      // 3. POLLS CHANNEL - Listen for polls in user's plans
      pollsChannel = supabase
        .channel(`polls_channel_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'plan_polls'
          },
          (payload) => {
            console.log('📊 Polls table change:', payload);
            handlePollsChange(payload, userId);
          }
        )
        .subscribe((status) => {
          console.log('📡 Polls channel status:', status);

          if (status === 'SUBSCRIBED') {
            console.log('✅ Polls channel subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Polls channel error - marking as unsubscribed');
            isSubscribed = false;
            pollsChannel = null;
          } else if (status === 'CLOSED') {
            console.log('🔒 Polls channel closed - marking as unsubscribed');
            isSubscribed = false;
            pollsChannel = null;
          } else if (status === 'TIMED_OUT') {
            console.log('⏰ Polls channel timed out - marking as unsubscribed');
            isSubscribed = false;
            pollsChannel = null;
          }
        });

      // 4. POLL VOTES CHANNEL - Listen for vote changes
      pollVotesChannel = supabase
        .channel(`poll_votes_channel_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'plan_poll_votes'
          },
          (payload) => {
            console.log('🗳️ Poll votes change:', payload);
            handlePollVotesChange(payload, userId);
          }
        )
        .subscribe((status) => {
          console.log('📡 Poll votes channel status:', status);

          if (status === 'SUBSCRIBED') {
            console.log('✅ Poll votes channel subscribed successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Poll votes channel error - marking as unsubscribed');
            isSubscribed = false;
            pollVotesChannel = null;
          } else if (status === 'CLOSED') {
            console.log('🔒 Poll votes channel closed - marking as unsubscribed');
            isSubscribed = false;
            pollVotesChannel = null;
          } else if (status === 'TIMED_OUT') {
            console.log('⏰ Poll votes channel timed out - marking as unsubscribed');
            isSubscribed = false;
            pollVotesChannel = null;
          }
        });

      // Wait a moment for all subscriptions to establish
      setTimeout(() => {
        isSubscribed = true;
        console.log('✅ Plans real-time subscriptions started successfully!');
        console.log('🔥 Listening for:');
        console.log('  🆕 plans - new plan INSERT events');
        console.log('  📢 plan_updates - main notification system');
        console.log('  👥 participants - status changes in user plans');
        console.log('  📊 polls - new polls in user plans');
        console.log('  🗳️ poll_votes - vote changes');
      }, 1000);

    } catch (error) {
      console.error('❌ Error starting plans real-time updates:', error);
      isSubscribed = false;
      await stopAllRealtimeChannels();
    }
  },
  
  stopRealTimeUpdates: () => {
    console.log('🛑 Stopping all plans real-time updates...');

    // Clear all debounced timeouts
    if (plansRefreshTimeout) {
      clearTimeout(plansRefreshTimeout);
      plansRefreshTimeout = null;
    }
    if (participantsRefreshTimeout) {
      clearTimeout(participantsRefreshTimeout);
      participantsRefreshTimeout = null;
    }
    if (pollsRefreshTimeout) {
      clearTimeout(pollsRefreshTimeout);
      pollsRefreshTimeout = null;
    }
    if (pollVotesRefreshTimeout) {
      clearTimeout(pollVotesRefreshTimeout);
      pollVotesRefreshTimeout = null;
    }

    // Clear updating polls set
    updatingPolls.clear();

    stopAllRealtimeChannels();
    console.log('✅ All plans real-time updates stopped');
  },

  checkAndRestartSubscriptions: async (userId: string) => {
    console.log('🔍 Checking plans real-time subscriptions status...');

    // If already subscribed and all channels exist, no need to restart
    if (isSubscribed && plansChannel && updatesChannel && participantsChannel && pollsChannel && pollVotesChannel) {
      console.log('✅ All plans real-time subscriptions are active');
      return;
    }

    console.log('🔄 Plans subscriptions missing or failed - restarting...');

    // Clear any pending timeouts
    if (plansRefreshTimeout) {
      clearTimeout(plansRefreshTimeout);
      plansRefreshTimeout = null;
    }
    if (participantsRefreshTimeout) {
      clearTimeout(participantsRefreshTimeout);
      participantsRefreshTimeout = null;
    }
    if (pollsRefreshTimeout) {
      clearTimeout(pollsRefreshTimeout);
      pollsRefreshTimeout = null;
    }
    if (pollVotesRefreshTimeout) {
      clearTimeout(pollVotesRefreshTimeout);
      pollVotesRefreshTimeout = null;
    }

    // Stop any existing channels first
    await stopAllRealtimeChannels();

    // Restart subscriptions
    await get().startRealTimeUpdates(userId);
  }
}));

// Helper function to stop all realtime channels
async function stopAllRealtimeChannels() {
  const channels = [plansChannel, updatesChannel, participantsChannel, pollsChannel, pollVotesChannel];
  const channelNames = ['plans', 'plan_updates', 'participants', 'polls', 'poll_votes'];

  for (let i = 0; i < channels.length; i++) {
    if (channels[i]) {
      try {
        await supabase.removeChannel(channels[i]);
        console.log(`🛑 Stopped ${channelNames[i]} channel`);
      } catch (error) {
        console.error(`❌ Error stopping ${channelNames[i]} channel:`, error);
      }
      channels[i] = null;
    }
  }

  isSubscribed = false;
}

// Handle plans table INSERT events
function handlePlansInsert(payload: any, currentUserId: string) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  console.log('📋 Processing plans INSERT event:', {
    eventType,
    planId: newRecord?.id,
    title: newRecord?.title,
    creatorId: newRecord?.creator_id,
    currentUserId
  });

  if (eventType === 'INSERT' && newRecord) {
    console.log('🎯 New plan inserted - refreshing plans data');

    // Reload plans data to include the new plan
    const { loadPlans } = usePlansStore.getState();
    loadPlans(currentUserId).then(() => {
      console.log('✅ Plans refreshed after new plan INSERT');
    }).catch(error => {
      console.error('❌ Error refreshing plans after INSERT:', error);
    });
  }
}

// Handle plan update notifications - MAIN NOTIFICATION SYSTEM
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
    const triggeredBy = newRecord.triggered_by;

    // Debounced refresh to prevent rate limiting
    const debouncedRefresh = () => {
      const { loadPlans } = usePlansStore.getState();
      console.log('🔄 Debounced refresh triggered for update type:', updateType);

      loadPlans(currentUserId).then(() => {
        console.log('✅ Plans refreshed after update:', updateType);
      }).catch(error => {
        console.error('❌ Error refreshing plans after update:', error);
      });
    };

    // Clear existing timeout
    if (plansRefreshTimeout) {
      clearTimeout(plansRefreshTimeout);
    }

    // Handle different types of plan updates with debouncing
    if (updateType === 'plan_created') {
      console.log('🎯 New plan created - immediate refresh needed');
      debouncedRefresh(); // Immediate for new plans
    } else if (updateType === 'participant_joined') {
      console.log('👥 Participant joined/changed status - debounced refresh');
      plansRefreshTimeout = setTimeout(debouncedRefresh, 1000); // 1 second debounce
    } else if (updateType === 'poll_created' || updateType === 'poll_voted') {
      console.log('📊 Poll activity - debounced refresh');
      plansRefreshTimeout = setTimeout(debouncedRefresh, 1500); // 1.5 second debounce
    } else {
      console.log(`🔄 Other update type (${updateType}) - debounced refresh`);
      plansRefreshTimeout = setTimeout(debouncedRefresh, 1000); // 1 second debounce
    }
  }
}

// Handle participants table changes
function handleParticipantsChange(payload: any, currentUserId: string) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  console.log('👥 Processing participants table change:', { eventType, currentUserId });

  // Debounced refresh to prevent rate limiting
  const debouncedRefresh = () => {
    const { loadPlans } = usePlansStore.getState();
    loadPlans(currentUserId).then(() => {
      console.log('✅ Plans updated after participants table change');
    }).catch(error => {
      console.error('❌ Error updating plans after participants table change:', error);
    });
  };

  // Clear existing timeout
  if (participantsRefreshTimeout) {
    clearTimeout(participantsRefreshTimeout);
  }

  // Debounce participants changes by 2 seconds
  participantsRefreshTimeout = setTimeout(debouncedRefresh, 2000);
}

// Handle polls table changes
function handlePollsChange(payload: any, currentUserId: string) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  console.log('📊 Processing polls table change:', { eventType, currentUserId });

  // Debounced refresh to prevent rate limiting
  const debouncedRefresh = () => {
    const { loadPlans } = usePlansStore.getState();
    loadPlans(currentUserId).then(() => {
      console.log('✅ Plans updated after polls table change');
    }).catch(error => {
      console.error('❌ Error updating plans after polls table change:', error);
    });
  };

  // Clear existing timeout
  if (pollsRefreshTimeout) {
    clearTimeout(pollsRefreshTimeout);
  }

  // Debounce polls changes by 1.5 seconds
  pollsRefreshTimeout = setTimeout(debouncedRefresh, 1500);
}

// Handle poll votes changes - now updates only specific poll
function handlePollVotesChange(payload: any, currentUserId: string) {
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const pollId = newRecord?.poll_id || oldRecord?.poll_id;

  console.log('🗳️ Processing poll votes change:', {
    eventType,
    pollId,
    currentUserId,
    currentlyUpdating: Array.from(updatingPolls)
  });

  if (newRecord && pollId) {
    // Check if this poll is already being updated
    if (updatingPolls.has(pollId)) {
      console.log('⚠️ Poll already updating, skipping duplicate request:', pollId);
      return;
    }

    // Mark this poll as being updated
    updatingPolls.add(pollId);

    const debouncedRefresh = async () => {
      try {
        console.log('🔄 Starting poll update for:', pollId);
        const { loadPlans } = usePlansStore.getState();
        await loadPlans(currentUserId);
        console.log('✅ Plans updated after poll votes change for poll:', pollId);
      } catch (error) {
        console.error('❌ Error updating plans after poll votes change:', error);
        // Check if it's a rate limit error
        if (error instanceof Error && error.message.includes('429')) {
          console.log('⏰ Rate limit hit, will retry later for poll:', pollId);
          // Could implement retry logic here
        }
      } finally {
        // Always remove from updating set
        updatingPolls.delete(pollId);
        console.log('🧹 Cleaned up updating poll:', pollId, 'Remaining:', Array.from(updatingPolls));
      }
    };

    // Clear existing timeout
    if (pollVotesRefreshTimeout) {
      clearTimeout(pollVotesRefreshTimeout);
    }

    // Longer debounce time to prevent rate limiting - 2000ms
    console.log('⏰ Setting debounce timeout for poll:', pollId, 'Duration: 2000ms');
    pollVotesRefreshTimeout = setTimeout(debouncedRefresh, 2000);
  }
}

export default usePlansStore;