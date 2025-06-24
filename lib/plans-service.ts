import { API_URL } from '@/constants/config';
import { supabase } from './supabase';

// Types matching the backend API
export interface PlanParticipant {
  id: string;
  name: string;
  avatar: string;
  status: 'pending' | 'accepted' | 'maybe' | 'declined';
  joinedAt: string;
}

export interface PlanCreator {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // Array of user IDs
  voters: {
    id: string;
    name: string;
    avatar: string;
  }[];
}

export interface Poll {
  id: string;
  question: string;
  type: 'when' | 'where' | 'custom' | 'invitation';
  expiresAt?: string;
  invitedUsers?: string[];
  createdBy: PlanCreator;
  options: PollOption[];
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  isAnonymous: boolean;
  maxParticipants?: number;
  status: 'active' | 'completed' | 'cancelled';
  creator: PlanCreator | null;
  participants: PlanParticipant[];
  polls: Poll[];
  completionVotes: string[];
  userCompletionVote: boolean;
  attendance: {
    userId: string;
    name: string;
    avatar: string;
    attended: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanData {
  title: string;
  description: string;
  location: string;
  date: string;
  isAnonymous?: boolean;
  maxParticipants?: number;
  invitedFriends?: string[];
}

export interface CreatePollData {
  question: string;
  options: string[];
  type?: 'when' | 'where' | 'custom' | 'invitation';
  expiresAt?: string;
  invitedUsers?: string[];
}

class PlansService {
  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    };
  }

  private async apiRequest(endpoint: string, options: RequestInit = {}) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Get all user's plans
  async getPlans(status: 'all' | 'active' | 'completed' | 'cancelled' = 'all'): Promise<Plan[]> {
    try {
      console.log('📋 Fetching plans with status:', status);
      const plans = await this.apiRequest(`/plans?status=${status}`);
      console.log('✅ Plans fetched successfully:', plans.length);
      return plans;
    } catch (error) {
      console.error('❌ Error fetching plans:', error);
      throw error;
    }
  }

  // Get specific plan details
  async getPlan(planId: string): Promise<Plan> {
    try {
      console.log('📋 Fetching plan details:', planId);
      const plan = await this.apiRequest(`/plans/${planId}`);
      console.log('✅ Plan details fetched successfully');
      return plan;
    } catch (error) {
      console.error('❌ Error fetching plan details:', error);
      throw error;
    }
  }

  // Create new plan
  async createPlan(planData: CreatePlanData): Promise<Plan> {
    try {
      console.log('📝 Creating new plan:', planData.title);
      const plan = await this.apiRequest('/plans', {
        method: 'POST',
        body: JSON.stringify(planData)
      });
      console.log('✅ Plan created successfully:', plan.id);
      return plan;
    } catch (error) {
      console.error('❌ Error creating plan:', error);
      throw error;
    }
  }

