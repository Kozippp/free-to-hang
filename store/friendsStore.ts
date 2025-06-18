import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { relationshipService, RelationshipStatus } from '@/lib/relationship-service';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
}

interface GhostedFriend {
  id: string;
  ghoster_id: string;
  ghosted_id: string;
  duration_type: '1_day' | '3_days' | 'forever';
  expires_at: string | null;
  created_at: string;
}

interface FriendsState {
  // Data
  friends: User[];
  friendRequests: User[];
  sentRequests: User[];
  blockedUsers: User[];
  searchResults: User[];
  ghostedFriends: GhostedFriend[];
  
  // Loading states
  isSearching: boolean;
  isLoading: boolean;
  
  // Actions
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<boolean>;
  acceptFriendRequest: (friendId: string) => Promise<boolean>;
  declineFriendRequest: (friendId: string) => Promise<boolean>;
  cancelSentRequest: (friendId: string) => Promise<boolean>;
  removeFriend: (friendId: string) => Promise<boolean>;
  loadAllRelationships: () => Promise<void>;
  clearSearchResults: () => void;
  
  // Blocking
  blockUser: (userId: string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<boolean>;
  
  // Ghosting
  ghostFriend: (userId: string, duration: '1_day' | '3_days' | 'forever') => Promise<void>;
  unghostFriend: (userId: string) => Promise<void>;
  loadGhostedFriends: () => Promise<void>;
  getGhostStatus: (userId: string) => GhostedFriend | null;
  
  // Relationship Status - now uses single query approach
  getRelationshipStatus: (userId: string) => Promise<RelationshipStatus>;
  
  // Realtime
  startRealTimeUpdates: () => Promise<void>;
  stopRealTimeUpdates: () => void;
}

// Realtime channel variables
let relationshipsChannel: RealtimeChannel | null = null;
let ghostingChannel: RealtimeChannel | null = null;

const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  friendRequests: [],
  sentRequests: [],
  blockedUsers: [],
  searchResults: [],
  ghostedFriends: [],
  isSearching: false,
  isLoading: false,

  searchUsers: async (query: string) => {
    if (query.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Simple search - let the UI handle relationship status checking
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio, vibe')
        .or(`name.ilike.%${query}%, username.ilike.%${query}%`)
        .neq('id', currentUser.id)
        .limit(50);

      if (error) throw error;

      set({ searchResults: users || [] });
      
    } catch (error) {
      console.error('Search users error:', error);
      set({ searchResults: [] });
    } finally {
      set({ isSearching: false });
    }
  },

  sendFriendRequest: async (friendId: string) => {
    try {
      const success = await relationshipService.sendFriendRequest(friendId);
      if (success) {
        // Refresh data
        await get().loadAllRelationships();
      }
      return success;
    } catch (error) {
      console.error('Error sending friend request:', error);
      return false;
    }
  },

