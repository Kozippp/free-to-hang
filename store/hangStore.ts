import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar, SILHOUETTE_AVATAR_URL } from '@/constants/defaultImages';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'available' | 'offline' | 'pinged';
  activity?: string;
  lastActive?: string;
  lastSeen?: string;
  statusChangedAt?: string;
  responseStatus?: 'accepted' | 'maybe' | 'pending' | 'seen' | 'unseen';
}

interface User {
  id: string;
  name: string;
  username?: string;
  vibe?: string;
  avatar: string;
  status: 'available' | 'offline';
  activity: string;
}

interface HangState {
  user: User;
  friends: Friend[];
  offlineFriends: Friend[];
  selectedFriends: string[];
  pingedFriends: string[];
  isAvailable: boolean;
  activity: string;
  setActivity: (activity: string) => void;
  toggleAvailability: () => void;
  selectFriend: (id: string) => void;
  unselectFriend: (id: string) => void;
  clearSelectedFriends: () => void;
  isSelectedFriend: (id: string) => boolean;
  pingFriend: (id: string) => void;
  unpingFriend: (id: string) => void;
  isPingedFriend: (id: string) => boolean;
  loadUserData: () => Promise<void>;
  loadFriends: () => Promise<void>;
  updateUserData: (updates: Partial<{name: string; username: string; vibe: string; avatar_url: string}>) => Promise<boolean>;
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
}

// Remove old defaultUser object and create a function instead
const getDefaultAvatar = (name?: string, userId?: string) => {
  if (name && userId) {
    return generateDefaultAvatar(name, userId);
  }
  return SILHOUETTE_AVATAR_URL;
};

// Helper function to format time ago
const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
};

// Add at the top of the file after imports
let refreshInterval: ReturnType<typeof setInterval> | null = null;
let statusChannel: any = null;

