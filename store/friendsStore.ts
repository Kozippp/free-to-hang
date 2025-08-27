import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { relationshipService, RelationshipStatus, Friend, FriendRequest } from '@/lib/relationship-service';
import { realtimeManager } from '@/lib/RealtimeManager';

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
}

interface UserWithStatus extends User {
  relationshipStatus?: RelationshipStatus;
}

interface FriendsState {
  // Data
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  searchResults: UserWithStatus[];
  
  // Loading states
  isSearching: boolean;
  isLoading: boolean;
  isLoadingRequests: boolean;
  isLoadingFriends: boolean;

  // Actions
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (userId: string) => Promise<boolean>;
  acceptFriendRequest: (requestId: string) => Promise<boolean>;
  declineFriendRequest: (requestId: string) => Promise<boolean>;
  cancelFriendRequest: (receiverId: string) => Promise<boolean>;
  removeFriend: (friendId: string) => Promise<boolean>;
  
  // Data loading
  loadFriends: () => Promise<void>;
  loadIncomingRequests: () => Promise<void>;
  loadOutgoingRequests: () => Promise<void>;
  loadAllRelationships: () => Promise<void>;
  
  // Real-time subscriptions
  startRealTimeUpdates: () => Promise<void>;
  stopRealTimeUpdates: () => void;
  
  // Manual refresh
  forceRefresh: () => Promise<void>;
}

// Realtime manager handles all subscriptions

// Handle real-time changes for friend requests
function handleFriendRequests(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  // Get current user ID from supabase auth
  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  };

  getCurrentUserId().then(currentUserId => {
    if (!currentUserId) return;

    if (eventType === 'INSERT') {
      // New friend request created
      const request = newRecord as any;

      if (request.receiver_id === currentUserId) {
        // Incoming request - someone sent me a request
        console.log('📥 New incoming friend request received via real-time');

        // Reload incoming requests
        relationshipService.getIncomingRequests().then(requests => {
          useFriendsStore.setState({ incomingRequests: requests });
          console.log('✅ Incoming requests updated via real-time:', requests.length);
        }).catch(error => {
          console.error('❌ Error updating incoming requests via real-time:', error);
        });

      } else if (request.sender_id === currentUserId) {
        // Outgoing request - I sent a request
        console.log('📤 New outgoing friend request sent via real-time');

        // Reload outgoing requests
        relationshipService.getOutgoingRequests().then(requests => {
          useFriendsStore.setState({ outgoingRequests: requests });
          console.log('✅ Outgoing requests updated via real-time:', requests.length);
        }).catch(error => {
          console.error('❌ Error updating outgoing requests via real-time:', error);
        });
      }

    } else if (eventType === 'UPDATE') {
      // Friend request status changed
      const request = newRecord as any;

      if (request.status === 'accepted') {
        console.log('✅ Friend request accepted - updating friends list');

        // Remove from appropriate request list
        const currentStore = useFriendsStore.getState();
        const { incomingRequests, outgoingRequests } = currentStore;

        if (request.receiver_id === currentUserId) {
          // I accepted someone's request
          useFriendsStore.setState({
            incomingRequests: incomingRequests.filter(req => req.request_id !== request.id)
          });
        } else if (request.sender_id === currentUserId) {
          // Someone accepted my request
          useFriendsStore.setState({
            outgoingRequests: outgoingRequests.filter(req => req.request_id !== request.id)
          });
        }

        // Reload friends list to include new friend
        relationshipService.getFriends().then(friends => {
          useFriendsStore.setState({ friends });
          console.log('✅ Friends updated via real-time:', friends.length);
        }).catch(error => {
          console.error('❌ Error updating friends via real-time:', error);
        });
      }

    } else if (eventType === 'DELETE') {
      // Friend request declined/cancelled or friendship removed
      const request = oldRecord as any;

      console.log('🗑️ Friend request deleted via real-time:', {
        id: request.id,
        available_data: Object.keys(request || {}),
        currentUserId
      });

      // Since DELETE events don't include full record data (sender_id, receiver_id, status),
      // we need to force refresh all relationship data to ensure consistency
      console.log('🔄 DELETE event detected - force refreshing all relationship data');

      Promise.all([
        relationshipService.getFriends(),
        relationshipService.getIncomingRequests(),
        relationshipService.getOutgoingRequests(),
      ]).then(([friends, incomingRequests, outgoingRequests]) => {
        useFriendsStore.setState({
          friends,
          incomingRequests,
          outgoingRequests
        });

        console.log('✅ All relationships refreshed via real-time after DELETE:', {
          friends: friends.length,
          incoming: incomingRequests.length,
          outgoing: outgoingRequests.length
        });
      }).catch(error => {
        console.error('❌ Error refreshing relationships after DELETE:', error);
      });
    }
  }).catch(error => {
    console.error('❌ Error getting current user ID:', error);
  });
}

