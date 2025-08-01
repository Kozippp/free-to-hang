import { create } from 'zustand';
import { useRouter } from 'expo-router';
import { notifyPlanUpdate } from '@/utils/notifications';
import { plansService } from '@/lib/plans-service';
import { supabase } from '@/lib/supabase';

export type ParticipantStatus = 'pending' | 'accepted' | 'maybe' | 'conditional' | 'declined';

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
  
  // API Actions
  loadPlans: (userId?: string) => Promise<void>;
  createPlan: (planData: any) => Promise<void>;
  // markPlanAsSeen: (planId: string) => Promise<void>; // TODO: Enable when backend is ready
  
  // Real-time subscriptions
  startRealTimeUpdates: (userId: string) => void;
  stopRealTimeUpdates: () => void;
  subscribeToUserPlanChannels: (userId: string) => Promise<void>;
  
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
  // Poll voting functions - Now serverless
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
  markPlanAsCompleted: (planId: string) => void;
  canMarkAsCompleted: (plan: Plan) => boolean;
  restartPlan: (completedPlan: Plan) => Plan;
  
  // New completion voting functions
  voteForCompletion: (planId: string, userId: string) => void;
  removeCompletionVote: (planId: string, userId: string) => void;
  getCompletionVotingStatus: (plan: Plan) => {
    votedUsers: string[];
    requiredVotes: number;
    requiredVoteWeight: number;
    requiredMinimumPeople: number;
    totalVoteWeight: number;
    hasUserVoted: boolean;
    isCompleted: boolean;
  };
  
  // Attendance tracking for completed plans
  updateAttendance: (planId: string, userId: string, attended: boolean) => void;
}

// Global variables for real-time subscriptions
let plansChannel: any = null;
let isSubscribed = false;
let isStartingRealTime = false;