  acceptFriendRequest: async (friendId: string) => {
    try {
      const success = await relationshipService.acceptFriendRequest(friendId);
      if (success) {
        // Refresh data
        await get().loadAllRelationships();
      }
      return success;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
  },

  declineFriendRequest: async (friendId: string) => {
    try {
      const success = await relationshipService.declineFriendRequest(friendId);
      if (success) {
        // Refresh data
        await get().loadAllRelationships();
      }
      return success;
    } catch (error) {
      console.error('Error declining friend request:', error);
      return false;
    }
  },

  cancelSentRequest: async (friendId: string) => {
    try {
      const success = await relationshipService.declineFriendRequest(friendId);
      if (success) {
        // Refresh data
        await get().loadAllRelationships();
      }
      return success;
    } catch (error) {
      console.error('Error canceling friend request:', error);
      return false;
    }
  },

  removeFriend: async (friendId: string) => {
    try {
      const success = await relationshipService.removeFriend(friendId);
      if (success) {
        // Refresh data
        await get().loadAllRelationships();
      }
      return success;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  },

  blockUser: async (userId: string) => {
    try {
      const success = await relationshipService.blockUser(userId);
      if (success) {
        // Refresh data
        await get().loadAllRelationships();
      }
      return success;
    } catch (error) {
      console.error('Error blocking user:', error);
      return false;
    }
  },

  unblockUser: async (userId: string) => {
    try {
      const success = await relationshipService.unblockUser(userId);
      if (success) {
        // Refresh data
        await get().loadAllRelationships();
      }
      return success;
    } catch (error) {
      console.error('Error unblocking user:', error);
      return false;
    }
  },

  // Single method to load all relationship data
  loadAllRelationships: async () => {
    set({ isLoading: true });
    try {
      const relationships = await relationshipService.getAllRelationships();
      
      set({
        friends: relationships.friends,
        friendRequests: relationships.pendingReceived,
        sentRequests: relationships.pendingSent,
        blockedUsers: relationships.blockedByMe,
      });
      
      console.log('Relationships loaded:', {
        friends: relationships.friends.length,
        friendRequests: relationships.pendingReceived.length,
        sentRequests: relationships.pendingSent.length,
        blocked: relationships.blockedByMe.length
      });
      
    } catch (error) {
      console.error('Error loading relationships:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  clearSearchResults: () => {
    set({ searchResults: [] });
  },

  // Single query relationship status check
  getRelationshipStatus: async (userId: string) => {
    try {
      return await relationshipService.getRelationshipStatus(userId);
    } catch (error) {
      console.error('Error getting relationship status:', error);
      return 'none';
    }
  },

  // Ghosting functionality (unchanged)
  ghostFriend: async (userId: string, duration: '1_day' | '3_days' | 'forever') => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const expiresAt = duration === 'forever' ? null : 
        duration === '1_day' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() :
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('ghost_friends')
        .insert({
          ghoster_id: currentUser.id,
          ghosted_id: userId,
          duration_type: duration,
          expires_at: expiresAt
        });

      if (error) throw error;

      await get().loadGhostedFriends();
    } catch (error) {
      console.error('Error ghosting friend:', error);
    }
  },

  unghostFriend: async (userId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('ghost_friends')
        .delete()
        .eq('ghoster_id', currentUser.id)
        .eq('ghosted_id', userId);

      if (error) throw error;

      await get().loadGhostedFriends();
    } catch (error) {
      console.error('Error unghosting friend:', error);
    }
  },

  loadGhostedFriends: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: ghostedFriends, error } = await supabase
        .from('ghost_friends')
        .select('*')
        .eq('ghoster_id', currentUser.id)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (error) throw error;

      set({ ghostedFriends: ghostedFriends || [] });
    } catch (error) {
      console.error('Error loading ghosted friends:', error);
    }
  },

  getGhostStatus: (userId: string) => {
    const { ghostedFriends } = get();
    return ghostedFriends.find(ghost => ghost.ghosted_id === userId) || null;
  },

    // Realtime subscriptions
  startRealTimeUpdates: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Stop existing subscriptions
      get().stopRealTimeUpdates();

      // Subscribe to friend_requests table for real-time friend request updates
      const friendRequestsChannel = supabase
        .channel('friend_requests_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friend_requests',
            filter: `or(sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id})`
          },
          (payload) => {
            console.log('Friend request change detected:', payload);
            // Reload relationships when friend requests change
            get().loadAllRelationships();
          }
        )
        .subscribe();

      // Subscribe to friendships table for real-time friendship updates
      const friendshipsChannel = supabase
        .channel('friendships_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friendships',
            filter: `or(user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id})`
          },
          (payload) => {
            console.log('Friendship change detected:', payload);
            // Reload relationships when friendships change
            get().loadAllRelationships();
          }
        )
        .subscribe();

      // Subscribe to blocked_users table for real-time blocking updates
      const blockedUsersChannel = supabase
        .channel('blocked_users_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blocked_users',
            filter: `or(blocker_id.eq.${currentUser.id},blocked_id.eq.${currentUser.id})`
          },
          (payload) => {
            console.log('Blocked users change detected:', payload);
            // Reload relationships when blocking changes
            get().loadAllRelationships();
          }
        )
        .subscribe();

      // Store channel references for cleanup
      relationshipsChannel = friendRequestsChannel;
      // We'll store the additional channels in a more organized way
      (relationshipsChannel as any).friendshipsChannel = friendshipsChannel;
      (relationshipsChannel as any).blockedUsersChannel = blockedUsersChannel;

      console.log('Real-time updates started for friend relationships');
    } catch (error) {
      console.error('Error starting real-time updates:', error);
    }
  },

  stopRealTimeUpdates: () => {
    if (relationshipsChannel) {
      supabase.removeChannel(relationshipsChannel);
      // Clean up additional channels
      if ((relationshipsChannel as any).friendshipsChannel) {
        supabase.removeChannel((relationshipsChannel as any).friendshipsChannel);
      }
      if ((relationshipsChannel as any).blockedUsersChannel) {
        supabase.removeChannel((relationshipsChannel as any).blockedUsersChannel);
      }
      relationshipsChannel = null;
    }
    if (ghostingChannel) {
      supabase.removeChannel(ghostingChannel);
      ghostingChannel = null;
    }
    console.log('Real-time updates stopped');
  },
}));

export default useFriendsStore; 