  // Respond to plan invitation
  async respondToPlan(planId: string, response: 'accepted' | 'maybe' | 'declined' | 'pending'): Promise<Plan> {
    try {
      console.log('📝 Responding to plan:', planId, 'with:', response);
      const plan = await this.apiRequest(`/plans/${planId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response })
      });
      console.log('✅ Plan response updated successfully');
      return plan;
    } catch (error) {
      console.error('❌ Error responding to plan:', error);
      throw error;
    }
  }

  // Create poll for plan
  async createPoll(planId: string, pollData: CreatePollData): Promise<Plan> {
    try {
      console.log('📊 Creating poll for plan:', planId);
      const plan = await this.apiRequest(`/plans/${planId}/polls`, {
        method: 'POST',
        body: JSON.stringify(pollData)
      });
      console.log('✅ Poll created successfully');
      return plan;
    } catch (error) {
      console.error('❌ Error creating poll:', error);
      throw error;
    }
  }

  // Vote on poll
  async voteOnPoll(planId: string, pollId: string, optionIds: string[]): Promise<Plan> {
    try {
      console.log('🗳️ Voting on poll:', pollId, 'options:', optionIds);
      const plan = await this.apiRequest(`/plans/${planId}/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIds })
      });
      console.log('✅ Vote submitted successfully');
      return plan;
    } catch (error) {
      console.error('❌ Error voting on poll:', error);
      throw error;
    }
  }

  // Vote for plan completion
  async voteForCompletion(planId: string): Promise<Plan> {
    try {
      console.log('✅ Voting for plan completion:', planId);
      const plan = await this.apiRequest(`/plans/${planId}/complete-vote`, {
        method: 'POST'
      });
      console.log('✅ Completion vote submitted successfully');
      return plan;
    } catch (error) {
      console.error('❌ Error voting for completion:', error);
      throw error;
    }
  }

  // Update attendance for completed plan
  async updateAttendance(planId: string, attended: boolean): Promise<Plan> {
    try {
      console.log('📋 Updating attendance for plan:', planId, 'attended:', attended);
      const plan = await this.apiRequest(`/plans/${planId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ attended })
      });
      console.log('✅ Attendance updated successfully');
      return plan;
    } catch (error) {
      console.error('❌ Error updating attendance:', error);
      throw error;
    }
  }

  // Real-time subscription helpers
  subscribeToPlanUpdates(planId: string, callback: (update: any) => void) {
    console.log('🔔 Subscribing to plan updates:', planId);
    
    const channel = supabase
      .channel(`plan-updates-${planId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'plan_updates',
        filter: `plan_id=eq.${planId}`
      }, (payload) => {
        console.log('📡 Received plan update:', payload);
        callback(payload);
      })
      .subscribe();

    return channel;
  }

  // Subscribe to all user's plan updates
  subscribeToUserPlanUpdates(userId: string, callback: (update: any) => void) {
    console.log('🔔 Subscribing to user plan updates:', userId);
    
    const channel = supabase
      .channel(`user-plan-updates-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'plan_updates'
      }, async (payload) => {
        // Check if user has access to this plan
                 try {
           const planId = (payload.new as any)?.plan_id || (payload.old as any)?.plan_id;
           if (planId) {
            // Verify user has access to this plan
            const plan = await this.getPlan(planId);
            if (plan) {
              console.log('📡 Received user plan update:', payload);
              callback(payload);
            }
          }
        } catch (error) {
          // User doesn't have access to this plan, ignore
        }
      })
      .subscribe();

    return channel;
  }

  // Helper to get poll results with winner determination
  getPollResults(poll: Poll) {
    const totalVoters = new Set<string>();
    poll.options.forEach(option => {
      option.votes.forEach(userId => totalVoters.add(userId));
    });

    const totalVotersCount = totalVoters.size;
    const maxVotes = Math.max(...poll.options.map(option => option.votes.length));

    // Calculate winner threshold (simplified version of backend logic)
    const winnerThreshold = Math.max(
      Math.ceil(0.4 * poll.options.length), // Simplified - should use going participants
      Math.ceil(0.7 * totalVotersCount),
      Math.min(3, totalVotersCount)
    );

    const winningOptions = poll.options.filter(option => 
      option.votes.length === maxVotes && 
      option.votes.length >= winnerThreshold &&
      totalVotersCount >= 3
    );

    const winner = winningOptions.length > 0 ? winningOptions[0] : null;

    return {
      totalVotes: totalVotersCount,
      totalVoters: totalVotersCount,
      winner,
      winnerThreshold,
      options: poll.options.map(option => ({
        ...option,
        percentage: totalVotersCount > 0 ? Math.round((option.votes.length / totalVotersCount) * 100) : 0,
        isWinner: winner?.id === option.id
      }))
    };
  }

  // Helper to check if user can vote on polls
  canUserVote(plan: Plan, userId: string): boolean {
    const participant = plan.participants.find(p => p.id === userId);
    return participant?.status === 'accepted';
  }

  // Helper to get completion voting status
  getCompletionVotingStatus(plan: Plan) {
    const goingParticipants = plan.participants.filter(p => p.status === 'accepted');
    const requiredVotes = Math.ceil(0.7 * goingParticipants.length);
    const currentVotes = plan.completionVotes.length;
    
    return {
      currentVotes,
      requiredVotes: Math.max(requiredVotes, 1),
      goingParticipants: goingParticipants.length,
      canComplete: currentVotes >= Math.max(requiredVotes, 1) && goingParticipants.length > 0,
      percentage: goingParticipants.length > 0 ? Math.round((currentVotes / goingParticipants.length) * 100) : 0
    };
  }

  // Helper to format plan data for frontend components
  formatPlanForFrontend(plan: Plan) {
    return {
      id: plan.id,
      title: plan.title,
      description: plan.description,
      type: plan.isAnonymous ? 'anonymous' : 'normal',
      creator: plan.isAnonymous ? null : {
        id: plan.creator?.id || '',
        name: plan.creator?.name || '',
        avatar: plan.creator?.avatar_url || ''
      },
      participants: plan.participants.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        status: p.status,
        joinedAt: p.joinedAt
      })),
      date: plan.date,
      location: plan.location,
      isRead: true, // Default to read when coming from backend
      createdAt: plan.createdAt,
      lastUpdatedAt: plan.updatedAt,
      hasUnreadUpdates: false,
      polls: plan.polls,
      completionVotes: plan.completionVotes,
      attendanceRecord: plan.attendance.reduce((acc, att) => {
        acc[att.userId] = att.attended;
        return acc;
      }, {} as Record<string, boolean>)
    };
  }
}

export const plansService = new PlansService(); 