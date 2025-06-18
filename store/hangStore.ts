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

// Add at the top of the file after imports
let refreshInterval: NodeJS.Timeout | null = null;

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
        
        set({ 
          isAvailable: newStatus,
          user: {
            ...get().user,
            status: newStatus ? 'available' : 'offline'
          }
        });
        
        // Update status in database
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const { error } = await supabase
              .from('users')
              .update({ 
                status: newStatus ? 'available' : 'offline',
                updated_at: new Date().toISOString()
              })
              .eq('id', authUser.id);
            
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

          // Use the new single friendship record structure
          // Query friendships where the current user is either user_id or friend_id
          const { data: friendships, error: friendshipsError } = await supabase
            .from('friendships')
            .select(`
              user_id,
              friend_id,
              user:users!friendships_user_id_fkey (
                id,
                name,
                username,
                avatar_url,
                status
              ),
              friend_user:users!friendships_friend_id_fkey (
                id,
                name,
                username,
                avatar_url,
                status
              )
            `)
            .or(`user_id.eq.${authUser.id},friend_id.eq.${authUser.id}`);

          if (friendshipsError) {
            console.error('Error loading friendships:', friendshipsError);
            return;
          }

          // Extract friend data based on which field contains the current user
          const allFriendData: any[] = [];
          const seenIds = new Set<string>();
          
          if (friendships) {
            friendships.forEach((f: any) => {
              let friendData = null;
              
              // Determine which user is the friend (not the current user)
              if (f.user_id === authUser.id && f.friend_user) {
                friendData = f.friend_user;
              } else if (f.friend_id === authUser.id && f.user) {
                friendData = f.user;
              }
              
              if (friendData && !seenIds.has(friendData.id)) {
                seenIds.add(friendData.id);
                allFriendData.push({
                  id: friendData.id,
                  name: friendData.name,
                  username: friendData.username,
                  avatar: friendData.avatar_url || getDefaultAvatar(friendData.name, friendData.id),
                  status: friendData.status === 'available' ? 'available' : 'offline',
                  activity: '',
                  lastActive: 'Recently'
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
        // Clear any existing interval
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
        
        // Load friends once initially
        get().loadFriends();
        
        // Set up real-time subscription for user status changes instead of polling
        // This is much more efficient than polling every second
        console.log('🚀 Starting real-time friend status updates...');
        
        // TODO: Implement proper real-time subscription to users table for status changes
        // For now, refresh every 30 seconds instead of every 1 second
        refreshInterval = setInterval(() => {
          get().loadFriends();
        }, 30000); // 30 seconds instead of 1 second
      },

      stopRealTimeUpdates: () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
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