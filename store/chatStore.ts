import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { API_CONFIG } from '@/constants/config';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  waveformData?: number[]; // Audio waveform data for voice messages
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
  // Reply functionality
  replyTo?: {
    messageId: string;
    userId: string;
    userName: string;
    content: string;
    type: 'text' | 'image' | 'voice' | 'poll';
  };
}

export interface ReadReceipt {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string;
  user: {
    id: string;
    name: string;
    avatar_url: string;
  };
}

interface ChatState {
  messages: { [planId: string]: ChatMessage[] };
  // Read receipts state
  readReceipts: { [planId: string]: { [userId: string]: ReadReceipt } };
  // Reply state
  replyingTo: { [planId: string]: ChatMessage | null };
  // Loading states
  loading: { [planId: string]: boolean };
  // Real-time subscriptions
  subscriptions: { [planId: string]: RealtimeChannel };
  // Sync state
  isSyncing: { [planId: string]: boolean };

  // Actions
  fetchMessages: (planId: string) => Promise<void>;
  fetchReadReceipts: (planId: string) => Promise<void>;
  sendMessage: (planId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'reactions' | 'isRead' | 'edited'>) => Promise<void>;
  addReaction: (planId: string, messageId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (planId: string, messageId: string, userId: string) => Promise<void>;
  markMessagesAsRead: (planId: string, userId: string) => Promise<void>;
  getUnreadCount: (planId: string, userId: string) => number;
  deleteMessage: (planId: string, messageId: string) => Promise<void>;
  editMessage: (planId: string, messageId: string, newContent: string) => Promise<void>;
  // Reply actions
  setReplyingTo: (planId: string, message: ChatMessage | null) => void;
  getReplyingTo: (planId: string) => ChatMessage | null;
  // Real-time subscription
  subscribeToChat: (planId: string) => void;
  unsubscribeFromChat: (planId: string) => void;
  // Helper actions
  addMessageToStore: (planId: string, message: ChatMessage) => void;
  updateMessageInStore: (planId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessageFromStore: (planId: string, messageId: string) => void;
  updateReadReceipt: (planId: string, userId: string, receipt: ReadReceipt) => void;
}

// Helper function to transform backend message to ChatMessage
const transformMessage = (dbMessage: any): ChatMessage => {
  // Handle user data (could be object or array)
  const user = Array.isArray(dbMessage.user) ? dbMessage.user[0] : dbMessage.user;
  
  // Handle reply_to data (could be object or array)
  let replyTo = undefined;
  if (dbMessage.reply_to) {
    const replyMsg = Array.isArray(dbMessage.reply_to) ? dbMessage.reply_to[0] : dbMessage.reply_to;
    if (replyMsg) {
      const replyUser = Array.isArray(replyMsg.user) ? replyMsg.user[0] : replyMsg.user;
      replyTo = {
        messageId: replyMsg.id,
        userId: replyUser?.id || '',
        userName: replyUser?.name || 'Unknown User',
        content: replyMsg.content || '',
        type: replyMsg.type || 'text'
      };
    }
  }
  
  return {
    id: dbMessage.id,
    planId: dbMessage.plan_id,
    userId: dbMessage.user_id,
    userName: user?.name || 'Unknown User',
    userAvatar: user?.avatar_url || '',
    type: dbMessage.type,
    content: dbMessage.content || '',
    imageUrl: dbMessage.image_url,
    voiceUrl: dbMessage.voice_url,
    voiceDuration: dbMessage.voice_duration,
    reactions: dbMessage.reactions || {},
    timestamp: new Date(dbMessage.created_at).getTime(),
    isRead: false, // Will be determined by read receipts
    edited: dbMessage.edited || false,
    replyTo
  };
};

// Helper function to get auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  readReceipts: {},
      replyingTo: {},
  loading: {},
  subscriptions: {},
  isSyncing: {},
  
  // ============================================
  // FETCH MESSAGES
  // ============================================
  fetchMessages: async (planId: string) => {
    try {
      set(state => ({
        loading: { ...state.loading, [planId]: true }
      }));

      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/${planId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const result = await response.json();
      const messages = result.data.map(transformMessage);

      set(state => ({
        messages: {
          ...state.messages,
          [planId]: messages
        },
        loading: { ...state.loading, [planId]: false }
      }));

      console.log(`✅ Fetched ${messages.length} messages for plan ${planId}`);

    } catch (error) {
      console.error('Error fetching messages:', error);
      set(state => ({
        loading: { ...state.loading, [planId]: false }
      }));
    }
  },

  // ============================================
  // FETCH READ RECEIPTS
  // ============================================
  fetchReadReceipts: async (planId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/${planId}/read-receipts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch read receipts');
      }

      const result = await response.json();
      const receipts = result.data;

      set(state => ({
        readReceipts: {
          ...state.readReceipts,
          [planId]: receipts
        }
      }));

      console.log(`✅ Fetched ${Object.keys(receipts).length} read receipts for plan ${planId}`);

    } catch (error) {
      console.error('Error fetching read receipts:', error);
    }
  },
  
