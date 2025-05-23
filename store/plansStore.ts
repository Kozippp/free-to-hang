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
  
  // Invitation poll actions
  processExpiredInvitationPolls: () => void;
  createInvitationPollWithAutoVote: (planId: string, friendIds: string[], friendNames: string[], creatorId: string) => void;
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
      // Find the plan in invitations or active plans
      const invitationPlan = state.invitations.find(p => p.id === planId);
      const activePlan = state.activePlans.find(p => p.id === planId);
      const plan = invitationPlan || activePlan;
      
      if (!plan) return state;
      
      // Update the current user's status in the plan
      const updatedPlan = {
        ...plan,
        participants: plan.participants.map(participant => 
          participant.id === 'current' 
            ? { 
                ...participant, 
                status: response,
                conditionalFriends: conditionalFriends || undefined
              } 
            : participant
        )
      };
      
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
      // Ensure plan is marked as unread for highlighting
      const planWithUnreadStatus = { ...plan, isRead: false };
      
      // Anonymous plans always go to invitations (since user didn't create them knowingly)
      if (plan.type === 'anonymous') {
        return {
          invitations: [planWithUnreadStatus, ...state.invitations], // Add to top
          activePlans: state.activePlans,
          completedPlans: state.completedPlans
        };
      }
      
      // If the plan is created by the current user, add it to activePlans
      if (plan.creator?.id === 'current') {
        return {
          invitations: state.invitations,
          activePlans: [planWithUnreadStatus, ...state.activePlans], // Add to top
          completedPlans: state.completedPlans
        };
      }
      
      // Otherwise (received invitation), add it to invitations
      return {
        invitations: [planWithUnreadStatus, ...state.invitations], // Add to top
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
        return {
          ...plan,
          polls: [...polls, poll]
        };
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
  }
}));

export default usePlansStore;