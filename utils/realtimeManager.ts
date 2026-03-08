import { AppState, AppStateStatus } from 'react-native';
import usePlansStore from '@/store/plansStore';
import useFriendsStore from '@/store/friendsStore';
import useHangStore from '@/store/hangStore';
import useChatStore from '@/store/chatStore';
import useNotificationsStore from '@/store/notificationsStore';
import useUnseenStore from '@/store/unseenStore';
import { supabase } from '@/lib/supabase';

/**
 * Global Realtime Manager
 * 
 * Centralized management of all Supabase realtime subscriptions.
 * Handles app state changes (background/foreground) and ensures
 * subscriptions are properly restarted when needed.
 */

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let currentUserId: string | null = null;
let isManagerInitialized = false;
let lastForegroundTime = 0;
const MIN_BACKGROUND_TIME_FOR_RESTART = 30000; // 30 seconds

// Track when app went to background
let backgroundStartTime = 0;

// Realtime channel for unseen counter triggers
let unseenRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

// Debounce timer for unseen count refetch
let unseenRefetchTimer: ReturnType<typeof setTimeout> | null = null;
const UNSEEN_REFETCH_DEBOUNCE_MS = 800;

function scheduleUnseenRefetch() {
  if (unseenRefetchTimer) clearTimeout(unseenRefetchTimer);
  unseenRefetchTimer = setTimeout(() => {
    useUnseenStore.getState().fetchUnseenCounts();
    unseenRefetchTimer = null;
  }, UNSEEN_REFETCH_DEBOUNCE_MS);
}

/**
 * Initialize the global realtime manager
 * Should be called once when user logs in
 */
export function initializeRealtimeManager(userId: string) {
  if (isManagerInitialized && currentUserId === userId) {
    console.log('✅ Realtime manager already initialized for this user');
    return;
  }

  console.log('🚀 Initializing global realtime manager for user:', userId);
  currentUserId = userId;
  isManagerInitialized = true;
  lastForegroundTime = Date.now();

  // Remove existing listener if any
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  // Set up global AppState listener
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Start all realtime subscriptions
  startAllSubscriptions(userId);
}

/**
 * Stop the global realtime manager
 * Should be called when user logs out
 */
export function stopRealtimeManager() {
  console.log('🛑 Stopping global realtime manager...');

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  stopAllSubscriptions();

  currentUserId = null;
  isManagerInitialized = false;
  backgroundStartTime = 0;

  console.log('✅ Global realtime manager stopped');
}

/**
 * Handle app state changes (background/foreground)
 */
function handleAppStateChange(nextAppState: AppStateStatus) {
  if (!currentUserId) {
    console.log('⚠️ AppState changed but no user - ignoring');
    return;
  }

  if (nextAppState === 'active') {
    const now = Date.now();
    const timeInBackground = backgroundStartTime > 0 ? now - backgroundStartTime : 0;

    console.log(`📱 App came to foreground (was in background for ${Math.round(timeInBackground / 1000)}s)`);

    // Only restart subscriptions if app was in background for a significant time
    if (timeInBackground > MIN_BACKGROUND_TIME_FOR_RESTART) {
      console.log('🔄 App was in background long enough - checking all subscriptions');
      
      // Small delay to ensure app is fully active
      setTimeout(() => {
        checkAndRestartAllSubscriptions(currentUserId!);
      }, 500);
    } else {
      console.log('⏸️ App was in background briefly - skipping full restart');
    }

    lastForegroundTime = now;
    backgroundStartTime = 0;
  } else if (nextAppState === 'background' || nextAppState === 'inactive') {
    if (backgroundStartTime === 0) {
      backgroundStartTime = Date.now();
      console.log('📱 App going to background');
    }
  }
}

/**
 * Start Supabase Realtime subscription for unseen counter triggers.
 * Listens for new plan_updates, chat_messages and friend_request changes
 * and debounces a full refetch of unseenStore.
 */
function startUnseenRealtimeSubscription(userId: string) {
  stopUnseenRealtimeSubscription();

  unseenRealtimeChannel = supabase
    .channel(`unseen_triggers_${userId}_${Date.now()}`)
    // New plan_update rows → control panel badge may change
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'plan_updates' },
      () => scheduleUnseenRefetch()
    )
    // New chat message → chat badge may change
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      () => scheduleUnseenRefetch()
    )
    // Friend request INSERT/UPDATE → friend request badge or new-friends badge
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'friend_requests' },
      () => scheduleUnseenRefetch()
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'friend_requests' },
      () => scheduleUnseenRefetch()
    )
    // plan_participants INSERT (new invitation) → invitation badge
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'plan_participants' },
      (payload) => {
        if ((payload.new as any)?.user_id === userId) {
          scheduleUnseenRefetch();
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ [unseenRealtime] Subscribed to unseen trigger channel');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ [unseenRealtime] Channel error – will retry on next foreground');
      }
    });
}

