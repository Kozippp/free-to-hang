import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
}

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  users: User;
}

interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
  users: User;
}

interface SearchUser {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
}

interface FriendsState {
  searchResults: SearchUser[];
  friendRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  blockedUsers: BlockedUser[];
  searchQuery: string;
  isSearching: boolean;
  isLoading: boolean;
  
  // Actions
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  loadFriendRequests: () => Promise<void>;
  loadSentRequests: () => Promise<void>;
  loadBlockedUsers: () => Promise<void>;
  clearSearch: () => void;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  
  // Real-time functions
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
}

// Real-time subscription variable
let friendRequestsChannel: RealtimeChannel | null = null;

const useFriendsStore = create<FriendsState>((set, get) => ({
  searchResults: [],
  friendRequests: [],
  sentRequests: [],
  blockedUsers: [],
  searchQuery: '',
  isSearching: false,
  isLoading: false,

  searchUsers: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Search by username or email
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio')
        .or(`username.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`)
        .neq('id', currentUser.id) // Exclude current user
        .limit(20);

      if (error) {
        console.error('Search error:', error);
        return;
      }

      // Filter out users who are already friends or have pending requests
      const { data: existingConnections } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', currentUser.id);

      const connectedUserIds = existingConnections?.map((conn: any) => conn.friend_id) || [];
      const filteredUsers = users?.filter((user: any) => !connectedUserIds.includes(user.id)) || [];

      set({ searchResults: filteredUsers });
    } catch (error) {
      console.error('Search users error:', error);
    } finally {
      set({ isSearching: false });
    }
  },

  sendFriendRequest: async (friendId: string) => {
    set({ isLoading: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Check if friend request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('friend_requests')
        .select('id')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is what we want
        console.error('Error checking existing request:', checkError);
        throw checkError;
      }

      if (existingRequest) {
        // Request already exists
        console.log('Friend request already exists');
        return;
      }

      // Check if they're already friends
      const { data: existingFriendship, error: friendshipError } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('friend_id', friendId)
        .single();

      if (friendshipError && friendshipError.code !== 'PGRST116') {
        console.error('Error checking existing friendship:', friendshipError);
        throw friendshipError;
      }

      if (existingFriendship) {
        console.log('Users are already friends');
        return;
      }

      // Send the friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert([
          { 
            sender_id: currentUser.id, 
            receiver_id: friendId, 
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('Send friend request error:', error);
        throw error;
      }

      console.log('Friend request sent successfully');

      // Remove from search results immediately for better UX
      const { searchResults } = get();
      set({ 
        searchResults: searchResults.filter(user => user.id !== friendId) 
      });
      
    } catch (error) {
      console.error('Send friend request error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  acceptFriendRequest: async (requestId: string) => {
    set({ isLoading: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Get the friend request details first
      const request = get().friendRequests.find(req => req.id === requestId);
      if (!request) {
        throw new Error('Friend request not found');
      }

      // Delete the friend request from friend_requests table
      const { error: deleteRequestError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (deleteRequestError) throw deleteRequestError;

      // Add to friendships table (bidirectional)
      const { error: friendshipError } = await supabase
        .from('friendships')
        .insert([
          { user_id: currentUser.id, friend_id: request.user_id },
          { user_id: request.user_id, friend_id: currentUser.id }
        ]);

      if (friendshipError) {
        console.error('Friendship creation error:', friendshipError);
        // If it's a duplicate key error, that means they're already friends
        if (friendshipError.code !== '23505') {
          throw friendshipError;
        }
      }

      // Reload friend requests and friends
      await get().loadFriendRequests();
      
    } catch (error) {
      console.error('Accept friend request error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  declineFriendRequest: async (requestId: string) => {
    set({ isLoading: true });
    
    try {
      // Delete the friend request from friend_requests table
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('Decline friend request error:', error);
        throw error;
      }

      console.log('Friend request declined successfully');

      // Remove from friend requests immediately for better UX
      const { friendRequests } = get();
      set({ 
        friendRequests: friendRequests.filter(req => req.id !== requestId) 
      });
      
    } catch (error) {
      console.error('Decline friend request error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadFriendRequests: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          users!friend_requests_sender_id_fkey (
            id,
            name,
            username,
            avatar_url,
            vibe
          )
        `)
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Load friend requests error:', error);
        return;
      }

      // Transform the response to match our interface
      const transformedRequests = requests?.map((request: any) => ({
        id: request.id,
        user_id: request.sender_id,
        friend_id: request.receiver_id,
        status: request.status,
        created_at: request.created_at,
        users: Array.isArray(request.users) ? request.users[0] : request.users
      })) as FriendRequest[];

      set({ friendRequests: transformedRequests || [] });
    } catch (error) {
      console.error('Load friend requests error:', error);
    }
  },

  loadSentRequests: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: requests, error } = await supabase
        .from('friends')
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          users!friends_friend_id_fkey (
            id,
            name,
            username,
            avatar_url,
            bio
          )
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Load sent requests error:', error);
        return;
      }

      // Transform the response to match our interface
      const transformedRequests = requests?.map((request: any) => ({
        ...request,
        users: Array.isArray(request.users) ? request.users[0] : request.users
      })) as FriendRequest[];

      set({ sentRequests: transformedRequests || [] });
    } catch (error) {
      console.error('Load sent requests error:', error);
    }
  },

  loadBlockedUsers: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: blockedUsers, error } = await supabase
        .from('blocked_users')
        .select(`
          id,
          user_id,
          blocked_user_id,
          created_at,
          users!blocked_users_user_id_fkey (
            id,
            name,
            username,
            avatar_url,
            bio
          )
        `)
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Load blocked users error:', error);
        return;
      }

      set({ blockedUsers: blockedUsers || [] });
    } catch (error) {
      console.error('Load blocked users error:', error);
    }
  },

  clearSearch: () => {
    set({ searchResults: [] });
  },

  blockUser: async (userId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('blocked_users')
        .insert([
          { user_id: currentUser.id, blocked_user_id: userId, created_at: new Date().toISOString() }
        ]);

      if (error) throw error;

      // Remove from friend requests
      const { friendRequests } = get();
      set({ 
        friendRequests: friendRequests.filter(req => req.user_id !== userId && req.friend_id !== userId) 
      });

      // Remove from search results
      const { searchResults } = get();
      set({ 
        searchResults: searchResults.filter(user => user.id !== userId) 
      });
      
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  },

  unblockUser: async (userId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('blocked_user_id', userId);

      if (error) throw error;

      // Reload friend requests
      await get().loadFriendRequests();
      
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    }
  },

  startRealTimeUpdates: () => {
    // Clear any existing channel
    if (friendRequestsChannel) {
      supabase.removeChannel(friendRequestsChannel);
    }
    
    console.log('👥 Starting friends realtime...');
    
    // Simple channel for friend-related updates
    friendRequestsChannel = supabase
      .channel('friends-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        (payload: any) => {
          console.log('📬 Friend request changed');
          get().loadFriendRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_users' },
        (payload: any) => {
          console.log('🚫 Blocked users changed');
          get().loadBlockedUsers();
        }
      )
      .subscribe((status: any) => {
        console.log('📡 Friends realtime status:', status);
      });
  },

  stopRealTimeUpdates: () => {
    if (friendRequestsChannel) {
      supabase.removeChannel(friendRequestsChannel);
      friendRequestsChannel = null;
    }
  },
}));

export default useFriendsStore; 