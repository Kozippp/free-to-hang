import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { currentUser, mockFriends, offlineFriends } from '@/constants/mockData';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'pinged';
  activity?: string;
  lastActive?: string;
  lastSeen?: string;
}

interface User {
  id: string;
  name: string;
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
}

// Create the store with persistence
const useHangStore = create<HangState>()(
  persist(
    (set, get) => ({
      user: currentUser,
      friends: mockFriends,
      offlineFriends: offlineFriends,
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
        if (!selectedFriends.includes(id)) {
          set({ selectedFriends: [...selectedFriends, id] });
        }
      },
      
      unselectFriend: (id) => {
        const { selectedFriends } = get();
        set({ 
          selectedFriends: selectedFriends.filter(friendId => friendId !== id) 
        });
      },
      
      clearSelectedFriends: () => set({ selectedFriends: [] }),
      
      isSelectedFriend: (id) => {
        return get().selectedFriends.includes(id);
      },
      
      pingFriend: (id) => {
        const { pingedFriends } = get();
        if (!pingedFriends.includes(id)) {
          set({ pingedFriends: [...pingedFriends, id] });
        }
      },
      
      unpingFriend: (id) => {
        const { pingedFriends } = get();
        set({
          pingedFriends: pingedFriends.filter(friendId => friendId !== id)
        });
      },
      
      isPingedFriend: (id) => {
        return get().pingedFriends.includes(id);
      }
    }),
    {
      name: 'hang-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useHangStore;