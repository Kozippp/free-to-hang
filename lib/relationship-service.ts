import { supabase } from './supabase';

export type RelationshipStatus = 
  | 'none'
  | 'pending_sent'      // I sent a friend request
  | 'pending_received'  // I received a friend request
  | 'friends'
  | 'blocked_by_me'     // I blocked them
  | 'blocked_by_them';  // They blocked me

// Enhanced single relationship status check using efficient database function
async function getRelationshipStatus(currentUserId: string, targetUserId: string): Promise<RelationshipStatus> {
  try {
    // Use the new efficient database function
    const { data, error } = await supabase
      .rpc('get_relationship_status_efficient', {
        current_user_id: currentUserId,
        target_user_id: targetUserId
      });

    if (error) {
      console.error('Error in efficient relationship status check:', error);
      // Fallback to original method
      return await getRelationshipStatusFallback(currentUserId, targetUserId);
    }

    return (data as RelationshipStatus) || 'none';
  } catch (error) {
    console.error('Error checking relationship status:', error);
    return 'none';
  }
}

// Fallback method (original implementation)
async function getRelationshipStatusFallback(currentUserId: string, targetUserId: string): Promise<RelationshipStatus> {
  try {
    // Check if blocked by me
    const { data: blockedByMe } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', targetUserId)
      .single();
    
    if (blockedByMe) return 'blocked_by_me';
    
    // Check if blocked by them
    const { data: blockedByThem } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', targetUserId)
      .eq('blocked_id', currentUserId)
      .single();
    
    if (blockedByThem) return 'blocked_by_them';
    
    // Check if friends
    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('friend_id', targetUserId)
      .single();
    
    if (friendship) return 'friends';
    
    // Check if I sent a friend request
    const { data: sentRequest } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('sender_id', currentUserId)
      .eq('receiver_id', targetUserId)
      .eq('status', 'pending')
      .single();
    
    if (sentRequest) return 'pending_sent';
    
    // Check if I received a friend request
    const { data: receivedRequest } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('sender_id', targetUserId)
      .eq('receiver_id', currentUserId)
      .eq('status', 'pending')
      .single();
    
    if (receivedRequest) return 'pending_received';
    
    return 'none';
  } catch (error) {
    console.error('Error checking relationship status (fallback):', error);
    return 'none';
  }
}

class RelationshipService {
  // Get relationship status between current user and target user
  async getRelationshipStatus(targetUserId: string): Promise<RelationshipStatus> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return 'none';

