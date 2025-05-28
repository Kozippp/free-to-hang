import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  planId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'text' | 'image' | 'voice' | 'poll';
  content: string;
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  pollData?: {
    question: string;
    options: {
      id: string;
      text: string;
      votes: string[];
    }[];
  };
  reactions: {
    [userId: string]: string; // emoji
  };
  timestamp: number;
  isRead: boolean;
  edited?: boolean;
}

export interface ChatState {
  messages: { [planId: string]: ChatMessage[] };
  
  // Actions
  sendMessage: (planId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'reactions' | 'isRead' | 'edited'>) => void;
  addReaction: (planId: string, messageId: string, userId: string, emoji: string) => void;
  removeReaction: (planId: string, messageId: string, userId: string) => void;
  voteInPoll: (planId: string, messageId: string, optionId: string, userId: string) => void;
  markMessagesAsRead: (planId: string, userId: string) => void;
  getUnreadCount: (planId: string, userId: string) => number;
  deleteMessage: (planId: string, messageId: string) => void;
  editMessage: (planId: string, messageId: string, newContent: string) => void;
}

// Demo messages for testing
const demoMessages: { [planId: string]: ChatMessage[] } = {
  'plan-1': [
    // Older messages
    {
      id: 'demo-1',
      planId: 'plan-1',
      userId: 'friend-1',
      userName: 'Alex Johnson',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Hey everyone! Looking forward to tonight 🎉',
      reactions: { 'current': '👍', 'friend-2': '❤️' },
      timestamp: Date.now() - 3600000, // 1 hour ago
      isRead: true,
    },
    {
      id: 'demo-2', 
      planId: 'plan-1',
      userId: 'current',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Same here! Should we meet at 7 PM?',
      reactions: {},
      timestamp: Date.now() - 3500000,
      isRead: true,
    },
    {
      id: 'demo-3',
      planId: 'plan-1', 
      userId: 'friend-2',
      userName: 'Emma Wilson',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Perfect! I\'ll bring some snacks 🍿',
      reactions: { 'current': '😋' },
      timestamp: Date.now() - 3400000,
      isRead: true,
    },
    {
      id: 'demo-4',
      planId: 'plan-1',
      userId: 'friend-1', 
      userName: 'Alex Johnson',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      type: 'image',
      content: 'Found this great spot! 📍',
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop',
      reactions: { 'current': '😮', 'friend-2': '👍' },
      timestamp: Date.now() - 3000000,
      isRead: true,
    },
    {
      id: 'demo-5',
      planId: 'plan-1',
      userId: 'current',
      userName: 'You', 
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Wow that looks amazing! 😍',
      reactions: {},
      timestamp: Date.now() - 2900000,
      isRead: true,
    },
    {
      id: 'demo-6',
      planId: 'plan-1',
      userId: 'friend-3',
      userName: 'Michael Chen',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Sorry guys, running a bit late! Should be there by 7:15',
      reactions: {},
      timestamp: Date.now() - 600000, // 10 minutes ago
      isRead: true,
    },
    {
      id: 'demo-7',
      planId: 'plan-1',
      userId: 'friend-2',
      userName: 'Emma Wilson', 
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      type: 'voice',
      content: 'Voice message',
      voiceUrl: 'voice://demo-voice',
      voiceDuration: 8,
      reactions: {},
      timestamp: Date.now() - 300000, // 5 minutes ago
      isRead: false,
    },
    {
      id: 'demo-8',
      planId: 'plan-1',
      userId: 'current',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'No worries Michael! See you there 👋',
      reactions: { 'friend-3': '👍' },
      timestamp: Date.now() - 240000, // 4 minutes ago
      isRead: true,
    },
    {
      id: 'demo-9',
      planId: 'plan-1',
      userId: 'friend-1',
      userName: 'Alex Johnson',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Just arrived! Emma where are you sitting?',
      reactions: {},
      timestamp: Date.now() - 120000, // 2 minutes ago
      isRead: false,
    },
    {
      id: 'demo-10',
      planId: 'plan-1',
      userId: 'friend-2',
      userName: 'Emma Wilson',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Table by the window! Look for the girl with popcorn 🍿😄',
      reactions: { 'friend-1': '😂' },
      timestamp: Date.now() - 60000, // 1 minute ago
      isRead: false,
    },
    {
      id: 'demo-11',
      planId: 'plan-1',
      userId: 'current',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Heading there now! Be there in 5 🚗',
      reactions: {},
      timestamp: Date.now() - 30000, // 30 seconds ago  
      isRead: false,
    }
  ],
  // New plan "sõnumid" for testing chat
  '3': [
    {
      id: 'chat-1',
      planId: '3',
      userId: 'user1',
      userName: 'Alex Johnson',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Tere kõik! Kuidas läheb? 👋',
      reactions: { 'current': '👍' },
      timestamp: Date.now() - 3600000, // 1 hour ago
      isRead: true,
    },
    {
      id: 'chat-2',
      planId: '3',
      userId: 'current',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Tere Alex! Väga hästi, tänan! 😊',
      reactions: {},
      timestamp: Date.now() - 3500000,
      isRead: true,
    },
    {
      id: 'chat-3',
      planId: '3',
      userId: 'user2',
      userName: 'Emma Wilson',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Testima chat reaktsioone! ❤️',
      reactions: { 'current': '😂', 'user1': '❤️' },
      timestamp: Date.now() - 3000000,
      isRead: true,
    },
    {
      id: 'chat-4',
      planId: '3',
      userId: 'user3',
      userName: 'Michael Chen',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      type: 'image',
      content: 'Vaadake seda pilti! 📸',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop',
      reactions: { 'current': '😍', 'user2': '👍' },
      timestamp: Date.now() - 2500000,
      isRead: true,
    },
    {
      id: 'chat-5',
      planId: '3',
      userId: 'current',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Vapustav pilt Michael! Kus see on? 🤔',
      reactions: { 'user3': '👍' },
      timestamp: Date.now() - 2000000,
      isRead: true,
    },
    {
      id: 'chat-6',
      planId: '3',
      userId: 'user2',
      userName: 'Emma Wilson',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      type: 'voice',
      content: 'Voice message',
      voiceUrl: 'voice://demo-voice-estonian',
      voiceDuration: 12,
      reactions: {},
      timestamp: Date.now() - 600000, // 10 minutes ago
      isRead: false,
    },
    {
      id: 'chat-7',
      planId: '3',
      userId: 'user1',
      userName: 'Alex Johnson',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Kas keegi tuleb täna õhtul välja? 🌃',
      reactions: {},
      timestamp: Date.now() - 300000, // 5 minutes ago
      isRead: false,
    },
    {
      id: 'chat-8',
      planId: '3',
      userId: 'current',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Mina tulen kindlasti! 🙋‍♂️',
      reactions: { 'user1': '🎉' },
      timestamp: Date.now() - 120000, // 2 minutes ago
      isRead: false,
    },
    {
      id: 'chat-9',
      planId: '3',
      userId: 'user3',
      userName: 'Michael Chen',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Ma ka! Mis aeg? ⏰',
      reactions: {},
      timestamp: Date.now() - 60000, // 1 minute ago
      isRead: false,
    },
    {
      id: 'chat-10',
      planId: '3',
      userId: 'user2',
      userName: 'Emma Wilson',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Võib-olla 19:00? 🤷‍♀️',
      reactions: { 'current': '👍', 'user3': '✅' },
      timestamp: Date.now() - 30000, // 30 seconds ago
      isRead: false,
    }
  ],
  // You can add more plan IDs here for testing different conversations
  'plan-2': [
    {
      id: 'demo-2-1',
      planId: 'plan-2',
      userId: 'friend-4',
      userName: 'Sarah Kim',
      userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'Who\'s free for lunch tomorrow?',
      reactions: {},
      timestamp: Date.now() - 1800000, // 30 minutes ago
      isRead: true,
    },
    {
      id: 'demo-2-2',
      planId: 'plan-2',
      userId: 'current',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      type: 'text',
      content: 'I am! What did you have in mind?',
      reactions: {},
      timestamp: Date.now() - 1700000,
      isRead: true,
    }
  ]
};

