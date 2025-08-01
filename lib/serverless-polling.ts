import { supabase } from './supabase';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // Array of user IDs who voted for this option
}

export interface Poll {
  id: string;
  question: string;
  poll_type: 'when' | 'where' | 'custom' | 'invitation';
  options: PollOption[];
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface PollStats {
  poll_id: string;
  total_votes: number;
  total_participants: number;
  options: Array<{
    id: string;
    text: string;
    votes: number;
    percentage: number;
    voters: string[];
  }>;
}

export interface CreatePollData {
  plan_id: string;
  question: string;
  poll_type?: 'when' | 'where' | 'custom' | 'invitation';
  options?: Array<{ text: string }>;
  expires_at?: string;
}

export interface VotePollData {
  poll_id: string;
  option_ids: string[];
}

class ServerlessPolling {
  /**
   * Create a new poll using Supabase RPC
   */
  async createPoll(data: CreatePollData): Promise<string> {
    try {
      const { data: pollId, error } = await supabase.rpc('create_poll_serverless', {
        p_plan_id: data.plan_id,
        p_question: data.question,
        p_poll_type: data.poll_type || 'custom',
        p_options: data.options || [],
        p_expires_at: data.expires_at || null
      });

      if (error) {
        console.error('❌ Error creating poll:', error);
        throw new Error(error.message);
      }

      console.log('✅ Poll created successfully:', pollId);
      return pollId;
    } catch (error) {
      console.error('❌ Failed to create poll:', error);
      throw error;
    }
  }

  /**
   * Vote on a poll using Supabase RPC
   */
  async voteOnPoll(data: VotePollData): Promise<PollStats> {
    try {
      const { data: stats, error } = await supabase.rpc('vote_on_poll_serverless', {
        p_poll_id: data.poll_id,
        p_option_ids: data.option_ids
      });

      if (error) {
        console.error('❌ Error voting on poll:', error);
        throw new Error(error.message);
      }

      console.log('✅ Vote recorded successfully');
      return stats;
    } catch (error) {
      console.error('❌ Failed to vote on poll:', error);
      throw error;
    }
  }

  /**
   * Get poll statistics using Supabase RPC
   */
  async getPollStats(pollId: string): Promise<PollStats> {
    try {
      const { data: stats, error } = await supabase.rpc('get_poll_stats_serverless', {
        p_poll_id: pollId
      });

      if (error) {
        console.error('❌ Error getting poll stats:', error);
        throw new Error(error.message);
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get poll stats:', error);
      throw error;
    }
  }

  /**
   * Update a poll using Supabase RPC
   */
  async updatePoll(pollId: string, updates: Partial<CreatePollData>): Promise<Poll> {
    try {
      const { data: poll, error } = await supabase.rpc('update_poll_serverless', {
        p_poll_id: pollId,
        p_question: updates.question || null,
        p_options: updates.options || null,
        p_expires_at: updates.expires_at || null
      });

      if (error) {
        console.error('❌ Error updating poll:', error);
        throw new Error(error.message);
      }

      console.log('✅ Poll updated successfully');
      return poll;
    } catch (error) {
      console.error('❌ Failed to update poll:', error);
      throw error;
    }
  }

  /**
   * Delete a poll using Supabase RPC
   */
  async deletePoll(pollId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('delete_poll_serverless', {
        p_poll_id: pollId
      });

      if (error) {
        console.error('❌ Error deleting poll:', error);
        throw new Error(error.message);
      }

      console.log('✅ Poll deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete poll:', error);
      throw error;
    }
  }

  /**
   * Get user's votes for a specific poll
   */
  async getUserVotes(pollId: string): Promise<string[]> {
    try {
      const { data: votes, error } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', pollId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error('❌ Error getting user votes:', error);
        throw new Error(error.message);
      }

      return votes?.map(vote => vote.option_id) || [];
    } catch (error) {
      console.error('❌ Failed to get user votes:', error);
      throw error;
    }
  }

  /**
   * Check if poll has expired
   */
  isPollExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  /**
   * Calculate winning option(s) for a poll
   */
  calculateWinners(poll: Poll): string[] {
    if (!poll.options || poll.options.length === 0) return [];
    
    const maxVotes = Math.max(...poll.options.map(option => option.votes.length));
    if (maxVotes === 0) return [];
    
    return poll.options
      .filter(option => option.votes.length === maxVotes)
      .map(option => option.id);
  }

  /**
   * Check if poll has a clear winner (only one option with max votes)
   */
  hasWinner(poll: Poll): boolean {
    const winners = this.calculateWinners(poll);
    return winners.length === 1;
  }

  /**
   * Get the winner option for a poll
   */
  getWinner(poll: Poll): PollOption | null {
    if (!this.hasWinner(poll)) return null;
    
    const winnerIds = this.calculateWinners(poll);
    return poll.options.find(option => option.id === winnerIds[0]) || null;
  }
}

// Export singleton instance
export const serverlessPolling = new ServerlessPolling();

// Export class for testing
export default ServerlessPolling;