// Friends data for index tab (original)
export const onlineFriends = [
  {
    id: '1',
    name: 'Emma Wilson',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=256&q=80',
    status: 'online',
    activity: 'Coffee',
    lastActive: '2 min ago',
    responseStatus: 'accepted'
  },
  {
    id: '2',
    name: 'James Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=256&q=80',
    status: 'online',
    activity: 'Chill',
    lastActive: '5 min ago',
    responseStatus: 'maybe'
  },
  {
    id: '3',
    name: 'Olivia Chen',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=256&q=80',
    status: 'online',
    activity: 'Walk',
    lastActive: '10 min ago',
    responseStatus: 'seen'
  },
  {
    id: '4',
    name: 'Michael Johnson',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=256&q=80',
    status: 'online',
    activity: 'Gym',
    lastActive: '15 min ago',
    responseStatus: 'unseen'
  },
  {
    id: '5',
    name: 'Sophia Martinez',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=256&q=80',
    status: 'online',
    activity: 'Movie',
    lastActive: '20 min ago',
    responseStatus: 'accepted'
  },
  {
    id: '6',
    name: 'Daniel Kim',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=256&q=80',
    status: 'online',
    activity: 'Dinner',
    lastActive: '25 min ago',
    responseStatus: 'maybe'
  }
];

export const offlineFriends = [
  {
    id: 'user1',
    name: 'Alex Johnson',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
    status: 'offline' as const,
    lastSeen: '2 hours ago'
  },
  {
    id: 'user2',
    name: 'Sam Wilson',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
    status: 'offline' as const,
    lastSeen: '5 hours ago'
  },
  {
    id: 'user3',
    name: 'Taylor Swift',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
    status: 'offline' as const,
    lastSeen: '1 day ago'
  },
  {
    id: 'user4',
    name: 'Jamie Lee',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
    status: 'offline' as const,
    lastSeen: '3 days ago'
  }
];

export const activities = [
  { id: '1', name: 'Chill' },
  { id: '2', name: 'Coffee' },
  { id: '3', name: 'Walk' },
  { id: '4', name: 'Gym' },
  { id: '5', name: 'Movie' },
  { id: '6', name: 'Dinner' }
];

export const currentUser = {
  id: 'current',
  name: 'Alex Taylor',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=256&q=80',
  status: 'offline',
  activity: '',
};

// Profile data interfaces and mocks
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'available';
  lastAvailable: string;
  shareAvailability: 'today' | 'week' | 'forever' | 'never';
  isBlocked: boolean;
}

export const profileFriends: Friend[] = [
  {
    id: 'user1',
    name: 'Alex Johnson',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    status: 'available',
    lastAvailable: '2 minutes ago',
    shareAvailability: 'forever',
    isBlocked: false
  },
  {
    id: 'user2',
    name: 'Sam Wilson',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    status: 'online',
    lastAvailable: '1 hour ago',
    shareAvailability: 'week',
    isBlocked: false
  },
  {
    id: 'user3',
    name: 'Taylor Swift',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face',
    status: 'offline',
    lastAvailable: '1 day ago',
    shareAvailability: 'today',
    isBlocked: false
  },
  {
    id: 'user4',
    name: 'Jamie Lee',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    status: 'offline',
    lastAvailable: '3 days ago',
    shareAvailability: 'never',
    isBlocked: false
  },
  {
    id: 'user5',
    name: 'Chris Evans',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    status: 'available',
    lastAvailable: '5 minutes ago',
    shareAvailability: 'week',
    isBlocked: false
  },
  {
    id: 'user6',
    name: 'Emma Watson',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    status: 'online',
    lastAvailable: '30 minutes ago',
    shareAvailability: 'forever',
    isBlocked: false
  }
];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  joinedDate: string;
}

export const mockUserProfile: UserProfile = {
  id: 'current',
  name: 'Sina',
  email: 'sina@example.com',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  bio: 'Armastan uusi kogemusi ja sõpradega aega veeta! 🌟',
  joinedDate: '2024-01-15'
};

export const mockBlockedUsers: Friend[] = [
  {
    id: 'blocked1',
    name: 'Blocked User 1',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
    status: 'offline',
    lastAvailable: '1 week ago',
    shareAvailability: 'never',
    isBlocked: true
  }
];

export interface AppSettings {
  notifications: {
    friendInvitation: boolean;
    planSuggestion: boolean;
    newPoll: boolean;
    pollWinner: boolean;
    newChats: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    allowAnonymousInvites: boolean;
  };
}

export const defaultSettings: AppSettings = {
  notifications: {
    friendInvitation: true,
    planSuggestion: true,
    newPoll: true,
    pollWinner: true,
    newChats: true,
  },
  privacy: {
    showOnlineStatus: true,
    allowAnonymousInvites: false,
  }
};