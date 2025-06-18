import { API_CONFIG } from '@/constants/config';

// Type definitions for the new friend system
export type RelationshipStatus = 
  | 'none'
  | 'pending_sent'      // I sent a friend request
  | 'pending_received'  // I received a friend request
  | 'accepted_sent'     // I sent and they accepted (we're friends)
  | 'accepted_received' // They sent and I accepted (we're friends)
  | 'declined_sent'     // I sent and they declined
  | 'declined_received'; // They sent and I declined

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

// Helper function to get auth headers
async function getAuthHeaders() {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw error;
  }
}

// Facebook-like relationship service
class RelationshipService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  // Send friend request
  async sendFriendRequest(receiverId: string): Promise<boolean> {
    try {
      console.log('🤝 Sending friend request to:', receiverId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ receiver_id: receiverId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error sending friend request:', data.error);
        return false;
      }

      console.log('✅ Friend request sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      return false;
    }
  }

  // Accept friend request
  async acceptFriendRequest(requestId: string): Promise<boolean> {
    try {
      console.log('✅ Accepting friend request:', requestId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/request/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ request_id: requestId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error accepting friend request:', data.error);
        return false;
      }

      console.log('✅ Friend request accepted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error accepting friend request:', error);
      return false;
    }
  }

  // Decline friend request
  async declineFriendRequest(requestId: string): Promise<boolean> {
    try {
      console.log('❌ Declining friend request:', requestId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/request/decline`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ request_id: requestId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error declining friend request:', data.error);
        return false;
      }

      console.log('✅ Friend request declined successfully');
      return true;
    } catch (error) {
      console.error('❌ Error declining friend request:', error);
      return false;
    }
  }

  // Cancel sent friend request
  async cancelFriendRequest(receiverId: string): Promise<boolean> {
    try {
      console.log('🚫 Cancelling friend request to:', receiverId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/request/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ receiver_id: receiverId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error cancelling friend request:', data.error);
        return false;
      }

      console.log('✅ Friend request cancelled successfully');
      return true;
    } catch (error) {
      console.error('❌ Error cancelling friend request:', error);
      return false;
    }
  }

  // Remove friend
  async removeFriend(friendId: string): Promise<boolean> {
    try {
      console.log('💔 Removing friend:', friendId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/remove`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ friend_id: friendId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error removing friend:', data.error);
        return false;
      }

      console.log('✅ Friend removed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error removing friend:', error);
      return false;
    }
  }

  // Get relationship status with specific user
  async getRelationshipStatus(targetUserId: string): Promise<RelationshipStatus> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/status/${targetUserId}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error getting relationship status:', data.error);
        return 'none';
      }

      return data.status || 'none';
    } catch (error) {
      console.error('❌ Error getting relationship status:', error);
      return 'none';
    }
  }

  // Get all friends
  async getFriends(): Promise<Friend[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error getting friends:', data.error);
        return [];
      }

      return data.friends || [];
    } catch (error) {
      console.error('❌ Error getting friends:', error);
      return [];
    }
  }

  // Get incoming friend requests
  async getIncomingRequests(): Promise<FriendRequest[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/requests/incoming`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error getting incoming requests:', data.error);
        return [];
      }

      return data.requests || [];
    } catch (error) {
      console.error('❌ Error getting incoming requests:', error);
      return [];
    }
  }

  // Get outgoing friend requests
  async getOutgoingRequests(): Promise<FriendRequest[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/requests/outgoing`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error getting outgoing requests:', data.error);
        return [];
      }

      return data.requests || [];
    } catch (error) {
      console.error('❌ Error getting outgoing requests:', error);
      return [];
    }
  }

  // Search users with relationship status
  async searchUsers(query: string): Promise<Array<{
    id: string;
    name: string;
    username: string;
    avatar_url: string;
    bio?: string;
    vibe?: string;
    relationshipStatus: RelationshipStatus;
  }>> {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/friends/search?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error searching users:', data.error);
        return [];
      }

      return data.users || [];
    } catch (error) {
      console.error('❌ Error searching users:', error);
      return [];
    }
  }
}

// Export singleton instance
export const relationshipService = new RelationshipService();
export default relationshipService; 