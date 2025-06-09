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

interface GhostedFriend {
  id: string;
  ghoster_id: string;
  ghosted_id: string;
  duration_type: '1_day' | '3_days' | 'forever';
  expires_at: string | null;
  created_at: string;
}

interface FriendRequest {
  id: string;
  user_id: string;  // sender_id actually
  friend_id: string; // receiver_id actually
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  users: User;
}

type RelationshipStatus = 
  | 'none' 
  | 'pending_sent' 
  | 'pending_received' 
  | 'friends' 
  | 'blocked_by_me' 
  | 'blocked_by_them';

interface FriendsState {
  searchResults: User[];
  friendRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  blockedUsers: User[];
  ghostedFriends: GhostedFriend[];
  relationshipStatuses: Map<string, RelationshipStatus>; // Cache for relationship statuses
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
  
  // Blocking
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  loadBlockedUsers: () => Promise<void>;
  
  // Ghosting
  ghostFriend: (userId: string, duration: '1_day' | '3_days' | 'forever') => Promise<void>;
  unghostFriend: (userId: string) => Promise<void>;
  loadGhostedFriends: () => Promise<void>;
  getGhostStatus: (userId: string) => GhostedFriend | null;
  
  // Relationship Status
  getRelationshipStatus: (userId: string) => RelationshipStatus;
  updateRelationshipStatus: (userId: string, status: RelationshipStatus) => void;
  refreshRelationshipStatus: (userId: string) => Promise<RelationshipStatus>;
  
  // Realtime
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
}

// Realtime channel variable
let friendRequestsChannel: RealtimeChannel | null = null;

