import { create } from 'zustand';
import { mockInvitations, mockActivePlans, mockCompletedPlans } from '@/constants/mockPlans';
import { useRouter } from 'expo-router';

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
  polls?: Poll[];
  completionVotes?: string[]; // Array of participant IDs who voted for completion
  attendanceRecord?: Record<string, boolean>; // Track attendance for completed plans
}

interface PlansState {
  invitations: Plan[];
  activePlans: Plan[];
  completedPlans: Plan[];
  
  // Actions
  markAsRead: (planId: string) => void;
  respondToPlan: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => void;
  addPlan: (plan: Plan) => void;
  checkConditionalDependencies: (planId: string) => void;
  
  // Helper function for conditional dependencies
  canParticipantBeAccepted: (
    participant: Participant, 
    allParticipants: Participant[], 
    dependencyGraph: Record<string, string[]>,
    visited: Set<string>
  ) => boolean;
  
  // Poll actions
  addPoll: (planId: string, poll: Poll) => void;
  voteOnPoll: (planId: string, pollId: string, optionIds: string[], userId: string) => void;
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
  
  // Demo function to add a completed plan for testing
  addDemoCompletedPlan: () => void;
  
  // Attendance tracking for completed plans
  updateAttendance: (planId: string, userId: string, attended: boolean) => void;
}

