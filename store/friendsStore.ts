import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { RelationshipStatus, Friend, FriendRequest } from '@/lib/relationship-service';
import { friendsDirectService } from '@/lib/friends-direct-service';
import { triggerFriendRequestNotification, triggerFriendAcceptedNotification } from '@/lib/notification-trigger';
import { prefetchAvatars } from '@/utils/avatarCache';
import useHangStore from '@/store/hangStore';

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
let friendRestartTimeout: ReturnType<typeof setTimeout> | null = null;
let friendRetryAttempts = 0;
const FRIEND_RETRY_DELAYS_MS = [2000, 5000, 10000, 30000, 60000];
const MAX_FRIEND_RETRIES = 3;
const FRIEND_HEALTH_CHECK_INTERVAL = 60000; // 60s
let friendHealthCheckInterval: ReturnType<typeof setInterval> | null = null;

// Throttling for real-time updates
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 1000; // Max 1 update per second

// Debouncing for data loading
let loadTimeouts: { [key: string]: ReturnType<typeof setTimeout> } = {};

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
      friendsDirectService.getIncomingRequests().then(requests => {
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
      friendsDirectService.getOutgoingRequests().then(requests => {
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
      friendsDirectService.getFriends().then(friends => {
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
      friendsDirectService.getFriends(),
      friendsDirectService.getIncomingRequests(),
      friendsDirectService.getOutgoingRequests(),
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

  // Search users with relationship status (DIRECT SUPABASE)
  searchUsers: async (query: string) => {
    if (!query || query.length < 2) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    try {
      console.log('🔍 [DIRECT] Searching users:', query);
      // Use direct Supabase service for reading data
      const users = await friendsDirectService.searchUsers(query);
      set({ searchResults: users });
      void prefetchAvatars(
        users.map(user => ({
          userId: user.id,
          avatarUrl: user.avatar_url
        }))
      );
      console.log('✅ [DIRECT] Search completed, found:', users.length, 'users');
    } catch (error) {
      console.error('❌ [DIRECT] Error searching users:', error);
      set({ searchResults: [] });
    } finally {
      set({ isSearching: false });
    }
  },

  // Send friend request (direct Supabase + notification trigger)
  sendFriendRequest: async (userId: string): Promise<boolean> => {
    try {
      const result = await friendsDirectService.sendFriendRequest(userId);
      if (result.success && result.requestId) {
        console.log('🚀 Friend request sent, updating UI immediately...');
        
        // Trigger notification (fire-and-forget, don't block UI)
        void triggerFriendRequestNotification(userId, result.requestId);
        
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
          const requests = await friendsDirectService.getOutgoingRequests();
          set({ outgoingRequests: requests });
          lastLoadTimes['outgoing'] = Date.now();
        } catch (error) {
          console.error('❌ Error force loading outgoing requests:', error);
        }
        
        console.log('✅ UI updated after sending friend request');
      }
      return result.success;
    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      return false;
    }
  },

  // Accept friend request (direct Supabase + notification trigger)
  acceptFriendRequest: async (requestId: string): Promise<boolean> => {
    try {
      const success = await friendsDirectService.acceptFriendRequest(requestId);
      if (success) {
        console.log('🚀 Friend request accepted, updating UI immediately...');
        
        // Trigger notification (fire-and-forget)
        void triggerFriendAcceptedNotification(requestId);
        
        // Force reload all data immediately (bypass cache)
        try {
          const [friends, incomingRequests, outgoingRequests] = await Promise.all([
            friendsDirectService.getFriends(),
            friendsDirectService.getIncomingRequests(),
            friendsDirectService.getOutgoingRequests(),
          ]);
          
          set({ 
            friends, 
            incomingRequests, 
            outgoingRequests 
          });
          
          lastLoadTimes['friends'] = Date.now();
          lastLoadTimes['incoming'] = Date.now();
          lastLoadTimes['outgoing'] = Date.now();

          // Profile uses hangStore for friends list - must refresh so new friend appears
          void useHangStore.getState().loadFriends();
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

  // Decline friend request (direct Supabase)
  declineFriendRequest: async (requestId: string): Promise<boolean> => {
    try {
      const success = await friendsDirectService.declineFriendRequest(requestId);
      if (success) {
        // Remove from incoming requests immediately
        const { incomingRequests } = get();
        set({
          incomingRequests: incomingRequests.filter(req => req.request_id !== requestId)
        });
        
        try {
          const requests = await friendsDirectService.getIncomingRequests();
          set({ incomingRequests: requests });
          lastLoadTimes['incoming'] = Date.now();
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

  // Cancel friend request (direct Supabase)
  cancelFriendRequest: async (receiverId: string): Promise<boolean> => {
    try {
      const success = await friendsDirectService.cancelFriendRequest(receiverId);
      if (success) {
        // Update search results immediately
        const { searchResults } = get();
        set({
          searchResults: searchResults.map(user => 
            user.id === receiverId 
              ? { ...user, relationshipStatus: 'none' as RelationshipStatus }
              : user
          )
        });
        
        try {
          const requests = await friendsDirectService.getOutgoingRequests();
          set({ outgoingRequests: requests });
          lastLoadTimes['outgoing'] = Date.now();
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

  // Remove friend (direct Supabase)
  removeFriend: async (friendId: string): Promise<boolean> => {
    try {
      const success = await friendsDirectService.removeFriend(friendId);
      if (success) {
        // Remove from friends list immediately
        const { friends, searchResults } = get();
        const updatedFriends = friends.filter(friend => friend.friend_id !== friendId);
        
        set({
          friends: updatedFriends,
          searchResults: searchResults.map(user => 
            user.id === friendId 
              ? { ...user, relationshipStatus: 'none' as RelationshipStatus }
              : user
          )
        });
        
        try {
          const freshFriends = await friendsDirectService.getFriends();
          set({ friends: freshFriends });
          lastLoadTimes['friends'] = Date.now();
          // Profile uses hangStore friends - must refresh so UI updates
          void useHangStore.getState().loadFriends();
        } catch (error) {
          console.error('❌ Error force loading friends:', error);
        }
      }
      return success;
    } catch (error) {
      console.error('❌ Error removing friend:', error);
      return false;
    }
  },

  // Load friends (DIRECT SUPABASE)
  loadFriends: async () => {
    if (!shouldRefreshData('friends')) {
      console.log('⚡ Using cached friends data');
      return;
    }
    
    set({ isLoadingFriends: true });
    try {
      console.log('👥 [DIRECT] Loading friends...');
      // Use direct Supabase service for reading data
      const friends = await friendsDirectService.getFriends();
      set({ friends });
      void prefetchAvatars(
        friends.map(friend => ({
          userId: friend.friend_id,
          avatarUrl: friend.friend_avatar_url
        }))
      );
      lastLoadTimes['friends'] = Date.now();
      console.log('✅ [DIRECT] Friends loaded:', friends.length);
    } catch (error) {
      console.error('❌ [DIRECT] Error loading friends:', error);
      set({ friends: [] });
    } finally {
      set({ isLoadingFriends: false });
    }
  },

  // Load incoming requests (DIRECT SUPABASE)
  loadIncomingRequests: async () => {
    if (!shouldRefreshData('incoming')) {
      console.log('⚡ Using cached incoming requests data');
      return;
    }
    
    set({ isLoadingRequests: true });
    try {
      console.log('📥 [DIRECT] Loading incoming requests...');
      // Use direct Supabase service for reading data
      const requests = await friendsDirectService.getIncomingRequests();
      set({ incomingRequests: requests });
      void prefetchAvatars(
        requests.map(request => ({
          userId: request.sender_id,
          avatarUrl: request.sender_avatar_url
        }))
      );
      lastLoadTimes['incoming'] = Date.now();
      console.log('✅ [DIRECT] Incoming requests loaded:', requests.length);
    } catch (error) {
      console.error('❌ [DIRECT] Error loading incoming requests:', error);
      set({ incomingRequests: [] });
    } finally {
      set({ isLoadingRequests: false });
    }
  },

  // Load outgoing requests (DIRECT SUPABASE)
  loadOutgoingRequests: async () => {
    if (!shouldRefreshData('outgoing')) {
      console.log('⚡ Using cached outgoing requests data');
      return;
    }
    
    try {
      console.log('📤 [DIRECT] Loading outgoing requests...');
      // Use direct Supabase service for reading data
      const requests = await friendsDirectService.getOutgoingRequests();
      set({ outgoingRequests: requests });
      void prefetchAvatars(
        requests.map(request => ({
          userId: request.receiver_id,
          avatarUrl: request.receiver_avatar_url
        }))
      );
      lastLoadTimes['outgoing'] = Date.now();
      console.log('✅ [DIRECT] Outgoing requests loaded:', requests.length);
    } catch (error) {
      console.error('❌ [DIRECT] Error loading outgoing requests:', error);
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
    if (isStartingRealTime || friendRequestsChannel) {
      console.log('🛑 Friend real-time already running - skipping');
      return;
    }

    isStartingRealTime = true;

    try {
      console.log('🚀 Starting friend real-time updates...');
      if (friendRestartTimeout) {
        clearTimeout(friendRestartTimeout);
        friendRestartTimeout = null;
      }
      friendRetryAttempts = 0;
      
      // Stop any existing channel first
      if (friendRequestsChannel) {
        console.log('🛑 Stopping existing friend real-time subscription...');
        stopFriendHealthCheck();
        await supabase.removeChannel(friendRequestsChannel);
        friendRequestsChannel = null;
        isSubscribed = false;
      }
      
      // Load initial data immediately when real-time starts
      console.log('📊 Loading initial friend data...');
      await get().loadAllRelationships();

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
          handleFriendChannelStatus(status);
        });
      startFriendHealthCheck();

    } catch (error) {
      console.error('❌ Error starting friend real-time updates:', error);
      isSubscribed = false;
      friendRequestsChannel = null;
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
    if (friendRestartTimeout) {
      clearTimeout(friendRestartTimeout);
      friendRestartTimeout = null;
    }
    friendRetryAttempts = 0;
    stopFriendHealthCheck();
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

function handleFriendChannelStatus(status: string) {
  console.log('📡 Friend requests channel status:', status);

  if (status === 'SUBSCRIBED') {
    isSubscribed = true;
    friendRetryAttempts = 0;
    if (friendRestartTimeout) {
      clearTimeout(friendRestartTimeout);
      friendRestartTimeout = null;
    }
    console.log('✅ Friend real-time subscription started');
    return;
  }

  if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
    if (status === 'CHANNEL_ERROR') {
      console.log('❌ Friend real-time channel error');
    } else if (status === 'CLOSED') {
      console.log('🔒 Friend real-time channel closed');
    } else {
      console.log('⏰ Friend real-time subscription timed out');
    }

    isSubscribed = false;
    friendRequestsChannel = null;
    scheduleFriendRealtimeRestart();
  }
}

function scheduleFriendRealtimeRestart() {
  if (friendRetryAttempts >= MAX_FRIEND_RETRIES) {
    console.error('❌ Friend real-time subscription failed after maximum retries');
    return;
  }

  const baseDelay =
    FRIEND_RETRY_DELAYS_MS[Math.min(friendRetryAttempts, FRIEND_RETRY_DELAYS_MS.length - 1)];
  const jitter = Math.random() * 1000;
  const delay = baseDelay + jitter;
  const attemptNumber = friendRetryAttempts + 1;
  friendRetryAttempts = attemptNumber;

  if (friendRestartTimeout) {
    clearTimeout(friendRestartTimeout);
  }

  console.log(
    `🔄 Scheduling friend real-time restart in ${delay}ms (attempt ${attemptNumber}/${MAX_FRIEND_RETRIES})`
  );

  friendRestartTimeout = setTimeout(() => {
    console.log('♻️ Attempting to restart friend real-time subscriptions...');
    friendRestartTimeout = null;

    useFriendsStore
      .getState()
      .startRealTimeUpdates()
      .catch((error) => {
        console.error('❌ Error restarting friend real-time updates:', error);
      });
  }, delay);
}

function startFriendHealthCheck() {
  if (friendHealthCheckInterval) {
    return;
  }

  console.log('💓 Starting friend health check system...');
  let failedChecks = 0;

  friendHealthCheckInterval = setInterval(() => {
    const channelState = friendRequestsChannel?.state;

    if (channelState !== 'joined') {
      failedChecks += 1;
      console.log(
        `⚠️ Friend health check warning (state: ${channelState ?? 'null'}, failures: ${failedChecks})`
      );

      if (failedChecks >= 2) {
        console.log('🔄 Friend health check triggering restart...');
        useFriendsStore
          .getState()
          .startRealTimeUpdates()
          .catch((error) => console.error('❌ Error restarting friend real-time via health check:', error));
        failedChecks = 0;
      }
    } else if (failedChecks > 0) {
      // Silently reset failure count when healthy again
      failedChecks = 0;
    }
  }, FRIEND_HEALTH_CHECK_INTERVAL);
}

function stopFriendHealthCheck() {
  if (friendHealthCheckInterval) {
    clearInterval(friendHealthCheckInterval);
    friendHealthCheckInterval = null;
    console.log('💓 Friend health check stopped');
  }
}

export default useFriendsStore; 