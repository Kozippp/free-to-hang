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
}

export interface ChatState {
  messages: { [planId: string]: ChatMessage[] };
  
  // Actions
  sendMessage: (planId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'reactions' | 'isRead'>) => void;
  addReaction: (planId: string, messageId: string, userId: string, emoji: string) => void;
  removeReaction: (planId: string, messageId: string, userId: string) => void;
  voteInPoll: (planId: string, messageId: string, optionId: string, userId: string) => void;
  markMessagesAsRead: (planId: string, userId: string) => void;
  getUnreadCount: (planId: string, userId: string) => number;
}

// Demo messages for testing
const demoMessages: { [planId: string]: ChatMessage[] } = {
  'plan-1': [
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
      type: 'poll',
      content: 'What time works best for everyone?',
      pollData: {
        question: 'What time works best for everyone?',
        options: [
          { id: 'time-1', text: '7:00 PM', votes: ['current', 'friend-1'] },
          { id: 'time-2', text: '7:30 PM', votes: ['friend-2'] },
          { id: 'time-3', text: '8:00 PM', votes: [] }
        ]
      },
      reactions: {},
      timestamp: Date.now() - 3000000,
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
      timestamp: Date.now() - 2000000,
      isRead: true,
    },
    {
      id: 'demo-5',
      planId: 'plan-1',
      userId: 'friend-2',
      userName: 'Emma Wilson', 
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      type: 'voice',
      content: 'Voice message',
      voiceUrl: 'voice://demo-voice',
      voiceDuration: 12,
      reactions: {},
      timestamp: Date.now() - 300000, // 5 minutes ago
      isRead: false,
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
    }),
    {
      name: 'chat-storage',
    }
  )
);

export default useChatStore; 