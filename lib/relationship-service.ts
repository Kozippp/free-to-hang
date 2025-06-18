// Keep only the type definitions for frontend compatibility
export type RelationshipStatus = 
  | 'none'
  | 'pending_sent'      // I sent a friend request
  | 'pending_received'  // I received a friend request
  | 'friends'
  | 'blocked_by_me'     // I blocked them
  | 'blocked_by_them';

// Simplified relationship service - no backend operations
class RelationshipService {
  // Always return 'none' status - no relationship checking
  async getRelationshipStatus(targetUserId: string): Promise<RelationshipStatus> {
    console.log('🚫 Relationship status check disabled (frontend only)');
    return 'none';
  }

  // Mock friend request - does nothing but logs
  async sendFriendRequest(targetUserId: string): Promise<boolean> {
    console.log('🚫 Send friend request disabled (frontend only)');
    return true; // Return true to prevent UI errors
  }

  // Mock accept request - does nothing but logs
  async acceptFriendRequest(targetUserId: string): Promise<boolean> {
    console.log('🚫 Accept friend request disabled (frontend only)');
    return true;
  }

  // Mock decline request - does nothing but logs
  async declineFriendRequest(targetUserId: string): Promise<boolean> {
    console.log('🚫 Decline friend request disabled (frontend only)');
    return true;
  }

  // Mock remove friend - does nothing but logs
  async removeFriend(targetUserId: string): Promise<boolean> {
    console.log('🚫 Remove friend disabled (frontend only)');
    return true;
  }

  // Mock block user - does nothing but logs
  async blockUser(targetUserId: string): Promise<boolean> {
    console.log('🚫 Block user disabled (frontend only)');
    return true;
  }

  // Mock unblock user - does nothing but logs
  async unblockUser(targetUserId: string): Promise<boolean> {
    console.log('🚫 Unblock user disabled (frontend only)');
    return true;
  }

  // Return empty relationships - no backend loading
  async getAllRelationships(): Promise<{
    friends: any[];
    pendingSent: any[];
    pendingReceived: any[];
    blockedByMe: any[];
  }> {
    console.log('🚫 Load relationships disabled (frontend only)');
    return {
      friends: [],
      pendingSent: [],
      pendingReceived: [],
      blockedByMe: []
    };
  }
}

export const relationshipService = new RelationshipService(); 