const useFriendsStore = create<FriendsState>((set, get) => ({
  searchResults: [],
  friendRequests: [],
  sentRequests: [],
  blockedUsers: [],
  ghostedFriends: [],
  relationshipStatuses: new Map(),
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

      // Filter out blocked users (both ways)
      const { data: blockedUsers, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${currentUser.id},blocked_id.eq.${currentUser.id}`);

      if (blockedError) {
        console.error('Error checking blocked users:', blockedError);
      }

      const friendIds = new Set(existingFriendships?.map((f: any) => f.friend_id) || []);
      const blockedIds = new Set();
      
      blockedUsers?.forEach((block: any) => {
        if (block.blocker_id === currentUser.id) {
          blockedIds.add(block.blocked_id); // I blocked them
        } else {
          blockedIds.add(block.blocker_id); // They blocked me
        }
      });

      // Filter out confirmed friends and blocked users
      const filteredUsers = users?.filter((user: any) => 
        !friendIds.has(user.id) && !blockedIds.has(user.id)
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
        get().updateRelationshipStatus(friendId, 'friends');
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
        get().updateRelationshipStatus(friendId, 'pending_sent');
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

      // Update relationship status immediately
      get().updateRelationshipStatus(friendId, 'pending_sent');

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

      // Update relationship status immediately
      get().updateRelationshipStatus(request.sender_id, 'friends');

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

      // Simply DELETE the request (clean decline)
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('Decline friend request error:', error);
        throw error;
      }

      // Update relationship status immediately
      get().updateRelationshipStatus(request.sender_id, 'none');

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

      // DELETE the sent request
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('Cancel sent request error:', error);
        throw error;
      }

      // Update relationship status immediately
      get().updateRelationshipStatus(request.receiver_id, 'none');

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

      // Update relationship status for all received requests
      transformedRequests?.forEach(request => {
        get().updateRelationshipStatus(request.user_id, 'pending_received');
      });

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

      // Update relationship status for all sent requests
      transformedRequests?.forEach(request => {
        get().updateRelationshipStatus(request.friend_id, 'pending_sent');
      });

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

  // 🚫 BLOCKING FUNCTIONALITY
  blockUser: async (userId: string) => {
    set({ isLoading: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Remove any existing friendship first
      await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`);

      // Remove any pending friend requests
      await supabase
        .from('friend_requests')
        .delete()
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`);

      // Add to blocked users
      const { error } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: currentUser.id, blocked_id: userId });

      if (error) {
        console.error('Block user error:', error);
        throw error;
      }

      // Update relationship status immediately
      get().updateRelationshipStatus(userId, 'blocked_by_me');

      // Reload blocked users
      await get().loadBlockedUsers();
      
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  unblockUser: async (userId: string) => {
    set({ isLoading: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', userId);

      if (error) {
        console.error('Unblock user error:', error);
        throw error;
      }

      // Update relationship status immediately
      get().updateRelationshipStatus(userId, 'none');

      // Reload blocked users
      await get().loadBlockedUsers();
      
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
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
          blocked_id,
          created_at,
          users!blocked_users_blocked_id_fkey (
            id,
            name,
            username,
            avatar_url,
            bio,
            vibe
          )
        `)
        .eq('blocker_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Load blocked users error:', error);
        return;
      }

      // Transform for UI compatibility
      const transformedUsers = blockedUsers?.map((block: any) => block.users) as User[] || [];

      set({ blockedUsers: transformedUsers });
      console.log('🚫 Blocked users loaded:', transformedUsers.length);
      
    } catch (error) {
      console.error('Load blocked users error:', error);
      set({ blockedUsers: [] });
    }
  },

  // 👻 GHOSTING FUNCTIONALITY
  ghostFriend: async (userId: string, duration: '1_day' | '3_days' | 'forever') => {
    set({ isLoading: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Calculate expiry date
      let expiresAt = null;
      if (duration === '1_day') {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1);
        expiresAt = expiry.toISOString();
      } else if (duration === '3_days') {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 3);
        expiresAt = expiry.toISOString();
      }

      // Upsert ghost relationship
      const { error } = await supabase
        .from('ghosted_friends')
        .upsert({
          ghoster_id: currentUser.id,
          ghosted_id: userId,
          duration_type: duration,
          expires_at: expiresAt,
        }, {
          onConflict: 'ghoster_id,ghosted_id'
        });

      if (error) {
        console.error('Ghost friend error:', error);
        throw error;
      }

      // Reload ghosted friends
      await get().loadGhostedFriends();
      
    } catch (error) {
      console.error('Ghost friend error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  unghostFriend: async (userId: string) => {
    set({ isLoading: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('ghosted_friends')
        .delete()
        .eq('ghoster_id', currentUser.id)
        .eq('ghosted_id', userId);

      if (error) {
        console.error('Unghost friend error:', error);
        throw error;
      }

      // Reload ghosted friends
      await get().loadGhostedFriends();
      
    } catch (error) {
      console.error('Unghost friend error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadGhostedFriends: async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: ghostedFriends, error } = await supabase
        .from('ghosted_friends')
        .select('*')
        .eq('ghoster_id', currentUser.id);

      if (error) {
        console.error('Load ghosted friends error:', error);
        return;
      }

      // Filter out expired ghosts
      const now = new Date();
      const validGhosts = ghostedFriends?.filter((ghost: any) => {
        if (ghost.duration_type === 'forever') return true;
        if (!ghost.expires_at) return false;
        return new Date(ghost.expires_at) > now;
      }) || [];

      // Remove expired ghosts from database
      const expiredGhosts = ghostedFriends?.filter((ghost: any) => {
        if (ghost.duration_type === 'forever') return false;
        if (!ghost.expires_at) return true;
        return new Date(ghost.expires_at) <= now;
      }) || [];

      if (expiredGhosts.length > 0) {
        const expiredIds = expiredGhosts.map((ghost: any) => ghost.id);
        await supabase
          .from('ghosted_friends')
          .delete()
          .in('id', expiredIds);
      }

      set({ ghostedFriends: validGhosts });
      console.log('👻 Ghosted friends loaded:', validGhosts.length);
      
    } catch (error) {
      console.error('Load ghosted friends error:', error);
      set({ ghostedFriends: [] });
    }
  },

  getGhostStatus: (userId: string): GhostedFriend | null => {
    const ghostedFriends = get().ghostedFriends;
    return ghostedFriends.find(ghost => ghost.ghosted_id === userId) || null;
  },

  // 🌍 REALTIME SUBSCRIPTIONS
  startRealTimeUpdates: () => {
    // Clear any existing channel
    if (friendRequestsChannel) {
      supabase.removeChannel(friendRequestsChannel);
    }
    
    console.log('👥 Starting friends realtime...');
    
    // Load initial data
    get().loadFriendRequests();
    get().loadSentRequests();
    get().loadBlockedUsers();
    get().loadGhostedFriends();
    
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ghosted_friends' },
        (payload: any) => {
          console.log('👻 Ghosted friends changed');
          get().loadGhostedFriends();
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
  },

  // Relationship Status
  getRelationshipStatus: (userId: string) => {
    return get().relationshipStatuses.get(userId) || 'none';
  },

  updateRelationshipStatus: (userId: string, status: RelationshipStatus) => {
    get().relationshipStatuses.set(userId, status);
  },

  refreshRelationshipStatus: async (userId: string): Promise<RelationshipStatus> => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return 'none';

      // Check if blocked by me
      const { data: blockedByMe } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', userId)
        .maybeSingle();

      if (blockedByMe) {
        get().updateRelationshipStatus(userId, 'blocked_by_me');
        return 'blocked_by_me';
      }

      // Check if blocked by them
      const { data: blockedByThem } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', userId)
        .eq('blocked_id', currentUser.id)
        .maybeSingle();

      if (blockedByThem) {
        get().updateRelationshipStatus(userId, 'blocked_by_them');
        return 'blocked_by_them';
      }

      // Check if friends
      const { data: friendship } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('friend_id', userId)
        .maybeSingle();

      if (friendship) {
        get().updateRelationshipStatus(userId, 'friends');
        return 'friends';
      }

      // Check friend requests
      const { data: sentRequest } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', currentUser.id)
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (sentRequest) {
        get().updateRelationshipStatus(userId, 'pending_sent');
        return 'pending_sent';
      }

      const { data: receivedRequest } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', userId)
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (receivedRequest) {
        get().updateRelationshipStatus(userId, 'pending_received');
        return 'pending_received';
      }

      // No relationship
      get().updateRelationshipStatus(userId, 'none');
      return 'none';
    } catch (error) {
      console.error('Refresh relationship status error:', error);
      get().updateRelationshipStatus(userId, 'none');
      return 'none';
    }
  }
}));

export default useFriendsStore; 