  // ============================================
  // SEND MESSAGE
  // ============================================
  sendMessage: async (planId: string, messageData) => {
    try {
        const state = get();
        const replyingToMessage = state.replyingTo[planId];
        
      // Create temporary message for optimistic update
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tempMessage: ChatMessage = {
          ...messageData,
        id: tempId,
          timestamp: Date.now(),
          reactions: {},
          isRead: false,
          replyTo: replyingToMessage ? {
            messageId: replyingToMessage.id,
            userId: replyingToMessage.userId,
            userName: replyingToMessage.userName,
            content: replyingToMessage.content,
            type: replyingToMessage.type,
          } : undefined,
        };
        
      // Optimistic update
      set(state => ({
        messages: {
          ...state.messages,
          [planId]: [...(state.messages[planId] || []), tempMessage]
        }
      }));
      
      // Send to backend
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        // Remove temp message
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId].filter(m => m.id !== tempId)
          }
        }));
        return;
      }
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/${planId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: messageData.type,
            content: messageData.content,
            imageUrl: messageData.imageUrl,
            voiceUrl: messageData.voiceUrl,
            voiceDuration: messageData.voiceDuration,
            replyToMessageId: replyingToMessage?.id
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const result = await response.json();
      const realMessage = transformMessage(result.data);
      
      // Replace temp message with real one
      set(state => ({
        messages: {
          ...state.messages,
          [planId]: state.messages[planId].map(m => 
            m.id === tempId ? realMessage : m
          )
        },
        // Clear reply state
          replyingTo: {
            ...state.replyingTo,
            [planId]: null
          }
        }));
      
      console.log(`✅ Message sent: ${realMessage.id}`);
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally remove failed message or mark it
    }
  },
  
  // ============================================
  // ADD REACTION
  // ============================================
  addReaction: async (planId: string, messageId: string, userId: string, emoji: string) => {
    try {
      // Optimistic update
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
      
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/messages/${messageId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emoji })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to add reaction');
      }
      
      const result = await response.json();
      
      // Update with server response
      set(state => ({
        messages: {
          ...state.messages,
          [planId]: state.messages[planId]?.map(msg =>
            msg.id === messageId
              ? { ...msg, reactions: result.data.allReactions }
              : msg
          ) || []
        }
      }));
      
      console.log(`✅ Reaction added to message ${messageId}`);
      
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Revert optimistic update on error
      get().fetchMessages(planId);
    }
  },
  
  // ============================================
  // REMOVE REACTION
  // ============================================
  removeReaction: async (planId: string, messageId: string, userId: string) => {
    try {
      // Optimistic update
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
      
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/messages/${messageId}/reactions`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to remove reaction');
      }
      
      console.log(`✅ Reaction removed from message ${messageId}`);
      
    } catch (error) {
      console.error('Error removing reaction:', error);
      // Revert optimistic update on error
      get().fetchMessages(planId);
    }
  },
  
  // ============================================
  // MARK MESSAGES AS READ
  // ============================================
  markMessagesAsRead: async (planId: string, userId: string) => {
    try {
      const messages = get().messages[planId] || [];
      const lastMessage = messages[messages.length - 1];

      if (!lastMessage) return;

      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/${planId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            lastReadMessageId: lastMessage.id
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark messages as read');
      }

      const result = await response.json();

      // Update read receipt locally
      const receipt: ReadReceipt = {
        userId: userId,
        lastReadMessageId: lastMessage.id,
        lastReadAt: new Date().toISOString(),
        user: result.data.user || { id: userId, name: '', avatar_url: '' }
      };

      get().updateReadReceipt(planId, userId, receipt);

      console.log(`✅ Marked messages as read for user ${userId} in plan ${planId}`);

    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  },
      
  // ============================================
  // GET UNREAD COUNT
  // ============================================
  getUnreadCount: (planId: string, userId: string) => {
        const messages = get().messages[planId] || [];
        return messages.filter(msg => msg.userId !== userId && !msg.isRead).length;
      },
      
  // ============================================
  // DELETE MESSAGE
  // ============================================
  deleteMessage: async (planId: string, messageId: string) => {
    try {
      // Optimistic update
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.filter(msg => msg.id !== messageId) || []
          }
        }));
      
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to delete message');
      }
      
      console.log(`✅ Message deleted: ${messageId}`);
      
    } catch (error) {
      console.error('Error deleting message:', error);
      // Revert optimistic update on error
      get().fetchMessages(planId);
    }
  },
  
  // ============================================
  // EDIT MESSAGE
  // ============================================
  editMessage: async (planId: string, messageId: string, newContent: string) => {
    try {
      // Optimistic update
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId]?.map(msg =>
              msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
            ) || []
          }
        }));
      
      const token = await getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/chat/messages/${messageId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: newContent })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to edit message');
      }
      
      console.log(`✅ Message edited: ${messageId}`);
      
    } catch (error) {
      console.error('Error editing message:', error);
      // Revert optimistic update on error
      get().fetchMessages(planId);
    }
  },
  
  // ============================================
  // REPLY ACTIONS
  // ============================================
  setReplyingTo: (planId: string, message: ChatMessage | null) => {
        set(state => ({
          replyingTo: {
            ...state.replyingTo,
            [planId]: message
          }
        }));
      },
      
  getReplyingTo: (planId: string) => {
        return get().replyingTo[planId] || null;
      },
  
  // ============================================
  // REAL-TIME SUBSCRIPTION
  // ============================================
  subscribeToChat: (planId: string) => {
    const state = get();
    
    // Don't subscribe twice
    if (state.subscriptions[planId]) {
      console.log(`Already subscribed to chat ${planId}`);
      return;
    }
    
    console.log(`📡 Subscribing to chat ${planId}`);
    
    const channel = supabase
      .channel(`chat:${planId}`)
      // Listen for new messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `plan_id=eq.${planId}`
        },
        async (payload) => {
          console.log('📨 New message received:', payload);
          
          try {
            // Fetch full message with user details
            const { data, error } = await supabase
              .from('chat_messages')
              .select(`
                *,
                user:users(id, name, username, avatar_url)
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (error) {
              console.error('Error fetching message:', error);
              return;
            }
            
            if (data) {
              // If there's a reply_to, fetch it separately
              if (data.reply_to_message_id) {
                const { data: replyData } = await supabase
                  .from('chat_messages')
                  .select(`
                    id, 
                    content, 
                    type,
                    user:users(id, name)
                  `)
                  .eq('id', data.reply_to_message_id)
                  .single();
                
                if (replyData) {
                  data.reply_to = replyData;
                }
              }
              
              const message = transformMessage(data);
              get().addMessageToStore(planId, message);
            }
          } catch (error) {
            console.error('Error processing new message:', error);
          }
        }
      )
      // Listen for message updates (edits and deletes)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `plan_id=eq.${planId}`
        },
        (payload) => {
          console.log('✏️ Message updated:', payload);
          
          // If message was deleted (unsend), remove it from store
          if (payload.new.deleted === true) {
            console.log('🗑️ Message deleted, removing from store:', payload.new.id);
            get().removeMessageFromStore(planId, payload.new.id);
          } else {
            // Otherwise update the message content
            get().updateMessageInStore(planId, payload.new.id, {
              content: payload.new.content,
              edited: payload.new.edited
            });
          }
        }
      )
      // Listen for reactions
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_reactions'
        },
        async (payload) => {
          console.log('👍 Reaction changed:', payload);

          // Refetch all reactions for this message
          const messageId = payload.new?.message_id || payload.old?.message_id;
          if (!messageId || typeof messageId !== 'string') return;

          const { data: reactions } = await supabase
            .from('chat_reactions')
            .select('user_id, emoji')
            .eq('message_id', messageId);

          const reactionsMap: { [key: string]: string } = {};
          reactions?.forEach(r => {
            reactionsMap[r.user_id] = r.emoji;
          });

          get().updateMessageInStore(planId, messageId, {
            reactions: reactionsMap
          });
        }
      )
      // Listen for read receipts
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_read_receipts',
          filter: `plan_id=eq.${planId}`
        },
        async (payload) => {
          console.log('📖 Read receipt changed:', payload);

          // Refetch read receipts for this plan
          get().fetchReadReceipts(planId);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Chat subscription status for ${planId}:`, status);
      });
    
    // Store subscription
    set(state => ({
      subscriptions: {
        ...state.subscriptions,
        [planId]: channel
      }
    }));
  },
  
  // ============================================
  // UNSUBSCRIBE FROM CHAT
  // ============================================
  unsubscribeFromChat: (planId: string) => {
    const state = get();
    const channel = state.subscriptions[planId];
    
    if (channel) {
      console.log(`📡 Unsubscribing from chat ${planId}`);
      supabase.removeChannel(channel);
      
      set(state => {
        const { [planId]: removed, ...remainingSubscriptions } = state.subscriptions;
        return { subscriptions: remainingSubscriptions };
      });
    }
  },
  
  // ============================================
  // HELPER ACTIONS
  // ============================================
  addMessageToStore: (planId: string, message: ChatMessage) => {
    set(state => {
      const existingMessages = state.messages[planId] || [];
      
      // Check if message already exists
      if (existingMessages.some(m => m.id === message.id)) {
        return state;
      }
      
      return {
        messages: {
          ...state.messages,
          [planId]: [...existingMessages, message]
        }
      };
    });
  },
  
  updateMessageInStore: (planId: string, messageId: string, updates: Partial<ChatMessage>) => {
    set(state => ({
      messages: {
        ...state.messages,
        [planId]: state.messages[planId]?.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        ) || []
      }
    }));
  },
  
  removeMessageFromStore: (planId: string, messageId: string) => {
    set(state => ({
      messages: {
        ...state.messages,
        [planId]: state.messages[planId]?.filter(msg => msg.id !== messageId) || []
      }
    }));
  },

  updateReadReceipt: (planId: string, userId: string, receipt: ReadReceipt) => {
    set(state => ({
      readReceipts: {
        ...state.readReceipts,
        [planId]: {
          ...state.readReceipts[planId],
          [userId]: receipt
        }
      }
    }));
  }
}));

export default useChatStore; 