const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: demoMessages,
      
      sendMessage: (planId, messageData) => {
        const newMessage: ChatMessage = {
          ...messageData,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          reactions: {},
          isRead: false,
        };
        
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: [...(state.messages[planId] || []), newMessage]
          }
        }));
      },
      
      addReaction: (planId, messageId, userId, emoji) => {
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.map(msg =>
              msg.id === messageId
                ? { ...msg, reactions: { ...msg.reactions, [userId]: emoji } }
                : msg
            ) || []
          }
        }));
      },
      
      removeReaction: (planId, messageId, userId) => {
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.map(msg => {
              if (msg.id === messageId) {
                const { [userId]: removed, ...remainingReactions } = msg.reactions;
                return { ...msg, reactions: remainingReactions };
              }
              return msg;
            }) || []
          }
        }));
      },
      
      voteInPoll: (planId, messageId, optionId, userId) => {
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.map(msg => {
              if (msg.id === messageId && msg.pollData) {
                return {
                  ...msg,
                  pollData: {
                    ...msg.pollData,
                    options: msg.pollData.options.map(option => {
                      // Remove user's vote from all options first
                      const votesWithoutUser = option.votes.filter(id => id !== userId);
                      // Add vote to selected option
                      return {
                        ...option,
                        votes: option.id === optionId 
                          ? [...votesWithoutUser, userId]
                          : votesWithoutUser
                      };
                    })
                  }
                };
              }
              return msg;
            }) || []
          }
        }));
      },
      
      markMessagesAsRead: (planId, userId) => {
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.map(msg =>
              msg.userId !== userId ? { ...msg, isRead: true } : msg
            ) || []
          }
        }));
      },
      
      getUnreadCount: (planId, userId) => {
        const messages = get().messages[planId] || [];
        return messages.filter(msg => msg.userId !== userId && !msg.isRead).length;
      },
      
      deleteMessage: (planId, messageId) => {
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.filter(msg => msg.id !== messageId) || []
          }
        }));
      },
      
      editMessage: (planId, messageId, newContent) => {
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.map(msg =>
              msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
            ) || []
          }
        }));
      },
    }),
    {
      name: 'chat-storage',
    }
  )
);

export default useChatStore; 