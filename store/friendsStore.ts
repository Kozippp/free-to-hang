import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { relationshipService, RelationshipStatus } from '@/lib/relationship-service';

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
  
  // Actions - now frontend only (no backend operations)
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<boolean>;
  acceptFriendRequest: (friendId: string) => Promise<boolean>;
  declineFriendRequest: (friendId: string) => Promise<boolean>;
  cancelSentRequest: (friendId: string) => Promise<boolean>;
  removeFriend: (friendId: string) => Promise<boolean>;
  loadAllRelationships: () => Promise<void>;
  clearSearchResults: () => void;
  
  // Blocking - frontend only
  blockUser: (userId: string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<boolean>;
  
  // Ghosting - frontend only
  ghostFriend: (userId: string, duration: '1_day' | '3_days' | 'forever') => Promise<void>;
  unghostFriend: (userId: string) => Promise<void>;
  loadGhostedFriends: () => Promise<void>;
  getGhostStatus: (userId: string) => GhostedFriend | null;
  
  // Relationship Status - frontend only
  getRelationshipStatus: (userId: string) => Promise<RelationshipStatus>;
  
  // No real-time updates - removed
  
  // Frontend helper methods
  refreshRelationshipStatus: (userId: string) => Promise<void>;
  updateSearchResultStatus: (userId: string, status: RelationshipStatus) => void;
  refreshSpecificRelationship: (userId: string) => Promise<void>;
  validateAndSyncState: () => Promise<void>;
}

const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  friendRequests: [],
  sentRequests: [],
  blockedUsers: [],
  searchResults: [],
  ghostedFriends: [],
  isSearching: false,
  isLoading: false,

  // Keep search functionality but remove relationship status checking
  searchUsers: async (query: string) => {
    if (query.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Search for users (keep this functionality)
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio, vibe')
        .or(`name.ilike.%${query}%, username.ilike.%${query}%`)
        .neq('id', currentUser.id)
        .limit(50);

      if (error) throw error;

      // Set users without relationship status (all will show as 'none')
      const usersWithStatus: UserWithStatus[] = (users || []).map((user) => ({
        ...user,
        relationshipStatus: 'none' as const
      }));

      set({ searchResults: usersWithStatus });
      
    } catch (error) {
      console.error('Search users error:', error);
      set({ searchResults: [] });
    } finally {
      set({ isSearching: false });
    }
  },

  // Frontend-only friend request actions (no backend operations)
  sendFriendRequest: async (friendId: string) => {
    console.log('🚫 Send friend request disabled (frontend only)');
    return true; // Always return true to prevent UI errors
  },

  acceptFriendRequest: async (friendId: string) => {
    console.log('🚫 Accept friend request disabled (frontend only)');
    return true;
  },

  declineFriendRequest: async (friendId: string) => {
    console.log('🚫 Decline friend request disabled (frontend only)');
    return true;
  },

  cancelSentRequest: async (friendId: string) => {
    console.log('🚫 Cancel sent request disabled (frontend only)');
    return true;
  },

  removeFriend: async (friendId: string) => {
    console.log('🚫 Remove friend disabled (frontend only)');
    return true;
  },

  // No backend loading - just clear the arrays
  loadAllRelationships: async () => {
    console.log('🚫 Load relationships disabled (frontend only)');
    set({
      friends: [],
      friendRequests: [],
      sentRequests: [],
      blockedUsers: [],
      isLoading: false
    });
  },

  clearSearchResults: () => {
    set({ searchResults: [] });
  },

  // Frontend-only blocking (no backend operations)
  blockUser: async (userId: string) => {
    console.log('🚫 Block user disabled (frontend only)');
    return true;
  },

  unblockUser: async (userId: string) => {
    console.log('🚫 Unblock user disabled (frontend only)');
    return true;
  },

  // Frontend-only ghosting (no backend operations)
  ghostFriend: async (userId: string, duration: '1_day' | '3_days' | 'forever') => {
    console.log('🚫 Ghost friend disabled (frontend only)');
  },

  unghostFriend: async (userId: string) => {
    console.log('🚫 Unghost friend disabled (frontend only)');
  },

  loadGhostedFriends: async () => {
    console.log('🚫 Load ghosted friends disabled (frontend only)');
    set({ ghostedFriends: [] });
  },

  getGhostStatus: (userId: string) => {
    return null; // No ghosting data
  },

  // Always return 'none' status
  getRelationshipStatus: async (userId: string) => {
    return 'none';
  },

  // Frontend helper methods (simplified)
  refreshRelationshipStatus: async (userId: string) => {
    console.log('🚫 Refresh relationship status disabled (frontend only)');
  },

  updateSearchResultStatus: (userId: string, status: RelationshipStatus) => {
    const { searchResults } = get();
    const updatedResults = searchResults.map(user => 
      user.id === userId ? { ...user, relationshipStatus: status } : user
    );
    set({ searchResults: updatedResults });
  },

  refreshSpecificRelationship: async (userId: string) => {
    console.log('🚫 Refresh specific relationship disabled (frontend only)');
  },

  validateAndSyncState: async () => {
    console.log('🚫 Validate and sync state disabled (frontend only)');
  },
}));

export default useFriendsStore; 