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
  
  // Poll actions
  addPoll: (planId: string, poll: Poll) => void;
  voteOnPoll: (planId: string, pollId: string, optionIds: string[], userId: string) => void;
  updatePollOption: (planId: string, pollId: string, optionId: string, newText: string) => void;
  removePollOption: (planId: string, pollId: string, optionId: string) => void;
  addPollOption: (planId: string, pollId: string, optionText: string) => void;
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
      // Anonymous plans always go to invitations (since user didn't create them knowingly)
      if (plan.type === 'anonymous') {
        return {
          invitations: [plan, ...state.invitations], // Add to top
          activePlans: state.activePlans,
          completedPlans: state.completedPlans
        };
      }
      
      // If the plan is created by the current user, add it to activePlans
      if (plan.creator?.id === 'current') {
        return {
          invitations: state.invitations,
          activePlans: [plan, ...state.activePlans], // Add to top
          completedPlans: state.completedPlans
        };
      }
      
      // Otherwise, add it to invitations
      return {
        invitations: [plan, ...state.invitations], // Add to top
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
      
      // Check for circular dependencies
      const updatedParticipants = [...plan.participants];
      let hasChanges = false;
      
      // For each conditional participant
      conditionalParticipants.forEach(participant => {
        if (!participant.conditionalFriends) return;
        
        // Check if all their conditional friends are either:
        // 1. Already accepted
        // 2. Conditional on this participant (circular dependency)
        const allConditionsMet = participant.conditionalFriends.every(friendId => {
          const friend = plan.participants.find(p => p.id === friendId);
          if (!friend) return false;
          
          if (friend.status === 'accepted') return true;
          
          // Check for circular dependency
          if (friend.status === 'conditional' && friend.conditionalFriends) {
            return friend.conditionalFriends.includes(participant.id);
          }
          
          return false;
        });
        
        // If all conditions are met, update this participant to 'accepted'
        if (allConditionsMet) {
          const index = updatedParticipants.findIndex(p => p.id === participant.id);
          if (index !== -1) {
            updatedParticipants[index] = {
              ...updatedParticipants[index],
              status: 'accepted',
              conditionalFriends: undefined
            };
            hasChanges = true;
            
            // Also update any friends who were conditional on this participant
            participant.conditionalFriends.forEach(friendId => {
              const friendIndex = updatedParticipants.findIndex(p => p.id === friendId);
              if (friendIndex !== -1 && updatedParticipants[friendIndex].status === 'conditional') {
                const friend = updatedParticipants[friendIndex];
                if (friend.conditionalFriends && friend.conditionalFriends.includes(participant.id)) {
                  updatedParticipants[friendIndex] = {
                    ...updatedParticipants[friendIndex],
                    status: 'accepted',
                    conditionalFriends: undefined
                  };
                }
              }
            });
          }
        }
      });
      
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
  }
}));

export default usePlansStore;