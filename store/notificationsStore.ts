import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type NotificationSender = {
  id: string;
  name: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

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
  sender?: NotificationSender | null;
}

interface NotificationsState {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  subscriptionActive: boolean;
  currentUserId: string | null;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  startRealTimeUpdates: (userId: string) => void;
  stopRealTimeUpdates: () => void;
  checkAndRestartSubscription: (userId: string) => void;
  updateUnreadCount: () => void;
  clearAll: () => void;
}

// Global variables for subscription management
let notificationsChannel: RealtimeChannel | null = null;
let isStartingRealtime = false;
let notificationsHealthCheckInterval: ReturnType<typeof setInterval> | null = null;
let notificationsRestartTimeout: ReturnType<typeof setTimeout> | null = null;
let notificationsRetryAttempts = 0;

// Retry configuration (same as other stores for consistency)
const MAX_NOTIFICATIONS_RETRIES = 3;
const NOTIFICATIONS_RETRY_DELAYS_MS = [2000, 5000, 10000, 30000, 60000];
const NOTIFICATIONS_HEALTH_CHECK_INTERVAL = 60000; // 60s

const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  subscriptionActive: false,
  currentUserId: null,

  fetchNotifications: async (userId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:triggered_by (id, name, username, avatar_url)')
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
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true, read_at: new Date().toISOString() }
          : notification
      )
    }));
    get().updateUnreadCount();

    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      // Revert optimistic update on error
      get().fetchNotifications(get().currentUserId || '');
    }
  },

  markAllAsRead: async (userId: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        read: true,
        read_at: new Date().toISOString()
      }))
    }));
    get().updateUnreadCount();

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
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      // Revert optimistic update on error
      get().fetchNotifications(userId);
    }
  },

  deleteNotification: async (notificationId: string) => {
    // Optimistic update
    const previousNotifications = get().notifications;
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== notificationId)
    }));
    get().updateUnreadCount();

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      // Revert optimistic update on error
      set({ notifications: previousNotifications });
      get().updateUnreadCount();
    }
  },

  updateUnreadCount: () => {
    const { notifications } = get();
    set({
      unreadCount: notifications.filter((notification) => !notification.read).length
    });
  },

  startRealTimeUpdates: (userId: string) => {
    if (!userId) {
      console.log('⏸️ No userId provided for notifications realtime');
      return;
    }

    // Guard against parallel starts
    if (isStartingRealtime) {
      console.log('⏸️ Notifications realtime already starting - skipping');
      return;
    }

    // Check if already subscribed with same user
    if (notificationsChannel && get().subscriptionActive && get().currentUserId === userId) {
      const channelState = notificationsChannel.state;
      if (channelState === 'joined') {
        console.log('✅ Notifications realtime already active for this user');
        return;
      }
    }

    isStartingRealtime = true;
    console.log('🚀 Starting notifications realtime updates for user:', userId);

    // Clean up existing channel if any
    if (notificationsChannel) {
      console.log('🧹 Cleaning up existing notifications channel');
      supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }

    // Clear any pending restart timeout
    if (notificationsRestartTimeout) {
      clearTimeout(notificationsRestartTimeout);
      notificationsRestartTimeout = null;
    }

    // Reset retry attempts on fresh start
    notificationsRetryAttempts = 0;

    // Store current user ID
    set({ currentUserId: userId });

    // Create new channel with unique name
    const channelName = `notifications_${userId}_${Date.now()}`;
    
    notificationsChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('🔔 New notification received:', payload.new);
          void (async () => {
            const baseNotification = payload.new as NotificationRecord;
            let enrichedNotification = baseNotification;

            if (!baseNotification.sender && baseNotification.triggered_by) {
              const { data: senderData, error } = await supabase
                .from('user_directory')
                .select('id, name, username, avatar_url')
                .eq('id', baseNotification.triggered_by)
                .single();

              if (!error && senderData) {
                enrichedNotification = { ...baseNotification, sender: senderData };
              }
            }

            set((state) => ({
              notifications: [enrichedNotification, ...state.notifications].slice(0, 100)
            }));
            get().updateUnreadCount();
          })();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updatedNotification = payload.new as NotificationRecord;
          set((state) => ({
            notifications: state.notifications.map((notification) => {
              if (notification.id !== updatedNotification.id) {
                return notification;
              }
              return {
                ...updatedNotification,
                sender: updatedNotification.sender ?? notification.sender ?? null
              };
            })
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
      .subscribe((status) => {
        handleNotificationsChannelStatus(status, userId);
      });

    // Start health check system
    startNotificationsHealthCheck(userId);

    // Release lock after channel setup
    setTimeout(() => {
      isStartingRealtime = false;
      console.log('✅ Notifications realtime start completed');
    }, 1000);
  },

  stopRealTimeUpdates: () => {
    console.log('🛑 Stopping notifications realtime updates...');
    
    isStartingRealtime = false;

    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }

    if (notificationsRestartTimeout) {
      clearTimeout(notificationsRestartTimeout);
      notificationsRestartTimeout = null;
    }

    stopNotificationsHealthCheck();
    notificationsRetryAttempts = 0;

    set({ subscriptionActive: false });
    console.log('✅ Notifications realtime updates stopped');
  },

  checkAndRestartSubscription: (userId: string) => {
    if (!userId) return;

    const channelState = notificationsChannel?.state;
    
    if (channelState === 'joined' && get().subscriptionActive) {
      // Subscription is healthy, no action needed
      return;
    }

    console.log('🔄 Notifications subscription needs restart, current state:', channelState);
    get().startRealTimeUpdates(userId);
  },

  clearAll: () => {
    console.log('🧹 Clearing all notifications state...');
    
    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }

    if (notificationsRestartTimeout) {
      clearTimeout(notificationsRestartTimeout);
      notificationsRestartTimeout = null;
    }

    stopNotificationsHealthCheck();
    isStartingRealtime = false;
    notificationsRetryAttempts = 0;

    set({
      notifications: [],
      unreadCount: 0,
      subscriptionActive: false,
      loading: false,
      currentUserId: null
    });
  }
}));

