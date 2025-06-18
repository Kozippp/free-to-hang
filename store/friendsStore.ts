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
}

// Global variables for real-time subscriptions
let friendRequestsChannel: any = null;
let isStartingRealTime = false;
let isSubscribed = false;

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
        // Update search results to show pending status
        const { searchResults } = get();
        set({
          searchResults: searchResults.map(user => 
            user.id === userId 
              ? { ...user, relationshipStatus: 'pending_sent' as RelationshipStatus }
              : user
          )
        });
        // Reload outgoing requests
        get().loadOutgoingRequests();
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
        // Reload all data
        get().loadAllRelationships();
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
        // Remove from incoming requests
        const { incomingRequests } = get();
        set({
          incomingRequests: incomingRequests.filter(req => req.request_id !== requestId)
        });
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
        // Update search results
        const { searchResults } = get();
        set({
          searchResults: searchResults.map(user => 
            user.id === receiverId 
              ? { ...user, relationshipStatus: 'none' as RelationshipStatus }
              : user
          )
        });
        // Reload outgoing requests
        get().loadOutgoingRequests();
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
      const success = await relationshipService.removeFriend(friendId);
      if (success) {
        // Remove from friends list
        const { friends } = get();
        set({
          friends: friends.filter(friend => friend.friend_id !== friendId)
        });
        // Update search results if the user is in search
        const { searchResults } = get();
        set({
          searchResults: searchResults.map(user => 
            user.id === friendId 
              ? { ...user, relationshipStatus: 'none' as RelationshipStatus }
              : user
          )
        });
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

      // Create new channel for friend_requests table
      friendRequestsChannel = supabase
        .channel(`friend_requests_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friend_requests'
          },
          (payload) => {
            console.log('📡 Friend request change:', payload);
            
            // Reload data when changes occur
            const { loadAllRelationships } = get();
            loadAllRelationships();
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
}));

export default useFriendsStore; 