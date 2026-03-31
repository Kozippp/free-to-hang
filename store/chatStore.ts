import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { API_CONFIG } from '@/constants/config';
import { RealtimeChannel } from '@supabase/supabase-js';
import { generateUUID } from '@/utils/idGenerator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import useUnseenStore from './unseenStore';

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
  markMessagesAsRead: (planId: string, userId: string, messageId?: string) => Promise<void>;
  getUnreadCount: (planId: string, userId: string) => number;
  deleteMessage: (planId: string, messageId: string) => Promise<void>;
  editMessage: (planId: string, messageId: string, newContent: string) => Promise<void>;
  // Reply actions
  setReplyingTo: (planId: string, message: ChatMessage | null) => void;
  getReplyingTo: (planId: string) => ChatMessage | null;
  // Real-time subscription
  subscribeToChat: (planId: string) => void;
  unsubscribeFromChat: (planId: string, options?: { preserveDesired?: boolean }) => void;
  // Helper actions
  addMessageToStore: (planId: string, message: ChatMessage) => void;
  updateMessageInStore: (planId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessageFromStore: (planId: string, messageId: string) => void;
  updateReadReceipt: (planId: string, userId: string, receipt: ReadReceipt) => void;
  uploadImage: (uri: string, planId: string) => Promise<string | null>;
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

async function fetchUserDirectoryProfile(
  userId: string
): Promise<{ id: string; name: string; username: string | null; avatar_url: string | null } | null> {
  const { data } = await supabase
    .from('user_directory')
    .select('id, name, username, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

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
  // FETCH READ RECEIPTS (direct Supabase)
  // ============================================
  fetchReadReceipts: async (planId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_read_receipts')
        .select(`
          user_id,
          last_read_message_id,
          last_read_at,
          user:user_id(id, name, avatar_url)
        `)
        .eq('plan_id', planId);

      if (error) {
        console.error('❌ [chatStore] fetchReadReceipts error:', error);
        return;
      }

      const receipts: Record<string, ReadReceipt> = {};
      for (const row of data ?? []) {
        receipts[row.user_id] = {
          userId: row.user_id,
          lastReadMessageId: row.last_read_message_id,
          lastReadAt: row.last_read_at,
          user: (row.user as any) ?? { id: row.user_id, name: '', avatar_url: '' },
        };
      }

      set(state => ({
        readReceipts: {
          ...state.readReceipts,
          [planId]: receipts,
        },
      }));

      console.log(`✅ [chatStore] Fetched ${Object.keys(receipts).length} read receipts (Supabase)`);
    } catch (error) {
      console.error('❌ [chatStore] fetchReadReceipts error:', error);
    }
  },
  
  // ============================================
  // SEND MESSAGE
  // ============================================
  sendMessage: async (planId: string, messageData) => {
    try {
        const state = get();
        const replyingToMessage = state.replyingTo[planId];
        
      // Generate stable ID for production quality (prevents duplicates)
      const messageId = generateUUID();
      
      const tempMessage: ChatMessage = {
          ...messageData,
        id: messageId,
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
        // Remove message if auth failed
        set(state => ({
          messages: {
            ...state.messages,
            [planId]: state.messages[planId].filter(m => m.id !== messageId)
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
            id: messageId,
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
      
      // Update with server data (e.g. timestamp) but keep same ID
      set(state => ({
        messages: {
          ...state.messages,
          [planId]: state.messages[planId].map(m =>
            m.id === messageId ? realMessage : m
          )
        },
        // Clear reply state
          replyingTo: {
            ...state.replyingTo,
            [planId]: null
          }
        }));

      // Update sender's read receipt locally + persist to Supabase (fire-and-forget)
      const senderNow = new Date().toISOString();
      const senderReceipt: ReadReceipt = {
        userId: realMessage.userId,
        lastReadMessageId: realMessage.id,
        lastReadAt: senderNow,
        user: {
          id: realMessage.userId,
          name: realMessage.userName,
          avatar_url: realMessage.userAvatar,
        },
      };
      get().updateReadReceipt(planId, realMessage.userId, senderReceipt);

      // Persist sender read receipt to Supabase (fire-and-forget)
      supabase
        .from('chat_read_receipts')
        .upsert(
          {
            plan_id: planId,
            user_id: realMessage.userId,
            last_read_message_id: realMessage.id,
            last_read_at: senderNow,
          },
          { onConflict: 'plan_id,user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('❌ [chatStore] sender read receipt upsert error:', error);
        });

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
  // MARK MESSAGES AS READ (direct Supabase upsert)
  // ============================================
  markMessagesAsRead: async (planId: string, userId: string, messageId?: string) => {
    try {
      const messages = get().messages[planId] || [];
      let targetMessage;

      if (messageId) {
        targetMessage = messages.find(m => m.id === messageId);
      } else {
        targetMessage = messages[messages.length - 1];
      }

      if (!targetMessage) return;

      // Skip temporary messages not yet persisted to Supabase
      if (targetMessage.id.startsWith('temp-')) {
        console.log('⏳ Skipping read receipt for temporary message');
        return;
      }

      const now = new Date().toISOString();

      // Optimistic update
      const existingReceipt = get().readReceipts[planId]?.[userId];
      const optimisticReceipt: ReadReceipt = {
        userId,
        lastReadMessageId: targetMessage.id,
        lastReadAt: now,
        user: existingReceipt?.user || { id: userId, name: '', avatar_url: '' },
      };
      get().updateReadReceipt(planId, userId, optimisticReceipt);
      console.log(`⚡ [chatStore] Optimistic read receipt: ${targetMessage.id}`);

      // Upsert directly to Supabase (retry on FK race: message may not exist yet)
      const upsertReceipt = async (): Promise<{ error: { code: string } | null }> =>
        supabase
          .from('chat_read_receipts')
          .upsert(
            {
              plan_id: planId,
              user_id: userId,
              last_read_message_id: targetMessage.id,
              last_read_at: now,
            },
            { onConflict: 'plan_id,user_id' }
          )
          .then(({ error }) => ({ error }));

      let result = await upsertReceipt();
      if (result.error?.code === '23503') {
        await new Promise(r => setTimeout(r, 400));
        result = await upsertReceipt();
      }

      if (result.error) {
        console.error('❌ [chatStore] markMessagesAsRead upsert error:', result.error);
        return;
      }

      // Update unseenStore (clears chat badge for this plan)
      useUnseenStore.getState().markChatSeen(planId);
      console.log(`✅ [chatStore] Read receipt persisted (Supabase) for ${userId} in plan ${planId}`);
    } catch (error) {
      console.error('❌ [chatStore] markMessagesAsRead error:', error);
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
    const existingChannel = state.subscriptions[planId];

    if (existingChannel) {
      if (existingChannel.state === 'joined') {
        console.log(`✅ Already subscribed: ${planId}`);
        return;
      }
      
      console.log(`🧹 Cleaning up existing channel for ${planId} (state: ${existingChannel.state})`);
      set(state => {
        const { [planId]: _, ...rest } = state.subscriptions;
        return { subscriptions: rest };
      });
      supabase.removeChannel(existingChannel);
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
            const { data: msgRow, error } = await supabase
              .from('chat_messages')
              .select('*')
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('Error fetching message:', error);
              return;
            }

            if (msgRow) {
              const userProfile = await fetchUserDirectoryProfile(msgRow.user_id);
              const data: Record<string, unknown> = { ...msgRow, user: userProfile };

              if (msgRow.reply_to_message_id) {
                const { data: replyRow } = await supabase
                  .from('chat_messages')
                  .select('id, content, type, user_id')
                  .eq('id', msgRow.reply_to_message_id)
                  .single();

                if (replyRow) {
                  const replyUser = await fetchUserDirectoryProfile(replyRow.user_id);
                  data.reply_to = { ...replyRow, user: replyUser };
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

          const newReaction = payload.new as { message_id?: string } | null;
          const oldReaction = payload.old as { message_id?: string } | null;
          const messageId = newReaction?.message_id || oldReaction?.message_id;
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
      // Listen for read receipts - optimized for real-time updates
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_read_receipts',
          filter: `plan_id=eq.${planId}`
        },
        async (payload) => {
          console.log('📖 New read receipt:', payload);

          // Fetch user details for the new receipt
          const { data: userData } = await supabase
            .from('user_directory')
            .select('id, name, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          if (userData) {
            const receipt: ReadReceipt = {
              userId: payload.new.user_id,
              lastReadMessageId: payload.new.last_read_message_id,
              lastReadAt: payload.new.last_read_at,
              user: userData
            };

            get().updateReadReceipt(planId, payload.new.user_id, receipt);
            console.log(`⚡ Real-time read receipt updated for ${userData.name}`);
            
            // If the read receipt is for the current user, update unseen counts
            // This handles the case where the user reads messages on another device
            // We can't easily check current user ID here without store access, but fetching counts is cheap enough
            useUnseenStore.getState().fetchUnseenCounts();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_read_receipts',
          filter: `plan_id=eq.${planId}`
        },
        async (payload) => {
          console.log('📖 Updated read receipt:', payload);

          // Fetch user details for the updated receipt
          const { data: userData } = await supabase
            .from('user_directory')
            .select('id, name, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          if (userData) {
            const receipt: ReadReceipt = {
              userId: payload.new.user_id,
              lastReadMessageId: payload.new.last_read_message_id,
              lastReadAt: payload.new.last_read_at,
              user: userData
            };

            get().updateReadReceipt(planId, payload.new.user_id, receipt);
            console.log(`⚡ Real-time read receipt updated for ${userData.name}`);
            
            // If the read receipt is for the current user, update unseen counts
            useUnseenStore.getState().fetchUnseenCounts();
          }
        }
      )
      .subscribe((status) => {
        handleChatChannelStatus(planId, status);
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
  // UPLOAD IMAGE
  // ============================================
  uploadImage: async (uri: string, planId: string) => {
    try {
      const ext = uri.substring(uri.lastIndexOf('.') + 1);
      const fileName = `${planId}/${generateUUID()}.${ext}`;
      
      console.log('📸 Uploading image:', fileName);
      
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, decode(base64), {
          contentType: `image/${ext}`,
          upsert: false
        });
        
      if (error) {
        console.error('❌ Upload error:', error);
        throw error;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);
        
      console.log('✅ Image uploaded successfully:', publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
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

function handleChatChannelStatus(planId: string, status: string) {
  console.log(`📡 Chat subscription status for ${planId}:`, status);

  if (status === 'SUBSCRIBED') {
    console.log(`✅ Chat connected: ${planId}`);
    // Fix: Fetch messages on reconnect to fill any gaps (messages missed while disconnected)
    useChatStore.getState().fetchMessages(planId);
  } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    // Only attempt reconnect if we still want this subscription (it's in the store)
    // The Supabase client handles many transient errors, but if we get a terminal state,
    // we can try a clean re-subscription after a delay.
    
    // We use a timeout to avoid rapid loops.
    // If the channel was removed from the store (unsubscribed) during this time,
    // we won't reconnect.
    setTimeout(() => {
      const store = useChatStore.getState();
      const currentChannel = store.subscriptions[planId];
      
      if (currentChannel) {
         console.log(`🔄 Attempting to reconnect chat ${planId} after ${status}...`);
         // Calling subscribeToChat will clean up the old one and start fresh
         store.subscribeToChat(planId);
      }
    }, 5000);
  }
}

export default useChatStore; 
