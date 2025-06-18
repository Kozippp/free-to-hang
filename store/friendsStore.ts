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

interface UserWithStatus extends User {
  relationshipStatus?: RelationshipStatus;
}

interface FriendsState {
  // Data
  friends: User[];
  friendRequests: User[];
  sentRequests: User[];
  blockedUsers: User[];
  searchResults: UserWithStatus[];
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
  
  // New methods for better UX
  refreshRelationshipStatus: (userId: string) => Promise<void>;
  updateSearchResultStatus: (userId: string, status: RelationshipStatus) => void;
  
  // Add new method to force refresh specific relationship states
  refreshSpecificRelationship: (userId: string) => Promise<void>;
  
  // Add method to validate and sync state with database
  validateAndSyncState: () => Promise<void>;
}

// Global variables for real-time subscriptions
let relationshipsChannel: any = null;
let ghostingChannel: any = null;
let isStartingRealTime = false; // Flag to prevent multiple simultaneous starts

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

      // Search for users
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio, vibe')
        .or(`name.ilike.%${query}%, username.ilike.%${query}%`)
        .neq('id', currentUser.id)
        .limit(50);

      if (error) throw error;

      // Get relationship status for each user
      const usersWithStatus: UserWithStatus[] = await Promise.all(
        (users || []).map(async (user) => {
          const status = await relationshipService.getRelationshipStatus(user.id);
          return { ...user, relationshipStatus: status };
        })
      );

      set({ searchResults: usersWithStatus });
      
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
        // Find the user from search results to add to sent requests
        const currentState = get();
        const targetUser = currentState.searchResults.find(user => user.id === friendId);
        
        if (targetUser) {
          set({
            sentRequests: [...currentState.sentRequests, targetUser],
            searchResults: currentState.searchResults.map(user => 
              user.id === friendId 
                ? { ...user, relationshipStatus: 'pending_sent' as const }
                : user
            )
          });
        }
        
        // Force a complete refresh to ensure consistency
        setTimeout(() => get().validateAndSyncState(), 500);
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
        // Immediately move from friendRequests to friends
        const currentState = get();
        const acceptedRequest = currentState.friendRequests.find(req => req.id === friendId);
        
        if (acceptedRequest) {
          set({
            friendRequests: currentState.friendRequests.filter(req => req.id !== friendId),
            friends: [...currentState.friends, acceptedRequest],
            searchResults: currentState.searchResults.map(user => 
              user.id === friendId 
                ? { ...user, relationshipStatus: 'friends' as const }
                : user
            )
          });
        }
        
        // Force a complete refresh to ensure consistency
        setTimeout(() => get().validateAndSyncState(), 500);
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
        // Immediately remove from both arrays and update search results
        const currentState = get();
        set({
          friendRequests: currentState.friendRequests.filter(req => req.id !== friendId),
          sentRequests: currentState.sentRequests.filter(req => req.id !== friendId),
          searchResults: currentState.searchResults.map(user => 
            user.id === friendId 
              ? { ...user, relationshipStatus: 'none' as const }
              : user
          )
        });
        
        // Force a complete refresh to ensure consistency
        setTimeout(() => get().validateAndSyncState(), 500);
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
        // Immediately remove from sent requests and update search results
        const currentState = get();
        set({
          sentRequests: currentState.sentRequests.filter(req => req.id !== friendId),
          searchResults: currentState.searchResults.map(user => 
            user.id === friendId 
              ? { ...user, relationshipStatus: 'none' as const }
              : user
          )
        });
        
        // Force a complete refresh to ensure consistency
        setTimeout(() => get().validateAndSyncState(), 500);
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
        // Update search results immediately
        get().updateSearchResultStatus(friendId, 'none');
        // Refresh data in background
        setTimeout(() => get().loadAllRelationships(), 100);
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
        // Update search results immediately
        get().updateSearchResultStatus(userId, 'blocked_by_me');
        // Refresh data in background
        setTimeout(() => get().loadAllRelationships(), 100);
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
        // Update search results immediately
        get().updateSearchResultStatus(userId, 'none');
        // Refresh data in background
        setTimeout(() => get().loadAllRelationships(), 100);
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

  // New helper methods
  refreshRelationshipStatus: async (userId: string) => {
    try {
      const status = await relationshipService.getRelationshipStatus(userId);
      get().updateSearchResultStatus(userId, status);
    } catch (error) {
      console.error('Error refreshing relationship status:', error);
    }
  },

  updateSearchResultStatus: (userId: string, status: RelationshipStatus) => {
    const { searchResults } = get();
    const updatedResults = searchResults.map(user => 
      user.id === userId ? { ...user, relationshipStatus: status } : user
    );
    set({ searchResults: updatedResults });
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

  // Improved real-time subscriptions - Fixed infinite retry loop
  startRealTimeUpdates: async () => {
    // Prevent multiple simultaneous subscription attempts
    if (isStartingRealTime) {
      console.log('🛑 Real-time subscription already in progress, skipping...');
      return;
    }
    
    try {
      isStartingRealTime = true;
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        console.log('❌ No authenticated user for real-time updates');
        return;
      }

      // Stop existing subscriptions first - IMPORTANT: This prevents multiple subscriptions
      get().stopRealTimeUpdates();

      console.log('🚀 Starting real-time updates for user:', currentUser.id);

      // Load initial data
      await get().loadAllRelationships();

      // Create a FRESH channel with unique name each time to avoid reuse
      const channelName = `friends_realtime_${currentUser.id}_${Date.now()}`;
      const friendsChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friend_requests'
          },
          (payload) => {
            console.log('🔄 Friend request change:', payload.eventType);
            
            // Only process if it involves the current user
            const newData = payload.new as any;
            const oldData = payload.old as any;
            
            const isRelevant = 
              (newData && (newData.sender_id === currentUser.id || newData.receiver_id === currentUser.id)) ||
              (oldData && (oldData.sender_id === currentUser.id || oldData.receiver_id === currentUser.id));
            
            if (isRelevant) {
              // Reload relationships after a short delay to ensure consistency
              setTimeout(() => {
                console.log('🔄 Reloading relationships due to friend request change');
                get().loadAllRelationships();
              }, 500);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friendships'
          },
          (payload) => {
            console.log('🔄 Friendship change:', payload.eventType);
            
            // Only process if it involves the current user
            const newData = payload.new as any;
            const oldData = payload.old as any;
            
            const isRelevant = 
              (newData && (newData.user_id === currentUser.id || newData.friend_id === currentUser.id)) ||
              (oldData && (oldData.user_id === currentUser.id || oldData.friend_id === currentUser.id));
            
            if (isRelevant) {
              // Reload relationships after a short delay
              setTimeout(() => {
                console.log('🔄 Reloading relationships due to friendship change');
                get().loadAllRelationships();
              }, 500);
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Friends channel status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time updates active');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Real-time channel error - will NOT retry to prevent spam');
            // DO NOT retry automatically to prevent infinite loops
            // User can manually refresh if needed
          } else if (status === 'CLOSED') {
            console.log('📡 Channel closed');
          }
        });

      // Store channel reference for cleanup
      relationshipsChannel = friendsChannel;

      console.log('✅ Real-time subscription started');
    } catch (error) {
      console.error('❌ Error starting real-time updates:', error);
      // DO NOT retry automatically to prevent infinite loops
    } finally {
      isStartingRealTime = false;
    }
  },

  stopRealTimeUpdates: () => {
    console.log('🛑 Stopping real-time updates...');
    
    // Reset the flag
    isStartingRealTime = false;
    
    if (relationshipsChannel) {
      supabase.removeChannel(relationshipsChannel);
      relationshipsChannel = null;
      console.log('✅ Real-time updates stopped');
    }
    if (ghostingChannel) {
      supabase.removeChannel(ghostingChannel);
      ghostingChannel = null;
    }
  },

  // New method to refresh specific relationship
  refreshSpecificRelationship: async (userId: string) => {
    try {
      const status = await relationshipService.getRelationshipStatus(userId);
      const currentState = get();
      
      set({
        searchResults: currentState.searchResults.map(user => 
          user.id === userId 
            ? { ...user, relationshipStatus: status }
            : user
        )
      });
    } catch (error) {
      console.error('Error refreshing specific relationship:', error);
    }
  },

  // New method to validate and sync state with database
  validateAndSyncState: async () => {
    try {
      console.log('🔄 Validating and syncing friend state with database...');
      
      // Get fresh data from database
      const relationships = await relationshipService.getAllRelationships();
      
      set({
        friends: relationships.friends,
        friendRequests: relationships.pendingReceived,
        sentRequests: relationships.pendingSent,
        blockedUsers: relationships.blockedByMe,
        isLoading: false
      });
      
      console.log('✅ Friend state synchronized with database');
    } catch (error) {
      console.error('❌ Error validating friend state:', error);
    }
  },
}));

export default useFriendsStore; 