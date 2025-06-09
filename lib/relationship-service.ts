import { supabase } from './supabase';

export type RelationshipStatus = 
  | 'none'
  | 'pending_sent'      // I sent a friend request
  | 'pending_received'  // I received a friend request
  | 'friends'
  | 'blocked_by_me'     // I blocked them
  | 'blocked_by_them';  // They blocked me

export interface RelationshipData {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

class RelationshipService {
  // Get relationship status between current user and target user (single query!)
  async getRelationshipStatus(targetUserId: string): Promise<RelationshipStatus> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return 'none';

      const { data, error } = await supabase
        .rpc('get_relationship_status', {
          user1_id: currentUser.user.id,
          user2_id: targetUserId
        });

      if (error) {
        console.error('Error getting relationship status:', error);
        return 'none';
      }

      return data as RelationshipStatus;
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

      const { error } = await supabase
        .rpc('delete_relationship', {
          user1_id: currentUser.user.id,
          user2_id: targetUserId
        });

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

      // Get all relationships involving current user
      const { data: relationships, error } = await supabase
        .from('relationships')
        .select(`
          *,
          user_a:users!relationships_user_a_id_fkey(id, name, avatar_url),
          user_b:users!relationships_user_b_id_fkey(id, name, avatar_url)
        `)
        .or(`user_a_id.eq.${currentUser.user.id},user_b_id.eq.${currentUser.user.id}`);

      if (error) {
        console.error('Error getting relationships:', error);
        return { friends: [], pendingSent: [], pendingReceived: [], blockedByMe: [] };
      }

      const result = {
        friends: [] as any[],
        pendingSent: [] as any[],
        pendingReceived: [] as any[],
        blockedByMe: [] as any[]
      };

      relationships?.forEach((rel: any) => {
        const isUserA = rel.user_a_id === currentUser.user.id;
        const otherUser = isUserA ? rel.user_b : rel.user_a;

        switch (rel.status) {
          case 'friends':
            result.friends.push(otherUser);
            break;
          case 'pending_a_to_b':
            if (isUserA) {
              result.pendingSent.push(otherUser);
            } else {
              result.pendingReceived.push(otherUser);
            }
            break;
          case 'pending_b_to_a':
            if (isUserA) {
              result.pendingReceived.push(otherUser);
            } else {
              result.pendingSent.push(otherUser);
            }
            break;
          case 'blocked_by_a':
            if (isUserA) {
              result.blockedByMe.push(otherUser);
            }
            break;
          case 'blocked_by_b':
            if (!isUserA) {
              result.blockedByMe.push(otherUser);
            }
            break;
        }
      });

      return result;
    } catch (error) {
      console.error('Error in getAllRelationships:', error);
      return { friends: [], pendingSent: [], pendingReceived: [], blockedByMe: [] };
    }
  }
}

export const relationshipService = new RelationshipService(); 