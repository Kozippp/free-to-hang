import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  read: boolean;
  read_at: string | null;
  triggered_by: string | null;
  created_at: string;
}

interface NotificationsState {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  subscriptionActive: boolean;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  startRealTimeUpdates: (userId: string) => void;
  stopRealTimeUpdates: () => void;
  updateUnreadCount: () => void;
  clearAll: () => void;
}

let notificationsChannel: RealtimeChannel | null = null;

const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  subscriptionActive: false,

  fetchNotifications: async (userId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      set({
        notifications: data ?? [],
        loading: false
      });
      get().updateUnreadCount();
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      set({ loading: false });
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true, read_at: new Date().toISOString() }
            : notification
        )
      }));

      get().updateUnreadCount();
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  },

  markAllAsRead: async (userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.map((notification) => ({
          ...notification,
          read: true,
          read_at: new Date().toISOString()
        }))
      }));

      get().updateUnreadCount();
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.filter((notification) => notification.id !== notificationId)
      }));

      get().updateUnreadCount();
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  },

  updateUnreadCount: () => {
    const { notifications } = get();
    set({
      unreadCount: notifications.filter((notification) => !notification.read).length
    });
  },

  startRealTimeUpdates: (userId: string) => {
    if (!userId) return;

    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }

    notificationsChannel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          set((state) => ({
            notifications: [payload.new as NotificationRecord, ...state.notifications].slice(0, 100)
          }));
          get().updateUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          set((state) => ({
            notifications: state.notifications.map((notification) =>
              notification.id === payload.new.id ? (payload.new as NotificationRecord) : notification
            )
          }));
          get().updateUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          set((state) => ({
            notifications: state.notifications.filter((notification) => notification.id !== payload.old.id)
          }));
          get().updateUnreadCount();
        }
      )
      .subscribe();

    set({ subscriptionActive: true });
  },

  stopRealTimeUpdates: () => {
    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }
    set({ subscriptionActive: false });
  },

  clearAll: () => {
    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }

    set({
      notifications: [],
      unreadCount: 0,
      subscriptionActive: false,
      loading: false
    });
  }
}));

export default useNotificationsStore;

