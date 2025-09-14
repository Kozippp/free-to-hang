import { API_URL } from '@/constants/config';
import { supabase } from './supabase';

// Types matching the backend API
export interface PlanParticipant {
  id: string;
  name: string;
  avatar: string;
  status: 'pending' | 'going' | 'maybe' | 'declined' | 'conditional';
  conditionalFriends?: string[];
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
    // First try to get the current session
    let { data: { session }, error } = await supabase.auth.getSession();
    console.log('🔑 Getting auth headers, session exists:', !!session);
    
    // If no session or session is expired, try to refresh
    if (!session || error) {
      console.log('🔄 No valid session found, attempting to refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.log('❌ Token refresh failed:', refreshError.message);
        throw new Error('Authentication expired. Please sign in again.');
      }
      session = refreshData.session;
      console.log('✅ Token refreshed successfully');
    }
    
    console.log('🔑 Access token exists:', !!session?.access_token);
    if (session?.access_token) {
      console.log('🔑 Token preview:', session.access_token.substring(0, 20) + '...');
    }
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }

  private async apiRequest(endpoint: string, options: RequestInit = {}) {
    try {
      const headers = await this.getAuthHeaders();
      console.log('🌐 Making API request to:', `${API_URL}${endpoint}`);
      console.log('🌐 Headers:', { ...headers, Authorization: headers.Authorization ? 'Bearer [REDACTED]' : 'missing' });
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      });

      console.log('🌐 Response status:', response.status);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        console.log('🌐 Error response:', error);
        
        // Handle authentication errors specifically
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign out and sign back in.');
        }
        
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      // If it's an authentication error, provide clear guidance
      if (error instanceof Error && error.message.includes('Authentication')) {
        throw error;
      }
      // Preserve the actual error for better debugging
      console.error('🌐 API request failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch plans');
    }
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

  // Mark plan as seen (not_seen -> seen)
  // TODO: Enable when backend endpoint is available
  // async markPlanAsSeen(planId: string): Promise<Plan> {
  //   try {
  //     console.log('👁️ Marking plan as seen:', planId);
  //     const plan = await this.apiRequest(`/plans/${planId}/mark-seen`, {
  //       method: 'POST'
  //     });
  //     console.log('✅ Plan marked as seen successfully');
  //     return plan;
  //   } catch (error) {
  //     console.error('❌ Error marking plan as seen:', error);
  //     throw error;
  //   }
  // }

  // Respond to plan invitation
  async respondToPlan(planId: string, response: 'going' | 'maybe' | 'declined' | 'pending' | 'conditional', conditionalFriends?: string[]): Promise<Plan> {
    try {
      // Backend expects { status: ... }
      const body: any = { status: response };

      // ALWAYS send conditionalFriends if status is conditional - even if empty array
      if (response === 'conditional') {
        body.conditionalFriends = conditionalFriends || [];
      }
      
      const plan = await this.apiRequest(`/plans/${planId}/respond`, {
        method: 'POST',
        body: JSON.stringify(body)
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
      const poll = await this.apiRequest(`/polls/${planId}`, {
        method: 'POST',
        body: JSON.stringify(pollData)
      });
      console.log('✅ Poll created successfully');

      // Return updated plan with the new poll
      return await this.getPlan(planId);
    } catch (error) {
      console.error('❌ Error creating poll:', error);
      throw error;
    }
  }

  // Create plan
  async createPlan(body: { title: string; description?: string; location?: string; date: string; isAnonymous?: boolean; invitedFriends?: string[]; }): Promise<Plan> {
    try {
      console.log('📝 Creating plan via backend:', body);
      const plan = await this.apiRequest(`/plans`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      console.log('✅ Plan created via backend');
      return plan;
    } catch (error) {
      console.error('❌ Error creating plan:', error);
      throw error;
    }
  }

  // Vote on poll
  async voteOnPoll(planId: string, pollId: string, optionIds: string[]): Promise<Plan> {
    try {
      console.log('🗳️ Voting on poll:', pollId, 'options:', optionIds);
      await this.apiRequest(`/polls/${planId}/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIds })
      });
      console.log('✅ Vote submitted successfully');

      // Return updated plan with the new vote
      return await this.getPlan(planId);
    } catch (error) {
      console.error('❌ Error voting on poll:', error);
      throw error;
    }
  }

  // Edit poll
  async editPoll(planId: string, pollId: string, question: string, options: string[]): Promise<Plan> {
    try {
      console.log('✏️ Editing poll:', pollId);
      await this.apiRequest(`/polls/${planId}/${pollId}`, {
        method: 'PUT',
        body: JSON.stringify({ question, options })
      });
      console.log('✅ Poll edited successfully');

      // Return updated plan with the edited poll
      return await this.getPlan(planId);
    } catch (error) {
      console.error('❌ Error editing poll:', error);
      throw error;
    }
  }

  // Delete poll
  async deletePoll(planId: string, pollId: string): Promise<Plan> {
    try {
      console.log('🗑️ Deleting poll:', pollId);
      await this.apiRequest(`/polls/${planId}/${pollId}`, {
        method: 'DELETE'
      });
      console.log('✅ Poll deleted successfully');

      // Return updated plan without the deleted poll
      return await this.getPlan(planId);
    } catch (error) {
      console.error('❌ Error deleting poll:', error);
      throw error;
    }
  }

  // Get poll results with winner determination
  async getPollResults(planId: string, pollId: string) {
    try {
      console.log('📊 Getting poll results:', pollId);
      const results = await this.apiRequest(`/polls/${planId}/${pollId}/results`);
      console.log('✅ Poll results retrieved successfully');
      return results;
    } catch (error) {
      console.error('❌ Error getting poll results:', error);
      throw error;
    }
  }

  // Get all polls for a plan (separate from plan details)
  async getPolls(planId: string): Promise<Poll[]> {
    try {
      console.log('📋 Getting polls for plan:', planId);
      const polls = await this.apiRequest(`/polls/${planId}`);
      console.log('✅ Polls retrieved successfully');
      return polls;
    } catch (error) {
      console.error('❌ Error getting polls:', error);
      throw error;
    }
  }

  // Vote for plan completion (deprecated)
  async voteForCompletion(planId: string): Promise<Plan> {
    throw new Error('Completion voting is deprecated. Plans auto-complete after 24h.');
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
  // Note: Real-time subscriptions are now handled in plansStore.ts
  // These functions are kept for backward compatibility but may be removed
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
  return participant?.status === 'going';
}

  // Helper to get completion voting status (deprecated)
getCompletionVotingStatus(plan: Plan) {
  return {
    currentVotes: 0,
    requiredVotes: 0,
    goingParticipants: plan.participants.filter(p => p.status === 'going').length,
    canComplete: false,
    percentage: 0
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