/**
 * Direct Supabase Friends Service
 * 
 * This service reads friend data directly from Supabase using RLS-protected queries.
 * It replaces API calls to /api/friends with direct database access for better performance.
 */

import { supabase } from './supabase';

// Type definitions
export type RelationshipStatus = 
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'accepted_sent'
  | 'accepted_received'
  | 'declined_sent'
  | 'declined_received';

export interface FriendRequest {
  request_id: string;
  sender_id: string;
  receiver_id: string;
  sender_name?: string;
  sender_username?: string;
  sender_avatar_url?: string;
  sender_vibe?: string;
  receiver_name?: string;
  receiver_username?: string;
  receiver_avatar_url?: string;
  receiver_vibe?: string;
  created_at: string;
}

export interface Friend {
  friend_id: string;
  friend_name: string;
  friend_username: string;
  friend_avatar_url: string;
  friend_vibe?: string;
  friendship_date: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
  relationshipStatus: RelationshipStatus;
}

/** Returns true if the error looks like a transient network/connection failure. */
function isRetryableNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /connection timeout|upstream connect error|disconnect\/reset|ECONNRESET|ETIMEDOUT|network request failed/i.test(msg)
  );
}

/** Run fn; on retryable network error, wait then retry once. */
async function withRetryOnce<T>(fn: () => Promise<T>, delayMs = 2000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return await fn();
  }
}

/**
 * Direct Supabase Friends Service
 */
class FriendsDirectService {
  /**
   * Get all friends (accepted friend requests).
   * Retries once on connection timeout / upstream errors.
   */
  async getFriends(): Promise<Friend[]> {
    const run = async (): Promise<Friend[]> => {
      console.log('👥 [Direct] Fetching friends from Supabase...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          sender:sender_id(id, name, username, avatar_url, bio),
          receiver:receiver_id(id, name, username, avatar_url, bio)
        `)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (error) {
        throw error;
      }

      const friends: Friend[] = (data || []).map((friendship: any) => {
        const isSender = friendship.sender_id === user.id;
        const friendProfile = isSender ? friendship.receiver : friendship.sender;
        return {
          friend_id: friendProfile.id,
          friend_name: friendProfile.name,
          friend_username: friendProfile.username,
          friend_avatar_url: friendProfile.avatar_url || '',
          friend_vibe: friendProfile.bio,
          friendship_date: friendship.created_at
        };
      });

      console.log(`✅ [Direct] Fetched ${friends.length} friends from Supabase`);
      return friends;
    };

    try {
      return await withRetryOnce(run);
    } catch (error) {
      if (isRetryableNetworkError(error)) {
        console.warn('❌ [Direct] Friends: connection failed (timeout or network). You can pull to retry.');
      } else {
        console.error('❌ [Direct] Error fetching friends:', error);
      }
      throw error;
    }
  }

  /**
   * Get incoming friend requests (pending requests where I'm the receiver).
   * Retries once on connection timeout / upstream errors.
   */
  async getIncomingRequests(): Promise<FriendRequest[]> {
    const run = async (): Promise<FriendRequest[]> => {
      console.log('📥 [Direct] Fetching incoming friend requests from Supabase...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          sender:sender_id(id, name, username, avatar_url, bio)
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      const requests: FriendRequest[] = (data || []).map((req: any) => ({
        request_id: req.id,
        sender_id: req.sender_id,
        receiver_id: req.receiver_id,
        sender_name: req.sender?.name,
        sender_username: req.sender?.username,
        sender_avatar_url: req.sender?.avatar_url || '',
        sender_vibe: req.sender?.bio,
        created_at: req.created_at
      }));

      console.log(`✅ [Direct] Fetched ${requests.length} incoming requests from Supabase`);
      return requests;
    };

    try {
      return await withRetryOnce(run);
    } catch (error) {
      if (isRetryableNetworkError(error)) {
        console.warn('❌ [Direct] Incoming requests: connection failed (timeout or network). You can pull to retry.');
      } else {
        console.error('❌ [Direct] Error fetching incoming requests:', error);
      }
      throw error;
    }
  }

  /**
   * Get outgoing friend requests (pending requests where I'm the sender).
   * Retries once on connection timeout / upstream errors.
   */
  async getOutgoingRequests(): Promise<FriendRequest[]> {
    const run = async (): Promise<FriendRequest[]> => {
      console.log('📤 [Direct] Fetching outgoing friend requests from Supabase...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          receiver:receiver_id(id, name, username, avatar_url, bio)
        `)
        .eq('sender_id', user.id)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      const requests: FriendRequest[] = (data || []).map((req: any) => ({
        request_id: req.id,
        sender_id: req.sender_id,
        receiver_id: req.receiver_id,
        receiver_name: req.receiver?.name,
        receiver_username: req.receiver?.username,
        receiver_avatar_url: req.receiver?.avatar_url || '',
        receiver_vibe: req.receiver?.bio,
        created_at: req.created_at
      }));

      console.log(`✅ [Direct] Fetched ${requests.length} outgoing requests from Supabase`);
      return requests;
    };

    try {
      return await withRetryOnce(run);
    } catch (error) {
      if (isRetryableNetworkError(error)) {
        console.warn('❌ [Direct] Outgoing requests: connection failed (timeout or network). You can retry later.');
      } else {
        console.error('❌ [Direct] Error fetching outgoing requests:', error);
      }
      throw error;
    }
  }

