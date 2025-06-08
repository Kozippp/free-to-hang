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
  status: 'online' | 'offline' | 'pinged';
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
  status: 'online' | 'offline';
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
}

// Remove old defaultUser object and create a function instead
const getDefaultAvatar = (name?: string, userId?: string) => {
  if (name && userId) {
    return generateDefaultAvatar(name, userId);
  }
  return SILHOUETTE_AVATAR_URL;
};

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
      
      toggleAvailability: () => {
        const currentStatus = get().isAvailable;
        set({ 
          isAvailable: !currentStatus,
          user: {
            ...get().user,
            status: !currentStatus ? 'online' : 'offline'
          }
        });
        
        // If turning off availability, clear activity and selected friends
        if (currentStatus) {
          set({ 
            activity: '',
            selectedFriends: [],
            pingedFriends: []
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

          // Load friends with their status
          const { data: friendsData, error } = await supabase
            .from('friends')
            .select(`
              friend_id,
              users!friends_friend_id_fkey (
                id,
                name,
                avatar_url,
                user_status (
                  is_available,
                  activity,
                  last_seen
                )
              )
            `)
            .eq('user_id', authUser.id)
            .eq('status', 'accepted');

          if (error) {
            console.error('Error loading friends:', error);
            return;
          }

          const friends: Friend[] = [];
          const offlineFriends: Friend[] = [];

          friendsData?.forEach((friendship: any) => {
            const friend = friendship.users;
            if (friend) {
              const friendData: Friend = {
                id: friend.id,
                name: friend.name,
                avatar: friend.avatar_url || getDefaultAvatar(friend.name, friend.id),
                status: friend.user_status?.is_available ? 'online' : 'offline',
                activity: friend.user_status?.activity || '',
                lastSeen: friend.user_status?.last_seen,
                lastActive: friend.user_status?.last_seen
              };

              if (friendData.status === 'online') {
                friends.push(friendData);
              } else {
                offlineFriends.push(friendData);
              }
            }
          });

          set({ friends, offlineFriends });
        } catch (error) {
          console.error('Error in loadFriends:', error);
        }
      },

      updateUserData: async (updates: Partial<{name: string; username: string; vibe: string; avatar_url: string}>) => {
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
            console.error('Error updating user data:', error);
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
              return false;
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
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('Error in updateUserData:', error);
          return false;
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