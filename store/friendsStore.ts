import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { relationshipService, RelationshipStatus, Friend, FriendRequest } from '@/lib/relationship-service';

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

// Global variables for real-time subscriptions
let friendRequestsChannel: any = null;
let isStartingRealTime = false;
let isSubscribed = false;

// Throttling for real-time updates
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 1000; // Max 1 update per second

// Debouncing for data loading
let loadTimeouts: { [key: string]: NodeJS.Timeout } = {};

// Cache to prevent unnecessary API calls
let lastLoadTimes: { [key: string]: number } = {};
const CACHE_DURATION_MS = 2000; // Cache data for 2 seconds

function shouldRefreshData(key: string): boolean {
  const now = Date.now();
  const lastLoad = lastLoadTimes[key] || 0;
  return (now - lastLoad) > CACHE_DURATION_MS;
}

function invalidateCache(key?: string) {
  if (key) {
    delete lastLoadTimes[key];
    console.log(`🗑️ Cache invalidated for: ${key}`);
  } else {
    lastLoadTimes = {};
    console.log('🗑️ All cache invalidated');
  }
}

function throttledUpdate(key: string, updateFn: () => void, delay: number = UPDATE_THROTTLE_MS) {
  const now = Date.now();
  
  // Clear existing timeout
  if (loadTimeouts[key]) {
    clearTimeout(loadTimeouts[key]);
  }
  
  // If enough time has passed, update immediately
  if (now - lastUpdateTime > delay) {
    lastUpdateTime = now;
    updateFn();
  } else {
    // Otherwise, schedule update
    loadTimeouts[key] = setTimeout(() => {
      lastUpdateTime = Date.now();
      updateFn();
      delete loadTimeouts[key];
    }, delay - (now - lastUpdateTime));
  }
}

// Handle real-time changes efficiently
function handleRealtimeChange(payload: any, currentUserId: string) {
  const { eventType, new: newRecord, old: oldRecord } = payload;
  
  if (eventType === 'INSERT') {
    // New friend request created
    const request = newRecord as any;
    
    if (request.receiver_id === currentUserId) {
      // Incoming request - someone sent me a request
      console.log('📥 New incoming friend request received via real-time');
      
      // Force reload incoming requests (bypass cache)
      relationshipService.getIncomingRequests().then(requests => {
        useFriendsStore.setState({ incomingRequests: requests });
        lastLoadTimes['incoming'] = Date.now();
        console.log('✅ Incoming requests updated via real-time:', requests.length);
      }).catch(error => {
        console.error('❌ Error updating incoming requests via real-time:', error);
      });
      
    } else if (request.sender_id === currentUserId) {
      // Outgoing request - I sent a request
      console.log('📤 New outgoing friend request sent via real-time');
      
      // Force reload outgoing requests (bypass cache)
      relationshipService.getOutgoingRequests().then(requests => {
        useFriendsStore.setState({ outgoingRequests: requests });
        lastLoadTimes['outgoing'] = Date.now();
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
      
      // Force reload friends list to include new friend (bypass cache)
      relationshipService.getFriends().then(friends => {
        useFriendsStore.setState({ friends });
        lastLoadTimes['friends'] = Date.now();
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
      available_data: Object.keys(request),
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
      
      // Update cache times
      lastLoadTimes['friends'] = Date.now();
      lastLoadTimes['incoming'] = Date.now();
      lastLoadTimes['outgoing'] = Date.now();
      
      console.log('✅ All relationships refreshed via real-time after DELETE:', {
        friends: friends.length,
        incoming: incomingRequests.length,
        outgoing: outgoingRequests.length
      });
    }).catch(error => {
      console.error('❌ Error refreshing relationships after DELETE:', error);
    });
  }
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
          lastLoadTimes['outgoing'] = Date.now();
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
          lastLoadTimes['friends'] = Date.now();
          lastLoadTimes['incoming'] = Date.now();
          lastLoadTimes['outgoing'] = Date.now();
          
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
          lastLoadTimes['incoming'] = Date.now();
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
          lastLoadTimes['outgoing'] = Date.now();
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
          lastLoadTimes['friends'] = Date.now();
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
    if (!shouldRefreshData('friends')) {
      console.log('⚡ Using cached friends data');
      return;
    }
    
    set({ isLoadingFriends: true });
    try {
      console.log('👥 Loading friends...');
      const friends = await relationshipService.getFriends();
      set({ friends });
      lastLoadTimes['friends'] = Date.now();
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
    if (!shouldRefreshData('incoming')) {
      console.log('⚡ Using cached incoming requests data');
      return;
    }
    
    set({ isLoadingRequests: true });
    try {
      console.log('📥 Loading incoming requests...');
      const requests = await relationshipService.getIncomingRequests();
      set({ incomingRequests: requests });
      lastLoadTimes['incoming'] = Date.now();
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
    if (!shouldRefreshData('outgoing')) {
      console.log('⚡ Using cached outgoing requests data');
      return;
    }
    
    try {
      console.log('📤 Loading outgoing requests...');
      const requests = await relationshipService.getOutgoingRequests();
      set({ outgoingRequests: requests });
      lastLoadTimes['outgoing'] = Date.now();
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
    if (isStartingRealTime || isSubscribed) {
      console.log('🛑 Real-time subscription already active or starting');
      return;
    }

    isStartingRealTime = true;
    
    try {
      console.log('🚀 Starting friend real-time updates...');
      
      // Stop any existing channel
      if (friendRequestsChannel) {
        await supabase.removeChannel(friendRequestsChannel);
        friendRequestsChannel = null;
      }

      // Get current user ID for filtering
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⏸️ No authenticated user - skipping real-time subscription');
        return;
      }

      // Create new channel for friend_requests table with comprehensive filtering
      friendRequestsChannel = supabase
        .channel(`friend_requests_${user.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friend_requests',
            filter: `sender_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 Friend request change (outgoing):', payload);
            // Handle outgoing request changes
            handleRealtimeChange(payload, user.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 Friend request change (incoming):', payload);
            // Handle incoming request changes
            handleRealtimeChange(payload, user.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'friend_requests'
          },
          (payload) => {
            console.log('📡 Friend request DELETE event (global):', payload);
            // Since DELETE events only contain the ID, we can't filter by user
            // So we process all DELETE events and let the handler refresh data
            console.log('📡 Processing DELETE event for potential relationship changes...');
            handleRealtimeChange(payload, user.id);
          }
        )
        .subscribe((status) => {
          console.log('📡 Friend requests channel status:', status);
          
          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            console.log('✅ Friend real-time subscription started');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Friend real-time channel error');
            isSubscribed = false;
          } else if (status === 'CLOSED') {
            isSubscribed = false;
          }
        });

    } catch (error) {
      console.error('❌ Error starting friend real-time updates:', error);
      isSubscribed = false;
    } finally {
      isStartingRealTime = false;
    }
  },

  // Stop real-time updates
  stopRealTimeUpdates: () => {
    console.log('🛑 Stopping friend real-time updates...');
    
    if (friendRequestsChannel) {
      supabase.removeChannel(friendRequestsChannel);
      friendRequestsChannel = null;
    }
    
    isSubscribed = false;
    isStartingRealTime = false;
    console.log('✅ Friend real-time updates stopped');
  },

  // Force refresh all data (for pull-to-refresh)
  forceRefresh: async () => {
    console.log('🔄 Force refreshing all friend data...');
    
    // Clear all cache
    invalidateCache();
    
    // Reload all data
    await get().loadAllRelationships();
    
    console.log('✅ Force refresh completed');
  },
}));

export default useFriendsStore; 