/**
 * Stop and clean up the unseen realtime channel.
 */
function stopUnseenRealtimeSubscription() {
  if (unseenRealtimeChannel) {
    supabase.removeChannel(unseenRealtimeChannel).catch(() => {});
    unseenRealtimeChannel = null;
  }
  if (unseenRefetchTimer) {
    clearTimeout(unseenRefetchTimer);
    unseenRefetchTimer = null;
  }
}

/**
 * Start all realtime subscriptions
 */
function startAllSubscriptions(userId: string) {
  console.log('🚀 Starting all realtime subscriptions...');

  // Plans store
  const plansStore = usePlansStore.getState();
  plansStore.startRealTimeUpdates(userId);

  // Hang store (friend status)
  const hangStore = useHangStore.getState();
  hangStore.startRealTimeUpdates();

  // Friends store (friend requests)
  const friendsStore = useFriendsStore.getState();
  friendsStore.startRealTimeUpdates();

  // Notifications store
  const notificationsStore = useNotificationsStore.getState();
  notificationsStore.fetchNotifications(userId);
  notificationsStore.startRealTimeUpdates(userId);

  // Unseen counts – initial fetch
  const unseenStore = useUnseenStore.getState();
  unseenStore.fetchUnseenCounts();

  // Unseen counts – Realtime triggers
  startUnseenRealtimeSubscription(userId);

  console.log('✅ All realtime subscriptions started');
}

/**
 * Stop all realtime subscriptions
 */
function stopAllSubscriptions() {
  console.log('🛑 Stopping all realtime subscriptions...');

  // Plans store
  const plansStore = usePlansStore.getState();
  plansStore.stopRealTimeUpdates();

  // Hang store
  const hangStore = useHangStore.getState();
  hangStore.stopRealTimeUpdates();

  // Friends store
  const friendsStore = useFriendsStore.getState();
  friendsStore.stopRealTimeUpdates();

  // Notifications store
  const notificationsStore = useNotificationsStore.getState();
  notificationsStore.stopRealTimeUpdates();

  // Chat store - unsubscribe from all active chats
  const chatStore = useChatStore.getState();
  const chatPlanIds = Object.keys(chatStore.subscriptions || {});
  chatPlanIds.forEach(planId => {
    chatStore.unsubscribeFromChat(planId, { preserveDesired: false });
  });

  // Unseen realtime channel
  stopUnseenRealtimeSubscription();

  console.log('✅ All realtime subscriptions stopped');
}

/**
 * Check and restart any failed subscriptions
 */
function checkAndRestartAllSubscriptions(userId: string) {
  console.log('🔍 Checking all realtime subscriptions...');

  // Plans store - has built-in check method
  const plansStore = usePlansStore.getState();
  plansStore.checkAndRestartSubscriptions(userId);

  // Notifications store - has built-in check method
  const notificationsStore = useNotificationsStore.getState();
  notificationsStore.checkAndRestartSubscription(userId);

  // Unseen counts – re-fetch and restart realtime trigger channel
  useUnseenStore.getState().fetchUnseenCounts();
  startUnseenRealtimeSubscription(userId);

  // Hang store and Friends store don't have dedicated check methods,
  // but their health checks will handle reconnection automatically

  // For chat subscriptions, re-subscribe to desired chats
  // Note: Chat subscriptions are managed per-component, so we don't restart them globally

  console.log('✅ Subscription check completed');
}

/**
 * Force refresh all data (useful after network reconnection)
 */
export async function forceRefreshAllData(userId: string) {
  console.log('🔄 Force refreshing all data...');

  const plansStore = usePlansStore.getState();
  const hangStore = useHangStore.getState();
  const friendsStore = useFriendsStore.getState();
  const notificationsStore = useNotificationsStore.getState();
  const unseenStore = useUnseenStore.getState();

  await Promise.all([
    plansStore.loadPlans(userId),
    hangStore.loadFriends(),
    friendsStore.forceRefresh(),
    notificationsStore.fetchNotifications(userId),
    unseenStore.fetchUnseenCounts(),
  ]);

  console.log('✅ All data refreshed');
}

/**
 * Get current manager status (for debugging)
 */
export function getRealtimeManagerStatus() {
  const plansDebug = usePlansStore.getState().getSubscriptionDebugInfo();
  const notificationsActive = useNotificationsStore.getState().subscriptionActive;
  const chatSubscriptions = Object.keys(useChatStore.getState().subscriptions || {});

  return {
    initialized: isManagerInitialized,
    currentUserId,
    lastForegroundTime: new Date(lastForegroundTime).toISOString(),
    backgroundStartTime: backgroundStartTime > 0 ? new Date(backgroundStartTime).toISOString() : null,
    subscriptions: {
      plans: plansDebug,
      notifications: { active: notificationsActive },
      activeChats: chatSubscriptions.length,
    }
  };
}

