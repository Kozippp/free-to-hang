import { API_URL } from '@/constants/config';
import { supabase } from './supabase';

// Enable direct Supabase reads for plans
const ENABLE_DIRECT_PLANS_READ = true;

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

export interface UnseenCountsResponse {
  plans: Record<string, { chat: number; control: number; total: number }>;
  totalUnseen: number;
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

  // Get all user's plans with optional pagination
  async getPlans(status: 'all' | 'active' | 'completed' | 'cancelled' = 'all', limit?: number, offset?: number): Promise<Plan[]> {
    // Use direct Supabase read if enabled
    if (ENABLE_DIRECT_PLANS_READ) {
      return this.getPlansDirect(status, limit, offset);
    }

    // Fallback to API
    try {
      console.log('📋 Fetching plans with status:', status, 'limit:', limit, 'offset:', offset);
      let query = `/plans?status=${status}`;
      if (limit !== undefined) query += `&limit=${limit}`;
      if (offset !== undefined) query += `&offset=${offset}`;
      
      const plans = await this.apiRequest(query);
      console.log('✅ Plans fetched successfully:', plans.length);
      return plans;
    } catch (error) {
      console.error('❌ Error fetching plans:', error);
      throw error;
    }
  }

  // Direct Supabase: Get plans with participants
  private async getPlansDirect(status: 'all' | 'active' | 'completed' | 'cancelled' = 'all', limit?: number, offset?: number): Promise<Plan[]> {
    try {
      console.log('📋 [DIRECT] Fetching plans from Supabase with status:', status, 'limit:', limit, 'offset:', offset);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Build query for plans
      // Note: RLS will automatically filter to only show plans where user is a participant or creator
      let query = supabase
        .from('plans')
        .select(`
          id,
          title,
          description,
          location,
          date,
          is_anonymous,
          max_participants,
          status,
          created_at,
          updated_at,
          creator:creator_id(id, name, username, avatar_url),
          participants:plan_participants(
            id,
            user_id,
            response,
            created_at,
            user:user_id(id, name, username, avatar_url)
          )
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // Apply pagination
      if (limit !== undefined) {
        query = query.limit(limit);
      }
      if (offset !== undefined) {
        query = query.range(offset, offset + (limit || 10) - 1);
      }

      const { data: plans, error } = await query;

      if (error) {
        console.error('❌ [DIRECT] Supabase query error:', error);
        throw error;
      }

      if (!plans) {
        return [];
      }

      // Transform data to match API response format
      const transformedPlans: Plan[] = plans.map((plan: any) => {
        // Map participants
        const participants: PlanParticipant[] = (plan.participants || []).map((p: any) => ({
          id: p.user?.id || p.user_id,
          name: p.user?.name || 'Unknown',
          avatar: p.user?.avatar_url || '',
          status: this.mapParticipantStatus(p.response),
          conditionalFriends: [],
          joinedAt: p.created_at
        }));

        return {
          id: plan.id,
          title: plan.title,
          description: plan.description || '',
          location: plan.location || '',
          date: plan.date,
          isAnonymous: plan.is_anonymous || false,
          maxParticipants: plan.max_participants,
          status: plan.status || 'active',
          creator: plan.creator ? {
            id: plan.creator.id,
            name: plan.creator.name,
            username: plan.creator.username,
            avatar_url: plan.creator.avatar_url || ''
          } : null,
          participants,
          polls: [], // Will be loaded separately if needed
          completionVotes: [],
          userCompletionVote: false,
          attendance: [],
          createdAt: plan.created_at,
          updatedAt: plan.updated_at
        };
      });

      console.log('✅ [DIRECT] Plans fetched successfully from Supabase:', transformedPlans.length);
      return transformedPlans;
    } catch (error) {
      console.error('❌ [DIRECT] Error fetching plans from Supabase:', error);
      throw error;
    }
  }

  // Helper to map database status to frontend status
  private mapParticipantStatus(dbStatus: string): 'pending' | 'going' | 'maybe' | 'declined' | 'conditional' {
    const statusMap: Record<string, 'pending' | 'going' | 'maybe' | 'declined' | 'conditional'> = {
      'pending': 'pending',
      'accepted': 'going',
      'maybe': 'maybe',
      'declined': 'declined',
      'conditional': 'conditional'
    };
    return statusMap[dbStatus] || 'pending';
  }

  // Get specific plan details
  async getPlan(planId: string): Promise<Plan> {
    // Use direct Supabase read if enabled
    if (ENABLE_DIRECT_PLANS_READ) {
      return this.getPlanDirect(planId);
    }

    // Fallback to API
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

  // Direct Supabase: Get single plan with full details (including polls)
  private async getPlanDirect(planId: string): Promise<Plan> {
    try {
      console.log('📋 [DIRECT] Fetching plan details from Supabase:', planId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get plan with all related data
      const { data: plan, error } = await supabase
        .from('plans')
        .select(`
          id,
          title,
          description,
          location,
          date,
          is_anonymous,
          max_participants,
          status,
          created_at,
          updated_at,
          creator:creator_id(id, name, username, avatar_url),
          participants:plan_participants(
            id,
            user_id,
            response,
            created_at,
            user:user_id(id, name, username, avatar_url)
          )
        `)
        .eq('id', planId)
        .single();

      if (error) {
        console.error('❌ [DIRECT] Supabase query error:', error);
        throw error;
      }

      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get polls for this plan
      const { data: polls, error: pollsError } = await supabase
        .from('plan_polls')
        .select(`
          id,
          title,
          poll_type,
          ends_at,
          invited_users,
          created_at,
          created_by,
          creator:created_by(id, name, username, avatar_url),
          options:plan_poll_options(
            id,
            option_text,
            option_order,
            votes:plan_poll_votes(
              id,
              user_id,
              voter:user_id(id, name, avatar_url)
            )
          )
        `)
        .eq('plan_id', planId)
        .order('created_at', { ascending: false });

      if (pollsError) {
        console.error('❌ [DIRECT] Error fetching polls:', pollsError);
      }

      // Transform participants
      const participants: PlanParticipant[] = (plan.participants || []).map((p: any) => ({
        id: p.user?.id || p.user_id,
        name: p.user?.name || 'Unknown',
        avatar: p.user?.avatar_url || '',
        status: this.mapParticipantStatus(p.response),
        conditionalFriends: [],
        joinedAt: p.created_at
      }));

      // Transform polls
      const transformedPolls: Poll[] = (polls || []).map((poll: any) => {
        const options: PollOption[] = (poll.options || []).map((opt: any) => {
          const votes = (opt.votes || []).map((v: any) => v.user_id);
          const voters = (opt.votes || []).map((v: any) => ({
            id: v.voter?.id || v.user_id,
            name: v.voter?.name || 'Unknown',
            avatar: v.voter?.avatar_url || ''
          }));

          return {
            id: opt.id,
            text: opt.option_text,
            votes,
            voters
          };
        });

        return {
          id: poll.id,
          question: poll.title,
          type: poll.poll_type as 'when' | 'where' | 'custom' | 'invitation',
          expiresAt: poll.ends_at,
          invitedUsers: poll.invited_users || [],
          createdBy: poll.creator ? {
            id: poll.creator.id,
            name: poll.creator.name,
            username: poll.creator.username,
            avatar_url: poll.creator.avatar_url || ''
          } : {
            id: poll.created_by,
            name: 'Unknown',
            username: 'unknown',
            avatar_url: ''
          },
          options
        };
      });

      const transformedPlan: Plan = {
        id: plan.id,
        title: plan.title,
        description: plan.description || '',
        location: plan.location || '',
        date: plan.date,
        isAnonymous: plan.is_anonymous || false,
        maxParticipants: plan.max_participants,
        status: plan.status || 'active',
        creator: plan.creator ? {
          id: plan.creator.id,
          name: plan.creator.name,
          username: plan.creator.username,
          avatar_url: plan.creator.avatar_url || ''
        } : null,
        participants,
        polls: transformedPolls,
        completionVotes: [],
        userCompletionVote: false,
        attendance: [],
        createdAt: plan.created_at,
        updatedAt: plan.updated_at
      };

      console.log('✅ [DIRECT] Plan details fetched successfully from Supabase');
      return transformedPlan;
    } catch (error) {
      console.error('❌ [DIRECT] Error fetching plan details from Supabase:', error);
      throw error;
    }
  }

  // Get unified unseen counts for plans (chat + control panel)
  async getUnseenCounts(): Promise<UnseenCountsResponse> {
    try {
      const result = await this.apiRequest('/plans/unseen-counts');
      return result.data || { plans: {}, totalUnseen: 0 };
    } catch (error) {
      console.error('❌ Error fetching unseen counts:', error);
      throw error;
    }
  }

  // Mark control panel updates as seen for a plan
  async markControlPanelSeen(planId: string): Promise<void> {
    try {
      await this.apiRequest(`/plans/${planId}/control-panel/seen`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('❌ Error marking control panel seen:', error);
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

  // Update plan details (title, description)
  async updatePlan(planId: string, payload: { title?: string; description?: string }): Promise<Plan> {
    try {
      console.log('✏️ Updating plan:', planId, 'payload:', payload);
      const updatedPlan = await this.apiRequest(`/plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      console.log('✅ Plan updated successfully:', planId);
      return updatedPlan;
    } catch (error) {
      console.error('❌ Error updating plan:', error);
      throw error;
    }
  }

  // Create poll directly in Supabase (RLS guarded)
  async createPoll(planId: string, pollData: CreatePollData): Promise<Plan> {
    try {
      console.log('📊 Creating poll directly in Supabase for plan:', planId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: poll, error: pollError } = await supabase
        .from('plan_polls')
        .insert({
          plan_id: planId,
          title: pollData.question,
          poll_type: pollData.type || 'custom',
          ends_at: pollData.expiresAt || null,
          invited_users: pollData.invitedUsers || null,
          created_by: user.id
        })
        .select('id')
        .single();

      if (pollError || !poll) {
        throw pollError || new Error('Failed to create poll');
      }

      const optionsToInsert = pollData.options.map((optionText, index) => ({
        poll_id: poll.id,
        option_text: optionText,
        option_order: index
      }));

      const { error: optionsError } = await supabase
        .from('plan_poll_options')
        .insert(optionsToInsert);

      if (optionsError) {
        await supabase.from('plan_polls').delete().eq('id', poll.id);
        throw optionsError;
      }

      console.log('✅ Poll created successfully (Supabase direct)');
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

  // Vote on poll via Edge Function
  async voteOnPoll(planId: string, pollId: string, optionIds: string[]): Promise<void> {
    try {
      console.log('🗳️ Voting on poll via edge function:', { planId, pollId, optionIds });

      const { data, error } = await supabase.functions.invoke('poll-vote', {
        body: { pollId, optionIds }
      });

      if (error) {
        throw new Error(error.message || 'Failed to submit vote');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('✅ Vote submitted successfully via edge function');
    } catch (error) {
      console.error('❌ Error voting on poll:', error);
      throw error;
    }
  }

  // Edit poll via Edge Function (with protected options logic)
  async editPoll(planId: string, pollId: string, question: string, options: string[]): Promise<Plan> {
    try {
      console.log('✏️ Editing poll via edge function:', pollId);

      const { data, error } = await supabase.functions.invoke('poll-edit', {
        body: { pollId, question, options }
      });

      if (error) {
        throw new Error(error.message || 'Failed to edit poll');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('✅ Poll edited successfully via edge function');

      // Return updated plan with the edited poll
      return await this.getPlan(planId);
    } catch (error) {
      console.error('❌ Error editing poll:', error);
      throw error;
    }
  }

  // Delete poll directly in Supabase (RLS guarded)
  async deletePoll(planId: string, pollId: string): Promise<Plan> {
    try {
      console.log('🗑️ Deleting poll directly in Supabase:', pollId);

      const { error } = await supabase
        .from('plan_polls')
        .delete()
        .eq('id', pollId)
        .eq('plan_id', planId);

      if (error) {
        throw error;
      }

      console.log('✅ Poll deleted successfully (Supabase direct)');

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
      const results = await this.apiRequest(`/plans/${planId}/polls/${pollId}/results`);
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
      const polls = await this.apiRequest(`/plans/${planId}/polls`);
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

  // ===== INVITE USERS METHOD =====

  // Directly invite users to a plan (no voting)
  async inviteUsers(planId: string, userIds: string[]): Promise<Plan> {
    try {
      console.log('👥 Inviting users to plan:', planId, 'users:', userIds);
      const plan = await this.apiRequest(`/plans/${planId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ userIds })
      });
      console.log('✅ Users invited successfully');
      return plan;
    } catch (error) {
      console.error('❌ Error inviting users:', error);
      throw error;
    }
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