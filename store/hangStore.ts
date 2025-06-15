import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar, SILHOUETTE_AVATAR_URL } from '@/constants/defaultImages';

let refreshInterval: NodeJS.Timeout | null = null;

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

const getDefaultAvatar = (name?: string, userId?: string) => {
  if (name && userId) {
    return generateDefaultAvatar(name, userId);
  } else {
    return SILHOUETTE_AVATAR_URL;
  }
};

const useHangStore = create<HangState>(
  persist(
    (set, get) => ({
      user: {
        id: '',
        name: '',
        username: '',
        vibe: '',
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

      setActivity: (activity: string) => set({ activity }),

      toggleAvailability: () => {
        const { isAvailable } = get();
        set({ isAvailable: !isAvailable });
      },

      selectFriend: (id: string) => {
        const { selectedFriends } = get();
        if (!selectedFriends.includes(id)) {
          set({ selectedFriends: [...selectedFriends, id] });
        }
      },

      unselectFriend: (id: string) => {
        const { selectedFriends } = get();
        set({ selectedFriends: selectedFriends.filter(friendId => friendId !== id) });
      },

      clearSelectedFriends: () => set({ selectedFriends: [] }),

      isSelectedFriend: (id: string) => {
        const { selectedFriends } = get();
        return selectedFriends.includes(id);
      },

      pingFriend: (id: string) => {
        const { pingedFriends } = get();
        if (!pingedFriends.includes(id)) {
          set({ pingedFriends: [...pingedFriends, id] });
        }
      },

      unpingFriend: (id: string) => {
        const { pingedFriends } = get();
        set({ pingedFriends: pingedFriends.filter(friendId => friendId !== id) });
      },

      isPingedFriend: (id: string) => {
        const { pingedFriends } = get();
        return pingedFriends.includes(id);
      },

      loadUserData: async () => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) return;

          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

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
                  vibe: newUserData.vibe,
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

          // Query friendships table with proper joins
          const { data: friendships, error: friendshipsError } = await supabase
            .from('friendships')
            .select(`
              friend_id,
              friend_user:users!friendships_friend_id_fkey (
                id,
                name,
                username,
                avatar_url,
                status
              )
            `)
            .eq('user_id', authUser.id);

          if (friendshipsError) {
            console.error('Error loading friendships:', friendshipsError);
            return;
          }

          // Also query reverse friendships (where current user is the friend)
          const { data: reverseFriendships, error: reverseError } = await supabase
            .from('friendships')
            .select(`
              user_id,
              user:users!friendships_user_id_fkey (
                id,
                name,
                username,
                avatar_url,
                status
              )
            `)
            .eq('friend_id', authUser.id);

          if (reverseError) {
            console.error('Error loading reverse friendships:', reverseError);
            return;
          }

          // Combine both directions and remove duplicates
          const allFriendData: any[] = [];
          const seenIds = new Set<string>();
          
          if (friendships) {
            friendships.forEach((f: any) => {
              if (f.friend_user && !seenIds.has(f.friend_user.id)) {
                seenIds.add(f.friend_user.id);
                allFriendData.push({
                  id: f.friend_user.id,
                  name: f.friend_user.name,
                  username: f.friend_user.username,
                  avatar: f.friend_user.avatar_url || getDefaultAvatar(f.friend_user.name, f.friend_user.id),
                  status: f.friend_user.status === 'available' ? 'available' : 'offline',
                  activity: '',
                  lastActive: 'Recently'
                });
              }
            });
          }

          if (reverseFriendships) {
            reverseFriendships.forEach((f: any) => {
              if (f.user && !seenIds.has(f.user.id)) {
                seenIds.add(f.user.id);
                allFriendData.push({
                  id: f.user.id,
                  name: f.user.name,
                  username: f.user.username,
                  avatar: f.user.avatar_url || getDefaultAvatar(f.user.name, f.user.id),
                  status: f.user.status === 'available' ? 'available' : 'offline',
                  activity: '',
                  lastActive: 'Recently'
                });
              }
            });
          }

          // Separate available and offline friends
          const availableFriends = allFriendData.filter(f => f.status === 'available');
          const offlineFriends = allFriendData.filter(f => f.status === 'offline');

          set({ 
            friends: availableFriends,
            offlineFriends: offlineFriends 
          });

          console.log('Friends loaded successfully:', { available: availableFriends.length, offline: offlineFriends.length });
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
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) return false;

          // Use backend API to update user data
          const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
          const response = await fetch(`${backendUrl}/user/me`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(updates)
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Error updating user via backend:', errorData);
            return false;
          }

          const responseData = await response.json();
          const userData = responseData.user;

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
            return true;
          }

          return false;
        } catch (error) {
          console.error('Error in updateUserData:', error);
          
          // Fallback to direct database update if backend fails
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return false;

            const { data: userData, error } = await supabase
              .from('users')
              .update(updates)
              .eq('id', authUser.id)
              .select()
              .single();

            if (error) {
              console.error('Error updating user data directly:', error);
              return false;
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
              return true;
            }
          } catch (fallbackError) {
            console.error('Fallback update also failed:', fallbackError);
          }

          return false;
        }
      },

      startRealTimeUpdates: () => {
        // Clear any existing interval
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
        
        // Start refreshing friends every second
        refreshInterval = setInterval(() => {
          get().loadFriends();
        }, 1000);
      },

      stopRealTimeUpdates: () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    }),
    {
      name: 'hang-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useHangStore;