const usePlansStore = create<PlansState>((set, get) => ({
  invitations: [],
  activePlans: [],
  completedPlans: [],
  isLoading: false,
  
  // Load plans from API
  loadPlans: async (userId?: string) => {
    try {
      set({ isLoading: true });
      console.log('📋 Loading plans from API...');
      
      const plans = await plansService.getPlans();
      console.log('✅ Plans loaded from API:', plans.length);
      
      // Separate plans into categories based on user's participation status
      const currentUserId = userId || 'unknown';
      
      const invitations: Plan[] = [];
      const activePlans: Plan[] = [];
      const completedPlans: Plan[] = [];
      
      plans.forEach(plan => {
        const userParticipant = plan.participants.find(p => p.id === currentUserId);
        const userStatus = userParticipant?.status || 'pending';
        
        // Transform API plan to store format
        const transformedPlan: Plan = {
          id: plan.id,
          title: plan.title,
          description: plan.description,
          type: plan.isAnonymous ? 'anonymous' : 'normal',
          creator: plan.creator ? {
            id: plan.creator.id,
            name: plan.creator.name,
            avatar: plan.creator.avatar_url || ''
          } : null,
          participants: plan.participants.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar || '',
            status: p.status as ParticipantStatus,
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
        } else if (userStatus === 'accepted' || userStatus === 'maybe' || userStatus === 'conditional') {
          activePlans.push(transformedPlan);
        }
      });
      
      set({
        invitations: invitations.map(ensurePlanDefaults),
        activePlans: activePlans.map(ensurePlanDefaults),
        completedPlans: completedPlans.map(ensurePlanDefaults),
        isLoading: false
      });
      
      // No need for animation triggers here - real-time will handle it
      
    } catch (error) {
      // Handle rate limiting gracefully - don't show error to user
      if (error instanceof Error && error.message === 'RATE_LIMITED') {
        console.log('⚠️ Rate limited - skipping this refresh cycle');
        set({ isLoading: false });
        return; // Silently skip this refresh
      }
      
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
        creator: newPlan.creator ? {
          id: newPlan.creator.id,
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
      
      // Add to active plans since creator is auto-accepted
      set(state => ({
        activePlans: [...state.activePlans, ensurePlanDefaults(transformedPlan)]
      }));
      
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
      console.log('📝 Responding to plan via API...', planId, response);
      
      // Call API to update status with conditional friends
      const updatedPlan = await plansService.respondToPlan(planId, response, conditionalFriends);
      console.log('✅ Plan response updated via API');
      
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
        
        // If response is 'accepted', 'maybe', or 'conditional', move to activePlans
        if (response === 'accepted' || response === 'maybe' || response === 'conditional') {
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
      
      // Anonymous plans always go to invitations (since user didn't create them knowingly)
      if (plan.type === 'anonymous') {
        return {
          invitations: [planWithDefaults, ...state.invitations], // Add to top
          activePlans: state.activePlans,
          completedPlans: state.completedPlans
        };
      }
      
      // If the plan is created by the current user, add it to activePlans
      if (plan.creator?.id === 'current') {
        return {
          invitations: state.invitations,
          activePlans: [planWithDefaults, ...state.activePlans], // Add to top
          completedPlans: state.completedPlans
        };
      }
      
      // Otherwise (received invitation), add it to invitations
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
              status: 'accepted',
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
      
      // If friend is already accepted, condition is met
      if (friend.status === 'accepted') return true;
      
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
  
  // Poll voting functions - Now serverless
  voteOnPoll: (planId: string, pollId: string, optionIds: string[], userId: string) => {
    console.warn('⚠️ voteOnPoll should not be called directly. Use plans-service.ts instead.');
  },
  
  voteOnPollOptimistic: (planId: string, pollId: string, optionIds: string[], userId: string) => {
    console.log('🚀 Optimistic vote update (serverless):', { planId, pollId, optionIds, userId });
    
    set((state) => {
      const updatePlanArray = (plans: Plan[]) => {
        return plans.map(plan => {
          if (plan.id !== planId) return plan;
          
          return {
            ...plan,
            polls: plan.polls?.map(poll => {
              if (poll.id !== pollId) return poll;
              
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
            })
          };
        });
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
    console.warn('⚠️ processExpiredInvitationPolls should not be called directly. Use API instead.');
  },
  
  createInvitationPollWithAutoVote: (planId: string, friendIds: string[], friendNames: string[], creatorId: string) => {
    // This function is kept for backward compatibility but should not be used
    // Invitation polls are now created via API calls
    console.warn('⚠️ createInvitationPollWithAutoVote should not be called directly. Use API instead.');
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
            p.status === 'accepted' || p.status === 'declined'
          );
          
          // Only include the plan in completed if current user responded
          const currentUser = plan.participants.find(p => p.id === 'current');
          if (currentUser && (currentUser.status === 'accepted' || currentUser.status === 'declined')) {
            const completedPlan = {
              ...plan,
              participants: respondedParticipants,
              // Add attendance record - automatically mark "accepted" users as attended
              attendanceRecord: respondedParticipants.reduce((record: Record<string, boolean>, participant) => {
                record[participant.id] = participant.status === 'accepted';
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
    const acceptedParticipants = plan.participants.filter(p => p.status === 'accepted');
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
    const acceptedParticipants = plan.participants.filter(p => p.status === 'accepted');
    const maybeParticipants = plan.participants.filter(p => p.status === 'maybe');
    
    // Calculate weighted votes
    const totalVoteWeight = acceptedParticipants.length * 1 + maybeParticipants.length * 0.25;
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
  
  // Real-time subscriptions
  startRealTimeUpdates: async (userId: string) => {
    if (isStartingRealTime) {
      console.log('🛑 Plans real-time subscription already starting...');
      return;
    }

    if (isSubscribed || plansChannel) {
      console.log('🛑 Plans real-time subscription already active');
      return;
    }

    isStartingRealTime = true;
    
    try {
      console.log('🚀 Starting plans real-time updates with Broadcast system...');
      
      // Stop any existing channel first
      if (plansChannel) {
        console.log('🛑 Stopping existing plans real-time subscription...');
        await supabase.removeChannel(plansChannel);
        plansChannel = null;
        isSubscribed = false;
      }
      
      // Load initial data immediately when real-time starts
      console.log('📊 Loading initial plans data...');
      await get().loadPlans(userId);

      console.log('🚀 Creating real-time channel for user:', userId);
      
      // Set up authentication for Realtime Authorization
      await supabase.realtime.setAuth();
      
      // OPTIMIZED: Create channel for plan_updates only (much smaller data)
      plansChannel = supabase
        .channel(`plans_changes_${userId}_${Date.now()}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'plan_updates' 
        }, (payload) => {
          console.log('🗳️📡 OPTIMIZED PLAN UPDATE:', JSON.stringify(payload, null, 2));
          handleOptimizedPlanUpdate(payload, userId, payload.new?.plan_id);
        })
        .subscribe((status) => {
          console.log('📡 Plans broadcast channel status:', status);
          
          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            console.log('✅ Plans broadcast subscription started successfully');
            console.log('✅ Listening for poll vote, poll, and plan update broadcasts');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Plans broadcast channel error');
            isSubscribed = false;
            plansChannel = null;
          } else if (status === 'CLOSED') {
            isSubscribed = false;
            plansChannel = null;
          } else if (status === 'TIMED_OUT') {
            console.log('⏰ Plans broadcast subscription timed out');
            isSubscribed = false;
            plansChannel = null;
          }
        });

    } catch (error) {
      console.error('❌ Error starting plans broadcast updates:', error);
      isSubscribed = false;
      plansChannel = null;
    } finally {
      isStartingRealTime = false;
    }
  },

  // Subscribe to specific plan channels for a user (simplified version)
  subscribeToUserPlanChannels: async (userId: string) => {
    try {
      console.log('🔗 Broadcast system ready for user plan updates...');
      
      // The broadcast system automatically handles all plan updates
      // through the single channel we created above
      // No need to create individual plan channels
      
    } catch (error) {
      console.error('❌ Error in broadcast subscription:', error);
    }
  },
  
  stopRealTimeUpdates: () => {
    console.log('🛑 Stopping plans real-time updates...');
    
    if (plansChannel) {
      supabase.removeChannel(plansChannel);
      plansChannel = null;
    }
    
    isSubscribed = false;
    console.log('✅ Plans real-time updates stopped');
  }
}));

// Handle real-time postgres changes (for new plans, updates, and deletes)
function handlePostgresChange(payload: any, currentUserId: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE') {
  const { loadPlans } = usePlansStore.getState();
  
  console.log('🗳️ POSTGRES CHANGE HANDLER CALLED:', {
    eventType,
    table: payload.table,
    schema: payload.schema,
    new: payload.new,
    old: payload.old,
    currentUserId
  });

  // Handle different types of postgres changes based on table
  switch (payload.table) {
    case 'poll_votes':
      console.log('🗳️ Poll vote change received - RELOADING PLANS');
      loadPlans(currentUserId);
      break;
      
    case 'plan_polls':
      console.log('📊 Poll change received - RELOADING PLANS');
      loadPlans(currentUserId);
      break;
      
    case 'poll_options':
      console.log('📋 Poll option change received - RELOADING PLANS');
      loadPlans(currentUserId);
      break;
      
    case 'plan_updates':
      console.log('📢 Plan update change received - RELOADING PLANS');
      loadPlans(currentUserId);
      break;
      
    case 'plans':
      console.log('📝 Plan change received - RELOADING PLANS');
      loadPlans(currentUserId);
      break;
      
    case 'plan_participants':
      console.log('👥 Plan participant change received - RELOADING PLANS');
      loadPlans(currentUserId);
      break;
      
    default:
      console.log('❓ Unknown postgres table:', payload.table, '- RELOADING PLANS');
      loadPlans(currentUserId);
      break;
  }
}

// OPTIMIZED: Handle plan-specific updates (smaller data payload)
function handleOptimizedPlanUpdate(payload: any, currentUserId: string, planId: string) {
  console.log('🚀 OPTIMIZED PLAN UPDATE:', {
    planId,
    updateType: payload.new?.update_type,
    metadata: payload.new?.metadata,
    currentUserId
  });

  // Only update specific poll data instead of reloading entire plan
  if (payload.new?.update_type === 'poll_voted') {
    const metadata = payload.new.metadata;
    const pollId = metadata?.poll_id;
    const optionId = metadata?.option_id;
    
    if (pollId && optionId) {
      // Update only the specific poll's vote count
      updatePollVoteOptimistically(planId, pollId, optionId, metadata.action);
    }
  }
}

// OPTIMIZED: Update only poll vote data (no full plan reload)
function updatePollVoteOptimistically(planId: string, pollId: string, optionId: string, action: string) {
  const store = usePlansStore.getState();
  
  // Use Zustand's set method directly
  usePlansStore.setState((state: any) => {
    const updatePlanArray = (plans: Plan[]) => {
      return plans.map(plan => {
        if (plan.id !== planId) return plan;
        
        return {
          ...plan,
          polls: plan.polls?.map(poll => {
            if (poll.id !== pollId) return poll;
            
            return {
              ...poll,
              options: poll.options.map(option => {
                if (option.id !== optionId) return option;
                
                // Update vote count based on action
                let newVotes = [...option.votes];
                if (action === 'INSERT') {
                  // Add vote (simplified - we don't know which user)
                  newVotes.push('unknown_user');
                } else if (action === 'DELETE') {
                  // Remove vote (simplified)
                  newVotes = newVotes.slice(0, -1);
                }
                
                return {
                  ...option,
                  votes: newVotes
                };
              })
            };
          })
        };
      });
    };
    
    return {
      invitations: updatePlanArray(state.invitations),
      activePlans: updatePlanArray(state.activePlans),
      completedPlans: updatePlanArray(state.completedPlans)
    };
  });
}

// Fallback polling for plans with failed real-time connections
const fallbackPollingPlans = new Set<string>();
const fallbackIntervals = new Map<string, NodeJS.Timeout>();

function setFallbackPolling(planId: string, enabled: boolean) {
  if (enabled) {
    fallbackPollingPlans.add(planId);
  } else {
    fallbackPollingPlans.delete(planId);
  }
}

function startFallbackPolling(userId: string, planIds: string[]) {
  // Clear existing intervals
  fallbackIntervals.forEach(interval => clearInterval(interval));
  fallbackIntervals.clear();
  
  // Start polling for plans that need fallback
  planIds.forEach(planId => {
    if (fallbackPollingPlans.has(planId)) {
      console.log(`🔄 Starting fallback polling for plan: ${planId}`);
      
      const interval = setInterval(async () => {
        try {
          // Load only this specific plan
          const { loadPlans } = usePlansStore.getState();
          await loadPlans(userId);
          console.log(`✅ Fallback polling updated plan: ${planId}`);
        } catch (error) {
          console.error(`❌ Fallback polling error for plan ${planId}:`, error);
        }
      }, 30000); // 30 seconds
      
      fallbackIntervals.set(planId, interval as any);
    }
  });
}

export default usePlansStore;