// Create the store with persistence
const useHangStore = create<HangState>()(
  persist(
    (set, get) => ({
      user: {
        id: '',
        name: 'User',
        avatar: getDefaultAvatar(),
        status: 'offline',
        activity: ''
      },
      friends: [],
      offlineFriends: [],
      selectedFriends: [],
      pingedFriends: [],
      isAvailable: false,
      activity: '',
      
      setActivity: (activity) => set({ activity }),
      
      toggleAvailability: async () => {
        const currentStatus = get().isAvailable;
        const newStatus = !currentStatus;
        const currentActivity = get().activity;
        
        set({ 
          isAvailable: newStatus,
          user: {
            ...get().user,
            status: newStatus ? 'available' : 'offline'
          }
        });
        
        // Update status in database using our new function
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const { data, error } = await supabase.rpc('update_user_status', {
              user_id: authUser.id,
              new_status: newStatus ? 'available' : 'offline',
              activity: newStatus && currentActivity ? currentActivity : null
            });
            
            if (error) {
              console.error('Error updating status in database:', error);
              // Revert local state on error
              set({ 
                isAvailable: currentStatus,
                user: {
                  ...get().user,
                  status: currentStatus ? 'available' : 'offline'
                }
              });
            } else {
              console.log('Status updated in database:', newStatus ? 'available' : 'offline');
              if (currentActivity && newStatus) {
                console.log('Activity set:', currentActivity);
              }
            }
          }
        } catch (error) {
          console.error('Error updating status:', error);
          // Revert local state on error
          set({ 
            isAvailable: currentStatus,
            user: {
              ...get().user,
              status: currentStatus ? 'available' : 'offline'
            }
          });
        }
      },
      
      selectFriend: (id) => {
        const { selectedFriends } = get();
        const safeFriends = selectedFriends || [];
        if (!safeFriends.includes(id)) {
          set({ selectedFriends: [...safeFriends, id] });
        }
      },
      
      unselectFriend: (id) => {
        const { selectedFriends } = get();
        const safeFriends = selectedFriends || [];
        set({ 
          selectedFriends: safeFriends.filter(friendId => friendId !== id) 
        });
      },
      
      clearSelectedFriends: () => set({ selectedFriends: [] }),
      
      isSelectedFriend: (id) => {
        const { selectedFriends } = get();
        const safeFriends = selectedFriends || [];
        return safeFriends.includes(id);
      },
      
      pingFriend: (id) => {
        const { pingedFriends } = get();
        const safePinged = pingedFriends || [];
        if (!safePinged.includes(id)) {
          set({ pingedFriends: [...safePinged, id] });
        }
      },
      
      unpingFriend: (id) => {
        const { pingedFriends } = get();
        const safePinged = pingedFriends || [];
        set({
          pingedFriends: safePinged.filter(friendId => friendId !== id)
        });
      },
      
      isPingedFriend: (id) => {
        const { pingedFriends } = get();
        const safePinged = pingedFriends || [];
        return safePinged.includes(id);
      },

      loadUserData: async () => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) return;

          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (error) {
            console.error('Error loading user data:', error);
            return;
          }

          if (userData) {
            set({
              user: {
                id: userData.id,
                name: userData.name,
                username: userData.username,
                vibe: userData.vibe,
                avatar: userData.avatar_url || getDefaultAvatar(userData.name, userData.id),
                status: 'offline',
                activity: ''
              }
            });
          } else {
            // User profile doesn't exist, create one
            console.log('No user profile found, creating one...');
            const { data: newUserData, error: createError } = await supabase
              .from('users')
              .insert([
                {
                  id: authUser.id,
                  email: authUser.email || '',
                  name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
                  username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user'
                }
              ])
              .select()
              .single();

            if (createError) {
              console.error('Error creating user profile:', createError);
              return;
            }

            if (newUserData) {
              set({
                user: {
                  id: newUserData.id,
                  name: newUserData.name,
                  username: newUserData.username,
                  avatar: newUserData.avatar_url || getDefaultAvatar(newUserData.name, newUserData.id),
                  status: 'offline',
                  activity: ''
                }
              });
            }
          }
        } catch (error) {
          console.error('Error in loadUserData:', error);
        }
      },

      loadFriends: async () => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) return;

          // Use the new friend_requests table to get accepted friendships
          // Query friend_requests where status is 'accepted' and current user is involved
          const { data: friendRequests, error: friendRequestsError } = await supabase
            .from('friend_requests')
            .select(`
              sender_id,
              receiver_id,
              sender:users!friend_requests_sender_id_fkey (
                id,
                name,
                username,
                avatar_url,
                status,
                current_activity,
                status_changed_at,
                last_seen_at
              ),
              receiver:users!friend_requests_receiver_id_fkey (
                id,
                name,
                username,
                avatar_url,
                status,
                current_activity,
                status_changed_at,
                last_seen_at
              )
            `)
            .eq('status', 'accepted')
            .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`);

          if (friendRequestsError) {
            console.error('Error loading friend requests:', friendRequestsError);
            return;
          }

          // Extract friend data based on which field contains the current user
          const allFriendData: any[] = [];
          const seenIds = new Set<string>();
          
          if (friendRequests) {
            friendRequests.forEach((f: any) => {
              let friendData = null;
              
              // Determine which user is the friend (not the current user)
              if (f.sender_id === authUser.id && f.receiver) {
                friendData = f.receiver;
              } else if (f.receiver_id === authUser.id && f.sender) {
                friendData = f.sender;
              }
              
              if (friendData && !seenIds.has(friendData.id)) {
                seenIds.add(friendData.id);
                allFriendData.push({
                  id: friendData.id,
                  name: friendData.name,
                  username: friendData.username,
                  avatar: friendData.avatar_url || getDefaultAvatar(friendData.name, friendData.id),
                  status: friendData.status === 'available' ? 'available' : 'offline',
                  activity: friendData.current_activity || '',
                  lastActive: friendData.last_seen_at ? formatTimeAgo(friendData.last_seen_at) : 'Recently',
                  statusChangedAt: friendData.status_changed_at
                });
              }
            });
          }

          // Separate available and offline friends
          const availableFriends = allFriendData.filter(f => f.status === 'available');
          const offlineFriends = allFriendData.filter(f => f.status === 'offline');

          // Only log if there are changes to avoid console spam
          const currentState = get();
          const hasChanges = 
            currentState.friends.length !== availableFriends.length ||
            currentState.offlineFriends.length !== offlineFriends.length;

          set({ 
            friends: availableFriends,
            offlineFriends: offlineFriends 
          });

          // Only log when there are actual changes to reduce console spam
          if (hasChanges) {
            console.log('Friends loaded successfully:', { available: availableFriends.length, offline: offlineFriends.length });
          }
        } catch (error) {
          console.error('Error loading friends:', error);
          // Set empty arrays on error to prevent UI issues
          set({ 
            friends: [],
            offlineFriends: [] 
          });
        }
      },

      updateUserData: async (updates: Partial<{name: string; username: string; vibe: string; avatar_url: string}>) => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) {
            console.error('No authenticated user found');
            return false;
          }

          console.log('Updating user data with:', updates);

          // Direct Supabase update - simple and reliable
          const { data: userData, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', authUser.id)
            .select()
            .single();

          if (error) {
            console.error('Error updating user data:', error);
            return false;
          }

          if (userData) {
            // Update local state with new data
            const newUserState = {
              id: userData.id,
              name: userData.name,
              username: userData.username,
              vibe: userData.vibe,
              avatar: userData.avatar_url || getDefaultAvatar(userData.name, userData.id),
              status: get().user.status || 'offline',
              activity: get().user.activity || ''
            };
            
            set({ user: newUserState });
            
            console.log('User data updated successfully:', userData);
            console.log('New user state:', newUserState);
            return true;
          }

          return false;
        } catch (error) {
          console.error('Error in updateUserData:', error);
          return false;
        }
      },

      startRealTimeUpdates: () => {
        // Clear any existing subscriptions
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
        if (statusChannel) {
          supabase.removeChannel(statusChannel);
          statusChannel = null;
        }
        
        // Load friends once initially
        get().loadFriends();
        
        console.log('🚀 Starting real-time friend status updates...');
        
        // Set up real-time subscription for user status changes
        statusChannel = supabase
          .channel('user_status_changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'users',
              filter: 'status=neq.null'
            },
            (payload) => {
              console.log('📡 User status change detected:', payload);
              // Immediately reload friends data when any user status changes
              get().loadFriends();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'users'
            },
            (payload) => {
              console.log('📡 New user detected:', payload);
              // Reload friends data when new users join
              get().loadFriends();
            }
          )
          .subscribe((status) => {
            console.log('📡 Status channel status:', status);
          });
        
        // More frequent polling for better real-time feel (every 10 seconds)
        refreshInterval = setInterval(() => {
          get().loadFriends();
        }, 10000);
      },

      stopRealTimeUpdates: () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
        if (statusChannel) {
          supabase.removeChannel(statusChannel);
          statusChannel = null;
        }
        console.log('🛑 Stopped real-time friend status updates');
      }
    }),
    {
      name: 'hang-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useHangStore;