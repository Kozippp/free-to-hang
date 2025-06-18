import { supabase } from './supabase';

export type RelationshipStatus = 
  | 'none'
  | 'pending_sent'      // I sent a friend request
  | 'pending_received'  // I received a friend request
  | 'friends'
  | 'blocked_by_me'     // I blocked them
  | 'blocked_by_them';  // They blocked me

// Single relationship status check
async function getRelationshipStatus(currentUserId: string, targetUserId: string): Promise<RelationshipStatus> {
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
    console.error('Error checking relationship status:', error);
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

  // Get all relationships for current user
  async getAllRelationships(): Promise<{
    friends: any[];
    pendingSent: any[];
    pendingReceived: any[];
    blockedByMe: any[];
  }> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        return { friends: [], pendingSent: [], pendingReceived: [], blockedByMe: [] };
      }

      // Use the database function to get all relationships
      const { data, error } = await supabase
        .rpc('get_user_relationships', { user_id: currentUser.user.id });

      if (error) {
        console.error('Error getting relationships:', error);
        return { friends: [], pendingSent: [], pendingReceived: [], blockedByMe: [] };
      }

      const result = data?.[0];
      if (!result) {
        return { friends: [], pendingSent: [], pendingReceived: [], blockedByMe: [] };
      }

      return {
        friends: result.friends || [],
        pendingSent: result.sent_requests || [],
        pendingReceived: result.friend_requests || [],
        blockedByMe: result.blocked_users || []
      };
    } catch (error) {
      console.error('Error in getAllRelationships:', error);
      return { friends: [], pendingSent: [], pendingReceived: [], blockedByMe: [] };
    }
  }
}

export const relationshipService = new RelationshipService(); 