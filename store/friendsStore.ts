import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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
  loadFriendRequests: () => Promise<void>;
  loadSentRequests: () => Promise<void>;
  clearSearchResults: () => void;
}

const useFriendsStore = create<FriendsState>((set, get) => ({
  searchResults: [],
  friendRequests: [],
  sentRequests: [],
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

      const connectedUserIds = existingConnections?.map(conn => conn.friend_id) || [];
      const filteredUsers = users?.filter(user => !connectedUserIds.includes(user.id)) || [];

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
      if (!currentUser) return;

      const { error } = await supabase
        .from('friends')
        .insert([
          { user_id: currentUser.id, friend_id: friendId, status: 'pending' }
        ]);

      if (error) {
        console.error('Send friend request error:', error);
        throw error;
      }

      // Remove from search results
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

      // Update the existing request to accepted
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Create reciprocal friendship
      const request = get().friendRequests.find(req => req.id === requestId);
      if (request) {
        const { error: reciprocalError } = await supabase
          .from('friends')
          .insert([
            { user_id: currentUser.id, friend_id: request.user_id, status: 'accepted' }
          ]);

        if (reciprocalError) throw reciprocalError;
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
      const { error } = await supabase
        .from('friends')
        .update({ status: 'declined' })
        .eq('id', requestId);

      if (error) throw error;

      // Remove from friend requests
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
        .from('friends')
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          users!friends_user_id_fkey (
            id,
            name,
            username,
            avatar_url,
            bio
          )
        `)
        .eq('friend_id', currentUser.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Load friend requests error:', error);
        return;
      }

      // Transform the response to match our interface
      const transformedRequests = requests?.map((request: any) => ({
        ...request,
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

  clearSearchResults: () => {
    set({ searchResults: [] });
  },
}));

export default useFriendsStore; 