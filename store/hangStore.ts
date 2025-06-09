import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar, SILHOUETTE_AVATAR_URL } from '@/constants/defaultImages';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Friend {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  status: 'available' | 'offline' | 'pinged';
  activity: string;
  lastActive?: string;
  responseStatus?: 'pending' | 'accepted' | 'declined';
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

// SIMPLE realtime variables - one channel for all hang-related updates
let hangRealtimeChannel: RealtimeChannel | null = null;

// Helper to get default avatar
const getDefaultAvatar = (name?: string, id?: string) => {
  if (id) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=007AFF&color=fff&size=100`;
  }
  return 'https://ui-avatars.com/api/?name=User&background=007AFF&color=fff&size=100';
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
              console.log('Status updated successfully:', newStatus ? 'available' : 'offline');
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
          }
        } catch (error) {
          console.error('Load user data error:', error);
        }
      },

      updateUserData: async (updates) => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) return false;

          const { error } = await supabase
            .from('users')
            .update({
              ...updates,
              updated_at: new Date().toISOString()
            })
            .eq('id', authUser.id);

          if (error) {
            console.error('Error updating user data:', error);
            return false;
          }

          // Update local state
          set({
            user: {
              ...get().user,
              ...updates
            }
          });

          return true;
        } catch (error) {
          console.error('Update user data error:', error);
          return false;
        }
      },

      loadFriends: async () => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) return;

          // Load all friendships in one go
          const { data: friendships, error } = await supabase
            .from('friendships')
            .select(`
              friend_id,
              users!friendships_friend_id_fkey (
                id,
                name,
                username,
                avatar_url,
                status,
                vibe
              )
            `)
            .eq('user_id', authUser.id);

          if (error) {
            console.error('Error loading friends:', error);
            return;
          }

          const allFriendData: Friend[] = [];

          if (friendships) {
            friendships.forEach((f: any) => {
              if (f.users) {
                allFriendData.push({
                  id: f.users.id,
                  name: f.users.name,
                  username: f.users.username,
                  avatar: f.users.avatar_url || getDefaultAvatar(f.users.name, f.users.id),
                  status: f.users.status === 'available' ? 'available' : 'offline',
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

          console.log('Friends loaded:', { available: availableFriends.length, offline: offlineFriends.length });
        } catch (error) {
          console.error('Load friends error:', error);
        }
      },

      // SIMPLIFIED REALTIME - Just listen to what matters
      startRealTimeUpdates: () => {
        // Clean up existing
        if (hangRealtimeChannel) {
          supabase.removeChannel(hangRealtimeChannel);
          hangRealtimeChannel = null;
        }
        
        console.log('🔄 Starting realtime for hang features...');
        
        // ONE channel for all hang-related changes
        hangRealtimeChannel = supabase
          .channel('hang-realtime', {
            config: {
              broadcast: { self: false },
              presence: { key: 'hang' }
            }
          })
          // Listen to user status changes (affects who's available)
          .on(
            'postgres_changes',
            { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'users',
              filter: 'status=neq.null'
            },
                         (payload: any) => {
               console.log('👤 User status changed, reloading friends');
               get().loadFriends();
             }
          )
          // Listen to new friendships
          .on(
            'postgres_changes',
            { 
              event: '*', 
              schema: 'public', 
              table: 'friendships'
            },
                         (payload: any) => {
               console.log('👥 Friendship changed, reloading friends');
               get().loadFriends();
             }
           )
           .subscribe((status: any) => {
             console.log('📡 Hang realtime status:', status);
           });
      },

      stopRealTimeUpdates: () => {
        console.log('⏹️ Stopping hang realtime...');
        
        if (hangRealtimeChannel) {
          supabase.removeChannel(hangRealtimeChannel);
          hangRealtimeChannel = null;
        }
      }
    }),
    {
      name: 'hang-storage',
      partialize: (state) => ({
        selectedFriends: state.selectedFriends,
        pingedFriends: state.pingedFriends,
        isAvailable: state.isAvailable,
        activity: state.activity,
      }),
    }
  )
);

export default useHangStore;