  /**
   * Get relationship status with a specific user
   */
  async getRelationshipStatus(targetUserId: string): Promise<RelationshipStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Check if there's a friend request between me and target user
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (!data) {
        return 'none';
      }

      // Determine status based on who sent and what the status is
      const isSender = data.sender_id === user.id;
      
      if (data.status === 'pending') {
        return isSender ? 'pending_sent' : 'pending_received';
      } else if (data.status === 'accepted') {
        return isSender ? 'accepted_sent' : 'accepted_received';
      } else if (data.status === 'declined') {
        return isSender ? 'declined_sent' : 'declined_received';
      }

      return 'none';
    } catch (error) {
      console.error('❌ [Direct] Error getting relationship status:', error);
      return 'none';
    }
  }

  /**
   * Search users by name or username
   * Returns users with their relationship status relative to current user
   */
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      console.log('🔍 [Direct] Searching users in Supabase:', query);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Search users by name or username (case insensitive)
      const { data: users, error: searchError } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio')
        .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
        .neq('id', user.id) // Exclude self
        .limit(20);

      if (searchError) {
        throw searchError;
      }

      if (!users || users.length === 0) {
        return [];
      }

      // Get all friend requests involving current user to determine relationship status
      const { data: friendRequests, error: requestsError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (requestsError) {
        throw requestsError;
      }

      // Build a map of user_id -> relationship status
      const statusMap = new Map<string, RelationshipStatus>();
      
      (friendRequests || []).forEach((req: any) => {
        const otherId = req.sender_id === user.id ? req.receiver_id : req.sender_id;
        const isSender = req.sender_id === user.id;

        let status: RelationshipStatus = 'none';
        if (req.status === 'pending') {
          status = isSender ? 'pending_sent' : 'pending_received';
        } else if (req.status === 'accepted') {
          status = isSender ? 'accepted_sent' : 'accepted_received';
        } else if (req.status === 'declined') {
          status = isSender ? 'declined_sent' : 'declined_received';
        }

        statusMap.set(otherId, status);
      });

      // Map users to search results with relationship status
      const results: UserSearchResult[] = users.map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatar_url: u.avatar_url || '',
        bio: u.bio,
        vibe: u.bio,
        relationshipStatus: statusMap.get(u.id) || 'none'
      }));

      console.log(`✅ [Direct] Found ${results.length} users matching "${query}"`);
      return results;
    } catch (error) {
      console.error('❌ [Direct] Error searching users:', error);
      throw error;
    }
  }

  /**
   * Send a friend request
   * Note: Write operations still go through backend API for now (as per migration plan)
   * This is a placeholder for future direct write support
   */
  async sendFriendRequest(receiverId: string): Promise<boolean> {
    // For now, delegate to API (Phase 2 focuses on READ operations)
    // TODO: Implement direct write in later phase if needed
    console.warn('⚠️ sendFriendRequest should use API endpoint (write operation)');
    return false;
  }

  /**
   * Accept a friend request
   * Note: Write operations still go through backend API for now
   */
  async acceptFriendRequest(requestId: string): Promise<boolean> {
    console.warn('⚠️ acceptFriendRequest should use API endpoint (write operation)');
    return false;
  }

  /**
   * Decline a friend request
   * Note: Write operations still go through backend API for now
   */
  async declineFriendRequest(requestId: string): Promise<boolean> {
    console.warn('⚠️ declineFriendRequest should use API endpoint (write operation)');
    return false;
  }

  /**
   * Cancel a sent friend request
   * Note: Write operations still go through backend API for now
   */
  async cancelFriendRequest(receiverId: string): Promise<boolean> {
    console.warn('⚠️ cancelFriendRequest should use API endpoint (write operation)');
    return false;
  }

  /**
   * Remove a friend
   * Note: Write operations still go through backend API for now
   */
  async removeFriend(friendId: string): Promise<boolean> {
    console.warn('⚠️ removeFriend should use API endpoint (write operation)');
    return false;
  }
}

// Export singleton instance
export const friendsDirectService = new FriendsDirectService();
export default friendsDirectService;
