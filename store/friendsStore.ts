import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
}

interface FriendRequest {
  id: string;
  user_id: string;  // sender_id actually
  friend_id: string; // receiver_id actually
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  users: User;
}

interface FriendsState {
  searchResults: User[];
  friendRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  isSearching: boolean;
  isLoading: boolean;
  
  // Actions
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  cancelSentRequest: (requestId: string) => Promise<void>;
  loadFriendRequests: () => Promise<void>;
  loadSentRequests: () => Promise<void>;
  clearSearchResults: () => void;
  
  // Realtime
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
  loadBlockedUsers: () => Promise<void>;
}

// Realtime channel variable
let friendRequestsChannel: RealtimeChannel | null = null;

const useFriendsStore = create<FriendsState>((set, get) => ({
  searchResults: [],
  friendRequests: [],
  sentRequests: [],
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

      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio, vibe')
        .or(`name.ilike.%${query}%, username.ilike.%${query}%`)
        .neq('id', currentUser.id)
        .limit(50);

      if (error) throw error;

      // Filter out ONLY existing friends (accepted friendships)
      const { data: existingFriendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUser.id);

      if (friendshipsError) {
        console.error('Error checking friendships:', friendshipsError);
      }

      const friendIds = new Set(existingFriendships?.map((f: any) => f.friend_id) || []);

      // Only filter out confirmed friends, keep everyone else including pending requests
      const filteredUsers = users?.filter((user: any) => 
        !friendIds.has(user.id)
      ) || [];

      set({ searchResults: filteredUsers });
      
    } catch (error) {
      console.error('Search users error:', error);
      set({ searchResults: [] });
    } finally {
      set({ isSearching: false });
    }
  },

  sendFriendRequest: async (friendId: string) => {
    set({ isLoading: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // CHECK: Kas juba sõbrad?
      const { data: existingFriendship, error: friendshipCheckError } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('friend_id', friendId)
        .maybeSingle();

      if (friendshipCheckError) {
        console.error('Friendship check error:', friendshipCheckError);
      }

      if (existingFriendship) {
        console.log('Already friends');
        return;
      }

      // CHECK: Kas juba on pending request?
      const { data: existingRequest, error: requestCheckError } = await supabase
        .from('friend_requests')
        .select('id')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
        .eq('status', 'pending')
        .maybeSingle();

      if (requestCheckError) {
        console.error('Request check error:', requestCheckError);
      }

      if (existingRequest) {
        console.log('Request already exists');
        return;
      }

      // SEND REQUEST
      const { error: insertError } = await supabase
        .from('friend_requests')
        .insert([
          { 
            sender_id: currentUser.id, 
            receiver_id: friendId, 
            status: 'pending'
          }
        ]);

      if (insertError) {
        console.error('Send friend request error:', insertError);
        throw insertError;
      }

      // Reload sent requests
      await get().loadSentRequests();
      
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
      const { data: request, error: requestError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError || !request) {
        console.error('Friend request not found:', requestError);
        throw new Error('Friend request not found');
      }

      // BIDIRECTIONAL FRIENDSHIP CREATION
      // First friendship: currentUser -> sender
      // Second friendship: sender -> currentUser
      const { error: friendshipError } = await supabase
        .from('friendships')
        .insert([
          { user_id: currentUser.id, friend_id: request.sender_id },
          { user_id: request.sender_id, friend_id: currentUser.id }
        ]);

      if (friendshipError) {
        console.error('Friendship creation error:', friendshipError);
        // If it's a duplicate key error, that means they're already friends
        if (friendshipError.code !== '23505') {
          throw friendshipError;
        }
      }

      // DELETE the friend request (cleanup)
      const { error: deleteError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (deleteError) {
        console.error('Delete request error:', deleteError);
        // Don't throw - friendship was created successfully
      }

      // Reload friend requests
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
      // Simply DELETE the request (clean decline)
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('Decline friend request error:', error);
        throw error;
      }

      // Reload friend requests
      await get().loadFriendRequests();
      
    } catch (error) {
      console.error('Decline friend request error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  cancelSentRequest: async (requestId: string) => {
    set({ isLoading: true });
    
    try {
      // DELETE the sent request
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('Cancel sent request error:', error);
        throw error;
      }

      // Reload sent requests
      await get().loadSentRequests();
      
    } catch (error) {
      console.error('Cancel sent request error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadFriendRequests: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Load RECEIVED friend requests
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
            bio,
            vibe
          )
        `)
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Load friend requests error:', error);
        return;
      }

      // Transform for UI compatibility
      const transformedRequests = requests?.map((request: any) => ({
        id: request.id,
        user_id: request.sender_id,  // For UI compatibility
        friend_id: request.receiver_id,
        status: request.status,
        created_at: request.created_at,
        users: request.users
      })) as FriendRequest[];

      set({ friendRequests: transformedRequests || [] });
      console.log('📬 Friend requests loaded:', transformedRequests?.length || 0);
      
    } catch (error) {
      console.error('Load friend requests error:', error);
      set({ friendRequests: [] });
    }
  },

  loadSentRequests: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Load SENT friend requests
      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          users!friend_requests_receiver_id_fkey (
            id,
            name,
            username,
            avatar_url,
            bio,
            vibe
          )
        `)
        .eq('sender_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Load sent requests error:', error);
        return;
      }

      // Transform for UI compatibility
      const transformedRequests = requests?.map((request: any) => ({
        id: request.id,
        user_id: request.sender_id,
        friend_id: request.receiver_id,  // For UI compatibility
        status: request.status,
        created_at: request.created_at,
        users: request.users
      })) as FriendRequest[];

      set({ sentRequests: transformedRequests || [] });
      console.log('📤 Sent requests loaded:', transformedRequests?.length || 0);
      
    } catch (error) {
      console.error('Load sent requests error:', error);
      set({ sentRequests: [] });
    }
  },

  clearSearchResults: () => {
    set({ searchResults: [] });
  },

  loadBlockedUsers: async () => {
    // Placeholder for blocked users functionality
    console.log('🚫 Blocked users loading...');
  },

  // 🌍 REALTIME SUBSCRIPTIONS
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
          console.log('📬 Friend request changed:', payload.eventType);
          // Reload both incoming and outgoing requests
          get().loadFriendRequests();
          get().loadSentRequests();
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
    console.log('⏹️ Stopping friends realtime...');
    
    if (friendRequestsChannel) {
      supabase.removeChannel(friendRequestsChannel);
      friendRequestsChannel = null;
    }
  }
}));

export default useFriendsStore; 