const usePlansStore = create<PlansState>((set, get) => ({
  invitations: mockInvitations,
  activePlans: mockActivePlans,
  completedPlans: mockCompletedPlans,
  
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
  
  respondToPlan: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => {
    set((state) => {
      // Find the plan in either invitations or activePlans
      const invitation = state.invitations.find(p => p.id === planId);
      const activePlan = state.activePlans.find(p => p.id === planId);
      const plan = invitation || activePlan;
      
      if (!plan) return state;
      
      const updatedPlan: Plan = {
        ...plan,
        participants: plan.participants.map(participant =>
          participant.id === 'current'
            ? { 
                ...participant, 
                status: response,
                conditionalFriends: response === 'conditional' ? conditionalFriends : undefined
              }
            : participant
        )
      };
      
      // Remove completion vote if user is no longer "accepted"
      if (response !== 'accepted' && updatedPlan.completionVotes?.includes('current')) {
        updatedPlan.completionVotes = updatedPlan.completionVotes.filter(id => id !== 'current');
      }
      
      // If the plan is already in activePlans, just update it there
      if (activePlan) {
        return {
          invitations: state.invitations,
          activePlans: state.activePlans.map(p => p.id === planId ? updatedPlan : p),
          completedPlans: state.completedPlans
        };
      }
      
      // If response is 'accepted' or 'maybe' or 'conditional', move to activePlans
      if (response === 'accepted' || response === 'maybe' || response === 'conditional') {
        return {
          invitations: state.invitations.filter(p => p.id !== planId),
          activePlans: [...state.activePlans, updatedPlan],
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
        invitations: state.invitations.map(p => p.id === planId ? updatedPlan : p),
        activePlans: state.activePlans,
        completedPlans: state.completedPlans
      };
    });
    
    // Check for conditional dependencies after updating
    setTimeout(() => {
      get().checkConditionalDependencies(planId);
    }, 0);
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
  
  // Poll actions
  addPoll: (planId: string, poll: Poll) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId) return plan;
        
        const polls = plan.polls || [];
        
        // Check if this is an update to existing poll
        const existingPollIndex = polls.findIndex(p => p.id === poll.id);
        
        if (existingPollIndex !== -1) {
          // Update existing poll
          const updatedPolls = [...polls];
          updatedPolls[existingPollIndex] = poll;
          return {
            ...plan,
            polls: updatedPolls
          };
        } else {
          // Add new poll
          return {
            ...plan,
            polls: [...polls, poll]
          };
        }
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans.map(updatePlan)
      };
    });
  },
  
  voteOnPoll: (planId: string, pollId: string, optionIds: string[], userId: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId || !plan.polls) return plan;
        
        const updatedPolls = plan.polls.map(poll => {
          if (poll.id !== pollId) return poll;
          
          // Remove user's votes from all options first
          const updatedOptions = poll.options.map(option => ({
            ...option,
            votes: option.votes.filter(id => id !== userId)
          }));
          
          // Then add votes to selected options
          return {
            ...poll,
            options: updatedOptions.map(option => 
              optionIds.includes(option.id)
                ? { ...option, votes: [...option.votes, userId] }
                : option
            )
          };
        });
        
        return {
          ...plan,
          polls: updatedPolls
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans.map(updatePlan)
      };
    });
  },
  
  updatePollOption: (planId: string, pollId: string, optionId: string, newText: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId || !plan.polls) return plan;
        
        const updatedPolls = plan.polls.map(poll => {
          if (poll.id !== pollId) return poll;
          
          return {
            ...poll,
            options: poll.options.map(option => 
              option.id === optionId
                ? { ...option, text: newText }
                : option
            )
          };
        });
        
        return {
          ...plan,
          polls: updatedPolls
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans.map(updatePlan)
      };
    });
  },
  
  removePollOption: (planId: string, pollId: string, optionId: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId || !plan.polls) return plan;
        
        const updatedPolls = plan.polls.map(poll => {
          if (poll.id !== pollId) return poll;
          
          return {
            ...poll,
            options: poll.options.filter(option => option.id !== optionId)
          };
        });
        
        return {
          ...plan,
          polls: updatedPolls
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans.map(updatePlan)
      };
    });
  },
  
  addPollOption: (planId: string, pollId: string, optionText: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId || !plan.polls) return plan;
        
        const updatedPolls = plan.polls.map(poll => {
          if (poll.id !== pollId) return poll;
          
          const newOption: PollOption = {
            id: `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: optionText,
            votes: []
          };
          
          return {
            ...poll,
            options: [...poll.options, newOption]
          };
        });
        
        return {
          ...plan,
          polls: updatedPolls
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans.map(updatePlan)
      };
    });
  },
  
  deletePoll: (planId: string, pollId: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId || !plan.polls) return plan;
        
        const updatedPolls = plan.polls.filter(poll => poll.id !== pollId);
        
        return {
          ...plan,
          polls: updatedPolls
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans.map(updatePlan)
      };
    });
  },
  
  // Invitation poll actions
  processExpiredInvitationPolls: () => {
    set((state) => {
      const currentTime = Date.now();
      
      const updatePlan = (plan: Plan): Plan => {
        if (!plan.polls) return plan;
        
        const expiredInvitationPolls = plan.polls.filter(poll => 
          poll.type === 'invitation' && 
          poll.expiresAt && 
          poll.expiresAt <= currentTime
        );
        
        if (expiredInvitationPolls.length === 0) return plan;
        
        let updatedParticipants = [...plan.participants];
        let updatedPolls = plan.polls.filter(poll => 
          !(poll.type === 'invitation' && poll.expiresAt && poll.expiresAt <= currentTime)
        );
        
        // Process each expired poll
        expiredInvitationPolls.forEach(poll => {
          if (!poll.invitedUsers || poll.invitedUsers.length === 0) return;
          
          const invitedUserId = poll.invitedUsers[0]; // Each poll has one invited user
          
          // Count votes
          const allowVotes = poll.options.find(opt => opt.text === 'Allow')?.votes.length || 0;
          const denyVotes = poll.options.find(opt => opt.text === 'Deny')?.votes.length || 0;
          
          // If majority voted to allow, add the person to participants
          if (allowVotes > denyVotes) {
            // Check if user is not already in participants
            const existingParticipant = updatedParticipants.find(p => p.id === invitedUserId);
            if (!existingParticipant) {
              // Add new participant with pending status
              updatedParticipants.push({
                id: invitedUserId,
                name: `User ${invitedUserId}`, // In real app, get from user store
                avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face`,
                status: 'pending'
              });
            }
          }
          // If majority voted to deny or tie, the person just disappears (no action needed)
        });
        
        return {
          ...plan,
          participants: updatedParticipants,
          polls: updatedPolls
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans
      };
    });
  },
  
  createInvitationPollWithAutoVote: (planId: string, friendIds: string[], friendNames: string[], creatorId: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId) return plan;
        
        const newPolls = [...(plan.polls || [])];
        
        // Create individual invitation polls for each person
        friendIds.forEach((friendId, index) => {
          const friendName = friendNames[index];
          
          const invitationPoll: Poll = {
            id: `invitation-poll-${Date.now()}-${friendId}`,
            question: `Should we invite ${friendName} to this plan?`,
            type: 'invitation',
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
            invitedUsers: [friendId], // Only one user per poll
            options: [
              {
                id: `allow-${Date.now()}-${friendId}`,
                text: 'Allow',
                votes: [creatorId] // Auto-vote for the creator
              },
              {
                id: `deny-${Date.now()}-${friendId}`,
                text: 'Deny',
                votes: []
              }
            ]
          };
          
          newPolls.push(invitationPoll);
        });
        
        return {
          ...plan,
          polls: newPolls
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans
      };
    });
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
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId) return plan;
        
        const currentVotes = plan.completionVotes || [];
        
        // Don't add vote if user already voted
        if (currentVotes.includes(userId)) return plan;
        
        const updatedCompletionVotes = [...currentVotes, userId];
        const updatedPlan = {
          ...plan,
          completionVotes: updatedCompletionVotes
        };
        
        // Use new voting logic to check completion
        const acceptedParticipants = plan.participants.filter(p => p.status === 'accepted');
        const maybeParticipants = plan.participants.filter(p => p.status === 'maybe');
        const totalVoteWeight = acceptedParticipants.length * 1 + maybeParticipants.length * 0.25;
        const requiredVoteWeight = Math.ceil(totalVoteWeight * 0.5);
        const requiredMinimumPeople = 2;
        
        // Check both conditions for completion
        const hasEnoughVotes = updatedCompletionVotes.length >= requiredVoteWeight;
        const hasEnoughPeople = updatedCompletionVotes.length >= requiredMinimumPeople;
        
        // If both conditions met, automatically complete the plan
        if (hasEnoughVotes && hasEnoughPeople) {
          // Move to completed plans immediately
          setTimeout(() => {
            get().markPlanAsCompleted(planId);
          }, 0);
        }
        
        return updatedPlan;
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans
      };
    });
  },
  
  removeCompletionVote: (planId: string, userId: string) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId) return plan;
        
        const currentVotes = plan.completionVotes || [];
        const updatedCompletionVotes = currentVotes.filter(id => id !== userId);
        
        return {
          ...plan,
          completionVotes: updatedCompletionVotes
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans
      };
    });
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
  
  // Demo function to add a completed plan for testing
  addDemoCompletedPlan: () => {
    const demoPlan: Plan = {
      id: `completed-demo-${Date.now()}`,
      title: 'Demo Completed Plan',
      description: 'This is a demo completed plan for testing.',
      type: 'normal' as const,
      creator: {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      },
      participants: [
        {
          id: 'current',
          name: 'You',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          status: 'accepted'
        },
        {
          id: 'demo1',
          name: 'Demo Friend 1',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
          status: 'accepted'
        },
        {
          id: 'demo2',
          name: 'Demo Friend 2',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
          status: 'accepted'
        }
      ],
      date: 'Yesterday, 7:00 PM',
      location: 'Demo Location',
      isRead: true,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      completionVotes: ['current', 'demo1'], // 2 out of 3 voted for completion
      attendanceRecord: {
        'current': true, // User attended
        'demo1': true,   // Friend 1 attended
        'demo2': false   // Friend 2 didn't attend
      },
      polls: [
        {
          id: 'demo-poll-1',
          question: 'What time worked best?',
          type: 'when',
          options: [
            {
              id: 'demo-option-1',
              text: '7:00 PM',
              votes: ['current', 'demo1', 'demo2']
            },
            {
              id: 'demo-option-2',
              text: '8:00 PM',
              votes: ['demo1']
            }
          ]
        }
      ]
    };
    
    set((state) => ({
      ...state,
      completedPlans: [demoPlan, ...state.completedPlans]
    }));
  },
  
  // Attendance tracking for completed plans
  updateAttendance: (planId: string, userId: string, attended: boolean) => {
    set((state) => {
      const updatePlan = (plan: Plan): Plan => {
        if (plan.id !== planId || !plan.attendanceRecord) return plan;
        
        const updatedAttendanceRecord = {
          ...plan.attendanceRecord,
          [userId]: attended
        };
        
        return {
          ...plan,
          attendanceRecord: updatedAttendanceRecord
        };
      };
      
      return {
        invitations: state.invitations.map(updatePlan),
        activePlans: state.activePlans.map(updatePlan),
        completedPlans: state.completedPlans.map(updatePlan)
      };
    });
  }
}));

export default usePlansStore;