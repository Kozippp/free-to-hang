import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

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

let refreshInterval: NodeJS.Timeout | null = null;

const getDefaultAvatar = (name?: string, userId?: string) => {
  if (!name && !userId) return 'https://via.placeholder.com/150/cccccc/ffffff?text=?';
  
  const displayName = name || 'User';
  const initials = displayName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
  
  // Use a consistent color based on user ID or name
  const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', 'FFB347', '87CEEB'];
  const colorIndex = (userId || name || '').length % colors.length;
  const bgColor = colors[colorIndex];
  
  return `https://via.placeholder.com/150/${bgColor}/ffffff?text=${initials}`;
};

// Helper function to make backend calls with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const useHangStore = create<HangState>()(
  persist(
    (set, get) => ({
      user: {
        id: '',
        name: '',
        username: '',
        vibe: '',
        avatar: '',
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
      
      toggleAvailability: () => set((state) => ({ isAvailable: !state.isAvailable })),
      
      selectFriend: (id: string) => set((state) => ({
        selectedFriends: [...state.selectedFriends, id]
      })),
      
      unselectFriend: (id: string) => set((state) => ({
        selectedFriends: state.selectedFriends.filter(friendId => friendId !== id)
      })),
      
      clearSelectedFriends: () => set({ selectedFriends: [] }),
      
      isSelectedFriend: (id: string) => {
        const state = get();
        return state.selectedFriends.includes(id);
      },
      
      pingFriend: (id: string) => set((state) => ({
        pingedFriends: [...state.pingedFriends, id]
      })),
      
      unpingFriend: (id: string) => set((state) => ({
        pingedFriends: state.pingedFriends.filter(friendId => friendId !== id)
      })),
      
      isPingedFriend: (id: string) => {
        const state = get();
        return state.pingedFriends.includes(id);
      },

      loadUserData: async () => {
        try {
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
          if (authError || !authUser) {
            console.error('Auth error:', authError);
            return;
          }

          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (userError) {
            console.error('Error loading user data:', userError);
            return;
          }

          if (userData) {
            set({
              user: {
                id: userData.id,
                name: userData.name || authUser.email?.split('@')[0] || 'User',
                username: userData.username,
                vibe: userData.vibe,
                avatar: userData.avatar_url || getDefaultAvatar(userData.name, userData.id),
                status: 'offline',
                activity: ''
              }
            });
          }
        } catch (error) {
          console.error('Error in loadUserData:', error);
        }
      },

      loadFriends: async () => {
        try {
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
          if (authError || !authUser) {
            console.error('Auth error:', authError);
            return;
          }

          // Query friendships where current user is the user_id
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

          // Try backend API first with timeout, but don't block if it fails
          let backendSuccess = false;
          try {
            const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://web-production-ac8a.up.railway.app';
            const response = await fetchWithTimeout(`${backendUrl}/user/me`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify(updates)
            }, 5000); // 5 second timeout

            if (response.ok) {
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
                backendSuccess = true;
              }
            } else {
              console.warn('Backend API returned error status:', response.status);
            }
          } catch (backendError) {
            console.warn('Backend API call failed, falling back to direct database update:', backendError);
          }

          // If backend failed, use direct database update
          if (!backendSuccess) {
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
          }

          return backendSuccess;
        } catch (error) {
          console.error('Error in updateUserData:', error);
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