// Handle friend request delete events (separate handler for unfiltered events)
function handleFriendRequestsDelete(payload: any) {
  // This handler is for the unfiltered DELETE events channel
  // We can use the same logic as handleFriendRequests
  handleFriendRequests(payload);
}

const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  searchResults: [],
  isSearching: false,
  isLoading: false,
  isLoadingRequests: false,
  isLoadingFriends: false,

  // Search users with relationship status
  searchUsers: async (query: string) => {
    if (!query || query.length < 2) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    try {
      console.log('🔍 Searching users:', query);
      const users = await relationshipService.searchUsers(query);
      set({ searchResults: users });
      console.log('✅ Search completed, found:', users.length, 'users');
    } catch (error) {
      console.error('❌ Error searching users:', error);
      set({ searchResults: [] });
    } finally {
      set({ isSearching: false });
    }
  },

  // Send friend request
  sendFriendRequest: async (userId: string): Promise<boolean> => {
    try {
      const success = await relationshipService.sendFriendRequest(userId);
      if (success) {
        console.log('🚀 Friend request sent, updating UI immediately...');
        
        // Update search results to show pending status immediately
        const { searchResults } = get();
        set({
          searchResults: searchResults.map(user => 
            user.id === userId 
              ? { ...user, relationshipStatus: 'pending_sent' as RelationshipStatus }
              : user
          )
        });
        
        // Force reload outgoing requests immediately (bypass cache)
        try {
          console.log('📤 Force loading outgoing requests (bypass cache)...');
          const requests = await relationshipService.getOutgoingRequests();
          set({ outgoingRequests: requests });

          console.log('✅ Outgoing requests force loaded:', requests.length);
        } catch (error) {
          console.error('❌ Error force loading outgoing requests:', error);
        }
        
        console.log('✅ UI updated after sending friend request');
      }
      return success;
    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      return false;
    }
  },

  // Accept friend request
  acceptFriendRequest: async (requestId: string): Promise<boolean> => {
    try {
      const success = await relationshipService.acceptFriendRequest(requestId);
      if (success) {
        console.log('🚀 Friend request accepted, updating UI immediately...');
        
        // Force reload all data immediately (bypass cache)
        try {
          console.log('🔄 Force loading all relationships (bypass cache)...');
          
          const [friends, incomingRequests, outgoingRequests] = await Promise.all([
            relationshipService.getFriends(),
            relationshipService.getIncomingRequests(),
            relationshipService.getOutgoingRequests(),
          ]);
          
          set({ 
            friends, 
            incomingRequests, 
            outgoingRequests 
          });
          
          // Update cache times



          
          console.log('✅ All relationships force loaded:', {
            friends: friends.length,
            incoming: incomingRequests.length,
            outgoing: outgoingRequests.length
          });
        } catch (error) {
          console.error('❌ Error force loading relationships:', error);
        }
      }
      return success;
    } catch (error) {
      console.error('❌ Error accepting friend request:', error);
      return false;
    }
  },

  // Decline friend request
  declineFriendRequest: async (requestId: string): Promise<boolean> => {
    try {
      const success = await relationshipService.declineFriendRequest(requestId);
      if (success) {
        console.log('🚀 Friend request declined, updating UI immediately...');
        
        // Remove from incoming requests immediately
        const { incomingRequests } = get();
        set({
          incomingRequests: incomingRequests.filter(req => req.request_id !== requestId)
        });
        
        // Force reload incoming requests to ensure consistency (bypass cache)
        try {
          console.log('📥 Force loading incoming requests (bypass cache)...');
          const requests = await relationshipService.getIncomingRequests();
          set({ incomingRequests: requests });

          console.log('✅ Incoming requests force loaded:', requests.length);
        } catch (error) {
          console.error('❌ Error force loading incoming requests:', error);
        }
      }
      return success;
    } catch (error) {
      console.error('❌ Error declining friend request:', error);
      return false;
    }
  },

  // Cancel friend request
  cancelFriendRequest: async (receiverId: string): Promise<boolean> => {
    try {
      const success = await relationshipService.cancelFriendRequest(receiverId);
      if (success) {
        console.log('🚀 Friend request cancelled, updating UI immediately...');
        
        // Update search results immediately
        const { searchResults } = get();
        set({
          searchResults: searchResults.map(user => 
            user.id === receiverId 
              ? { ...user, relationshipStatus: 'none' as RelationshipStatus }
              : user
          )
        });
        
        // Force reload outgoing requests immediately (bypass cache)
        try {
          console.log('📤 Force loading outgoing requests (bypass cache)...');
          const requests = await relationshipService.getOutgoingRequests();
          set({ outgoingRequests: requests });

          console.log('✅ Outgoing requests force loaded:', requests.length);
        } catch (error) {
          console.error('❌ Error force loading outgoing requests:', error);
        }
      }
      return success;
    } catch (error) {
      console.error('❌ Error cancelling friend request:', error);
      return false;
    }
  },

  // Remove friend
  removeFriend: async (friendId: string): Promise<boolean> => {
    try {
      console.log('💔 Starting friend removal process for:', friendId);
      const success = await relationshipService.removeFriend(friendId);
      if (success) {
        console.log('🚀 Friend removed from backend, updating UI immediately...');
        
        // Remove from friends list immediately
        const { friends, searchResults } = get();
        console.log('👥 Current friends before removal:', friends.length);
        const updatedFriends = friends.filter(friend => friend.friend_id !== friendId);
        console.log('👥 Friends after filtering:', updatedFriends.length);
        
        set({
          friends: updatedFriends,
          searchResults: searchResults.map(user => 
            user.id === friendId 
              ? { ...user, relationshipStatus: 'none' as RelationshipStatus }
              : user
          )
        });
        
        console.log('✅ Friend removed from UI immediately');
        
        // Force reload friends list to ensure consistency (bypass cache)
        try {
          console.log('👥 Force loading friends (bypass cache)...');
          const freshFriends = await relationshipService.getFriends();
          set({ friends: freshFriends });

          console.log('✅ Friends force loaded:', freshFriends.length);
        } catch (error) {
          console.error('❌ Error force loading friends:', error);
        }
      } else {
        console.log('❌ Backend friend removal failed');
      }
      return success;
    } catch (error) {
      console.error('❌ Error removing friend:', error);
      return false;
    }
  },

  // Load friends
  loadFriends: async () => {
    set({ isLoadingFriends: true });
    try {
      console.log('👥 Loading friends...');
      const friends = await relationshipService.getFriends();
      set({ friends });
      console.log('✅ Friends loaded:', friends.length);
    } catch (error) {
      console.error('❌ Error loading friends:', error);
      set({ friends: [] });
    } finally {
      set({ isLoadingFriends: false });
    }
  },

  // Load incoming requests
  loadIncomingRequests: async () => {
    set({ isLoadingRequests: true });
    try {
      console.log('📥 Loading incoming requests...');
      const requests = await relationshipService.getIncomingRequests();
      set({ incomingRequests: requests });
      console.log('✅ Incoming requests loaded:', requests.length);
    } catch (error) {
      console.error('❌ Error loading incoming requests:', error);
      set({ incomingRequests: [] });
    } finally {
      set({ isLoadingRequests: false });
    }
  },

  // Load outgoing requests
  loadOutgoingRequests: async () => {
    try {
      console.log('📤 Loading outgoing requests...');
      const requests = await relationshipService.getOutgoingRequests();
      set({ outgoingRequests: requests });
      console.log('✅ Outgoing requests loaded:', requests.length);
    } catch (error) {
      console.error('❌ Error loading outgoing requests:', error);
      set({ outgoingRequests: [] });
    }
  },

  // Load all relationship data
  loadAllRelationships: async () => {
    set({ isLoading: true });
    try {
      console.log('🔄 Loading all relationships...');
      await Promise.all([
        get().loadFriends(),
        get().loadIncomingRequests(),
        get().loadOutgoingRequests(),
      ]);
      console.log('✅ All relationships loaded');
    } catch (error) {
      console.error('❌ Error loading relationships:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Start real-time updates
  startRealTimeUpdates: async () => {
    try {
      console.log('🚀 Starting friend real-time updates via RealtimeManager...');

      // Load initial data immediately when real-time starts
      console.log('📊 Loading initial friend data...');
      await get().loadAllRelationships();

      // Register event handlers with RealtimeManager
      realtimeManager.on('friend_requests', handleFriendRequests, 'friendsStore');
      realtimeManager.on('friend_requests_delete', handleFriendRequestsDelete, 'friendsStore');

      console.log('✅ Friend real-time handlers registered with RealtimeManager!');

    } catch (error) {
      console.error('❌ Error starting friend real-time updates:', error);
    }
  },

  // Stop real-time updates
  stopRealTimeUpdates: () => {
    console.log('🛑 Stopping friend real-time updates via RealtimeManager...');

    // Remove all event handlers
    realtimeManager.off('friend_requests', handleFriendRequests);
    realtimeManager.off('friend_requests_delete', handleFriendRequestsDelete);

    console.log('✅ Friend real-time handlers removed from RealtimeManager');
  },

  // Force refresh all data (for pull-to-refresh)
  forceRefresh: async () => {
    console.log('🔄 Force refreshing all friend data...');

    // Reload all data
    await get().loadAllRelationships();

    console.log('✅ Force refresh completed');
  },
}));

export default useFriendsStore; 