      return await getRelationshipStatus(currentUser.user.id, targetUserId);
    } catch (error) {
      console.error('Error in getRelationshipStatus:', error);
      return 'none';
    }
  }

  // Send friend request
  async sendFriendRequest(targetUserId: string): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return false;

      const { error } = await supabase
        .rpc('upsert_relationship', {
          user1_id: currentUser.user.id,
          user2_id: targetUserId,
          new_status: 'pending_sent'
        });

      if (error) {
        console.error('Error sending friend request:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in sendFriendRequest:', error);
      return false;
    }
  }

  // Accept friend request
  async acceptFriendRequest(targetUserId: string): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return false;

      const { error } = await supabase
        .rpc('upsert_relationship', {
          user1_id: currentUser.user.id,
          user2_id: targetUserId,
          new_status: 'friends'
        });

      if (error) {
        console.error('Error accepting friend request:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in acceptFriendRequest:', error);
      return false;
    }
  }

  // Decline/cancel friend request
  async declineFriendRequest(targetUserId: string): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return false;

      const { error } = await supabase
        .rpc('delete_relationship', {
          user1_id: currentUser.user.id,
          user2_id: targetUserId
        });

      if (error) {
        console.error('Error declining friend request:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in declineFriendRequest:', error);
      return false;
    }
  }

  // Remove friend
  async removeFriend(targetUserId: string): Promise<boolean> {
    return this.declineFriendRequest(targetUserId);
  }

  // Block user
  async blockUser(targetUserId: string): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return false;

      const { error } = await supabase
        .rpc('upsert_relationship', {
          user1_id: currentUser.user.id,
          user2_id: targetUserId,
          new_status: 'blocked_by_me'
        });

      if (error) {
        console.error('Error blocking user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in blockUser:', error);
      return false;
    }
  }

  // Unblock user
  async unblockUser(targetUserId: string): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return false;

      // Simply delete the blocked relationship
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUser.user.id)
        .eq('blocked_id', targetUserId);

      if (error) {
        console.error('Error unblocking user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in unblockUser:', error);
      return false;
    }
  }

  // Enhanced bulk relationship loading using efficient database function
  async getAllRelationships(): Promise<{
    friends: any[];
    pendingSent: any[];
    pendingReceived: any[];
    blockedByMe: any[];
  }> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        return {
          friends: [],
          pendingSent: [],
          pendingReceived: [],
          blockedByMe: []
        };
      }

      // Try using the new efficient bulk query function
      const { data: relationships, error } = await supabase
        .rpc('get_user_relationships_bulk', {
          current_user_id: currentUser.user.id
        });

      if (error) {
        console.error('Error in bulk relationship query, falling back:', error);
        return await this.getAllRelationshipsFallback();
      }

      // Group the results by relationship type
      const friends = relationships?.filter((r: any) => r.relationship_type === 'friends') || [];
      const pendingSent = relationships?.filter((r: any) => r.relationship_type === 'pending_sent') || [];
      const pendingReceived = relationships?.filter((r: any) => r.relationship_type === 'pending_received') || [];
      const blockedByMe = relationships?.filter((r: any) => r.relationship_type === 'blocked_by_me') || [];

      // Transform to match expected format
      const transformUser = (rel: any) => ({
        id: rel.other_user_id,
        name: rel.other_user_name,
        username: rel.other_user_username,
        avatar_url: rel.other_user_avatar,
        created_at: rel.created_at
      });

      return {
        friends: friends.map(transformUser),
        pendingSent: pendingSent.map(transformUser),
        pendingReceived: pendingReceived.map(transformUser),
        blockedByMe: blockedByMe.map(transformUser)
      };
    } catch (error) {
      console.error('Error in getAllRelationships:', error);
      return await this.getAllRelationshipsFallback();
    }
  }

  // Fallback method for bulk relationship loading (original implementation)
  async getAllRelationshipsFallback(): Promise<{
    friends: any[];
    pendingSent: any[];
    pendingReceived: any[];
    blockedByMe: any[];
  }> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        return {
          friends: [],
          pendingSent: [],
          pendingReceived: [],
          blockedByMe: []
        };
      }

      const userId = currentUser.user.id;

      // Get all relationship data in parallel
      const [friendsResult, sentRequestsResult, receivedRequestsResult, blockedResult] = await Promise.all([
        // Friends
        supabase
          .from('friendships')
          .select(`
            friend_id,
            created_at,
            users!friendships_friend_id_fkey (
              id, name, username, avatar_url
            )
          `)
          .eq('user_id', userId),

        // Sent friend requests
        supabase
          .from('friend_requests')
          .select(`
            receiver_id,
            created_at,
            users!friend_requests_receiver_id_fkey (
              id, name, username, avatar_url
            )
          `)
          .eq('sender_id', userId)
          .eq('status', 'pending'),

        // Received friend requests
        supabase
          .from('friend_requests')
          .select(`
            sender_id,
            created_at,
            users!friend_requests_sender_id_fkey (
              id, name, username, avatar_url
            )
          `)
          .eq('receiver_id', userId)
          .eq('status', 'pending'),

        // Blocked users
        supabase
          .from('blocked_users')
          .select(`
            blocked_id,
            created_at,
            users!blocked_users_blocked_id_fkey (
              id, name, username, avatar_url
            )
          `)
          .eq('blocker_id', userId)
      ]);

      // Transform the data to a consistent format
      const friends = (friendsResult.data || []).map((item: any) => ({
        id: item.users?.id || item.friend_id,
        name: item.users?.name || 'Unknown',
        username: item.users?.username || 'unknown',
        avatar_url: item.users?.avatar_url || '',
        created_at: item.created_at
      }));

      const pendingSent = (sentRequestsResult.data || []).map((item: any) => ({
        id: item.users?.id || item.receiver_id,
        name: item.users?.name || 'Unknown',
        username: item.users?.username || 'unknown',
        avatar_url: item.users?.avatar_url || '',
        created_at: item.created_at
      }));

      const pendingReceived = (receivedRequestsResult.data || []).map((item: any) => ({
        id: item.users?.id || item.sender_id,
        name: item.users?.name || 'Unknown',
        username: item.users?.username || 'unknown',
        avatar_url: item.users?.avatar_url || '',
        created_at: item.created_at
      }));

      const blockedByMe = (blockedResult.data || []).map((item: any) => ({
        id: item.users?.id || item.blocked_id,
        name: item.users?.name || 'Unknown',
        username: item.users?.username || 'unknown',
        avatar_url: item.users?.avatar_url || '',
        created_at: item.created_at
      }));

      return {
        friends,
        pendingSent,
        pendingReceived,
        blockedByMe
      };
    } catch (error) {
      console.error('Error in getAllRelationshipsFallback:', error);
      return {
        friends: [],
        pendingSent: [],
        pendingReceived: [],
        blockedByMe: []
      };
    }
  }
}

export const relationshipService = new RelationshipService(); 