// Handle channel status changes
function handleNotificationsChannelStatus(status: string, userId: string) {
  console.log('📡 Notifications channel status:', status);

  if (status === 'SUBSCRIBED') {
    console.log('✅ Notifications realtime SUBSCRIBED');
    notificationsRetryAttempts = 0;
    useNotificationsStore.setState({ subscriptionActive: true });
    
    if (notificationsRestartTimeout) {
      clearTimeout(notificationsRestartTimeout);
      notificationsRestartTimeout = null;
    }
    return;
  }

  // Ignore intermediate state changes
  if (status === 'CHANNEL_STATE_CHANGE') {
    return;
  }

  if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(status)) {
    console.log(`❌ Notifications channel ${status}`);
    useNotificationsStore.setState({ subscriptionActive: false });
    notificationsChannel = null;
    
    scheduleNotificationsRestart(userId);
  }
}

// Schedule a restart with exponential backoff
function scheduleNotificationsRestart(userId: string) {
  if (notificationsRetryAttempts >= MAX_NOTIFICATIONS_RETRIES) {
    console.error('❌ Notifications realtime failed after maximum retries');
    return;
  }

  // Don't schedule if already scheduled
  if (notificationsRestartTimeout) {
    return;
  }

  const baseDelay = NOTIFICATIONS_RETRY_DELAYS_MS[
    Math.min(notificationsRetryAttempts, NOTIFICATIONS_RETRY_DELAYS_MS.length - 1)
  ];
  const jitter = Math.random() * 1000;
  const delay = baseDelay + jitter;
  const attemptNumber = notificationsRetryAttempts + 1;
  notificationsRetryAttempts = attemptNumber;

  console.log(
    `🔄 Scheduling notifications restart in ${delay.toFixed(0)}ms (attempt ${attemptNumber}/${MAX_NOTIFICATIONS_RETRIES})`
  );

  notificationsRestartTimeout = setTimeout(() => {
    notificationsRestartTimeout = null;
    console.log('♻️ Attempting to restart notifications realtime...');
    useNotificationsStore.getState().startRealTimeUpdates(userId);
  }, delay);
}

// Health check system
function startNotificationsHealthCheck(userId: string) {
  if (notificationsHealthCheckInterval) {
    return;
  }

  console.log('💓 Starting notifications health check system...');
  let failedChecks = 0;

  notificationsHealthCheckInterval = setInterval(() => {
    const channelState = notificationsChannel?.state;

    if (channelState !== 'joined') {
      failedChecks += 1;
      console.log(
        `⚠️ Notifications health check warning (state: ${channelState ?? 'null'}, failures: ${failedChecks})`
      );

      if (failedChecks >= 2 && !isStartingRealtime) {
        console.log('🔄 Notifications health check triggering restart...');
        useNotificationsStore.getState().startRealTimeUpdates(userId);
        failedChecks = 0;
      }
    } else if (failedChecks > 0) {
      // Silently reset failure count when healthy again
      failedChecks = 0;
    }
  }, NOTIFICATIONS_HEALTH_CHECK_INTERVAL);
}

function stopNotificationsHealthCheck() {
  if (notificationsHealthCheckInterval) {
    clearInterval(notificationsHealthCheckInterval);
    notificationsHealthCheckInterval = null;
    console.log('💓 Notifications health check stopped');
  }
}

export default useNotificationsStore;
