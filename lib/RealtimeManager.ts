import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Realtime mode configuration
export const RT_MODE = process.env.EXPO_PUBLIC_RT_MODE ?? 'plans-only';
console.log(`🚀 realtime mode: ${RT_MODE}`);

// Helper function to check if we're in plans-only mode
export const isPlansOnly = (): boolean => {
  return RT_MODE === 'plans-only';
};

type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
type ResubscribeableStatus = 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

interface ChannelInfo {
  channel: RealtimeChannel | null;
  name: string;
  lastStatus: ChannelStatus | null;
  lastStatusTime: number;
  isSubscribed: boolean;
  // Storm guard fields
  attempts: number;
  coolOffUntil: number | null;
  activeTimer: ReturnType<typeof setTimeout> | null;
}

interface EventHandler {
  eventName: string;
  handler: (payload: any) => void;
  context?: string; // e.g., 'plansStore', 'friendsStore'
}

class RealtimeManager {
  private static instance: RealtimeManager;
  private channels: Map<string, ChannelInfo> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();

  // Session state
  private currentUserId: string | null = null;
  private startedToken: number | null = null;
  private isStarted = false;

  // Initialization guards
  private friendsInitialized = false;
  private plansInitialized = false;


  // Configuration
  private readonly MAX_RESUB_ATTEMPTS = 3; // Storm guard: hard cap for resubscribe attempts
  private readonly COOL_OFF_MS = 30_000; // Storm guard: 30s cool-off period (reduced)
  private readonly INITIAL_BACKOFF_MS = 2000; // Increased initial backoff
  private readonly MAX_BACKOFF_MS = 30000;
  private readonly STATUS_LOG_THROTTLE_MS = 5000; // Throttle repeating status logs
  private readonly RESUB_LOG_THROTTLE_MS = 15000; // Throttle resubscribe logs (increased)
  private statusLogCache: Map<string, number> = new Map();
  private resubLogCache: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * Start realtime subscriptions for a user session (idempotent)
   */
  start(userId: string): void {
    // Idempotency check: already started for same user
    if (this.isStarted && this.currentUserId === userId) {
      console.log('🔁 RealtimeManager.start skipped (already started for user)', userId);
      return;
    }

    // If started for different user, stop first
    if (this.isStarted && this.currentUserId !== userId) {
      this.stop();
    }

    // Set session state
    this.currentUserId = userId;
    this.isStarted = true;
    this.startedToken = Date.now();

    console.log(`🚀 RealtimeManager started for ${userId} (token=${this.startedToken})`);

    // Start channel subscriptions based on mode
    if (isPlansOnly()) {
      // Plans-only mode: only start plans_list channel
      this.startPlansOnlyChannels();
    } else {
      // Full mode: start all channels
      this.startPlansChannels();
      this.startFriendsChannels();
    }

    // Emit started event to notify stores
    this.emitEvent('realtime_started', { userId });
  }

  /**
   * Stop all realtime subscriptions (comprehensive cleanup)
   */
  stop(): void {
    if (!this.isStarted) {
      console.log('⛔ stop skipped (not started)');
      return;
    }

    console.log('🛑 Stopping RealtimeManager...');

    // Cancel ALL pending resub timers and clear channel registry
    this.channels.forEach((channelInfo, channelKey) => {
      // Clear any active storm guard timers
      if (channelInfo.activeTimer) {
        clearTimeout(channelInfo.activeTimer);
        channelInfo.activeTimer = null;
      }

      // Remove channel from supabase client if it exists
      if (channelInfo.channel) {
        try {
          supabase.removeChannel(channelInfo.channel);
        } catch (error) {
          console.error(`❌ Error removing channel ${channelKey} during stop:`, error);
        }
        channelInfo.channel = null;
      }
    });

    // Clear all registries
    this.channels.clear();
    this.eventHandlers.clear();
    this.statusLogCache.clear();
    this.resubLogCache.clear();

    // Reset session state
    this.isStarted = false;
    this.currentUserId = null;
    this.startedToken = null;

    // Reset initialization flags
    this.friendsInitialized = false;
    this.plansInitialized = false;

    console.log('🛑 RealtimeManager fully stopped and cleared');
  }

  /**
   * Register event handler
   */
  on(eventName: string, handler: (payload: any) => void, context?: string): void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }

    this.eventHandlers.get(eventName)!.push({
      eventName,
      handler,
      context
    });

    console.log(`📡 Registered handler for event: ${eventName}${context ? ` (${context})` : ''}`);
  }

  /**
   * Remove event handler
   */
  off(eventName: string, handler: (payload: any) => void): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        console.log(`📡 Removed handler for event: ${eventName}`);
      }
    }
  }

  /**
   * Emit event to all registered handlers
   */
  private emitEvent(eventName: string, payload: any): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers && handlers.length > 0) {
      handlers.forEach(handler => {
        try {
          handler.handler(payload);
        } catch (error) {
          console.error(`❌ Error in ${eventName} handler${handler.context ? ` (${handler.context})` : ''}:`, error);
        }
      });
    }
  }

  private startPlansOnlyChannels(): void {
    if (!this.currentUserId) return;

    // Hard guard: if already started and initialized, skip
    if (this.isStarted && this.plansInitialized) {
      console.log('🔁 startPlansOnlyChannels skipped (already initialized)');
      return;
    }

    // This function must never be called from error handlers
    if (!this.isStarted) {
      console.error('❌ startPlansOnlyChannels called while manager not started!');
      return;
    }

    console.log('📋 Starting plans-only realtime channels...');
    this.plansInitialized = true;

    // TEMPORARILY DISABLED: plans_list channel causing spam
    // TODO: Re-enable once channel stability issues are resolved
    console.log('🚫 plans_list channel temporarily disabled to prevent spam');
    /*
    // Only create the plans_list channel
    const plansOnlyChannelKeys = ['plans_list'];
    for (const channelKey of plansOnlyChannelKeys) {
      const config = this.getChannelConfig(channelKey);
      if (config) {
        this.createChannel({
          key: channelKey,
          name: `${channelKey}_channel_${this.currentUserId}_${Date.now()}`,
          config: config.config,
          eventName: config.eventName
        });
      }
    }
    */
  }

  private startPlansChannels(): void {
    if (!this.currentUserId) return;

    // Hard guard: if already started and initialized, skip with single log
    if (this.isStarted && this.plansInitialized) {
      console.log('🔁 startPlansChannels skipped (already initialized)');
      return;
    }

    // This function must never be called from error handlers
    // It should only be called from RealtimeManager.start()
    if (!this.isStarted) {
      console.error('❌ startPlansChannels called while manager not started!');
      return;
    }

    console.log('📋 Starting plans realtime channels...');
    this.plansInitialized = true;

    // Create plans channels based on mode
    const plansChannelKeys = isPlansOnly()
      ? [] // Plans-only mode: no additional channels needed (only plans_list from startPlansOnlyChannels)
      : ['plans', 'plan_updates', 'participants', 'polls', 'poll_votes', 'attendance'];

    for (const channelKey of plansChannelKeys) {
      const config = this.getChannelConfig(channelKey);
      if (config) {
        this.createChannel({
          key: channelKey,
          name: `${channelKey}_channel_${this.currentUserId}_${Date.now()}`,
          config: config.config,
          eventName: config.eventName
        });
      }
    }
  }

  private startFriendsChannels(): void {
    if (!this.currentUserId) return;

    // Hard guard: if already started and initialized, skip with single log
    if (this.isStarted && this.friendsInitialized) {
      console.log('🔁 startFriendsChannels skipped (already initialized)');
      return;
    }

    // This function must never be called from error handlers
    // It should only be called from RealtimeManager.start()
    if (!this.isStarted) {
      console.error('❌ startFriendsChannels called while manager not started!');
      return;
    }

    console.log('👥 Starting friends realtime channels...');
    this.friendsInitialized = true;

    // Create friends channels based on mode
    const friendsChannelKeys = isPlansOnly()
      ? [] // Plans-only mode: no friends channels
      : ['friend_requests_outgoing', 'friend_requests_incoming', 'friend_requests_delete'];

    for (const channelKey of friendsChannelKeys) {
      const config = this.getChannelConfig(channelKey);
      if (config) {
        this.createChannel({
          key: channelKey,
          name: `${channelKey}_${this.currentUserId}_${Date.now()}`,
          config: config.config,
          eventName: config.eventName
        });
      }
    }
  }

  private createChannel({
    key,
    name,
    config,
    eventName
  }: {
    key: string;
    name: string;
    config: any;
    eventName: string;
  }): void {
    // Prevent duplicate channel creation by name
    if (this.channels.has(key)) {
      const existingChannel = this.channels.get(key)!;
      if (existingChannel.channel && existingChannel.lastStatus !== 'CLOSED') {
        console.log(`🧱 createChannel skipped - already active: ${key}`);
        return;
      }

      // Clean up any existing channel/timer for this key
      if (existingChannel.activeTimer) {
        clearTimeout(existingChannel.activeTimer);
        existingChannel.activeTimer = null;
      }

      // Remove old channel if it exists
      if (existingChannel.channel) {
        try {
          supabase.removeChannel(existingChannel.channel);
        } catch (error) {
          console.error(`❌ Error removing old channel ${key}:`, error);
        }
        existingChannel.channel = null;
      }
    }

    console.log(`📡 Creating channel: ${key} (${name})`);

    const channel = supabase.channel(name);

    // Set up event handler
    channel.on('postgres_changes', config, (payload) => {
      this.handleRealtimeEvent(eventName, payload);
    });

    // Set up status handler
    channel.subscribe((status) => {
      this.handleChannelStatus(key, status);
    });

    // Store channel info
    this.channels.set(key, {
      channel,
      name,
      lastStatus: null,
      lastStatusTime: Date.now(),
      isSubscribed: false,
      // Storm guard fields
      attempts: 0,
      coolOffUntil: null,
      activeTimer: null
    });
  }

  private handleRealtimeEvent(eventName: string, payload: any): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers && handlers.length > 0) {
      handlers.forEach(handler => {
        try {
          handler.handler(payload);
        } catch (error) {
          console.error(`❌ Error in ${eventName} handler${handler.context ? ` (${handler.context})` : ''}:`, error);
        }
      });
    }
  }

  private handleChannelStatus(channelKey: string, status: ChannelStatus): void {
    const channelInfo = this.channels.get(channelKey);
    if (!channelInfo) return;

    channelInfo.lastStatus = status;
    channelInfo.lastStatusTime = Date.now();

    // Throttle status logs
    const cacheKey = `${channelKey}:${status}`;
    const now = Date.now();
    const lastLogTime = this.statusLogCache.get(cacheKey) || 0;

    // Only log important status changes to reduce spam
    const importantStatuses = ['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'];
    if (importantStatuses.includes(status) && now - lastLogTime > this.STATUS_LOG_THROTTLE_MS) {
      // Use specific format for plans_list channel
      if (channelKey === 'plans_list') {
        console.log(`📡 plans_list status: ${status}`);
      } else {
        console.log(`📡 Channel ${channelKey} status: ${status}`);
      }
      this.statusLogCache.set(cacheKey, now);
    }

    if (status === 'SUBSCRIBED') {
      channelInfo.isSubscribed = true;
      // Reset attempts and cool-off on successful subscription
      channelInfo.attempts = 0;
      channelInfo.coolOffUntil = null;

      // Only log successful subscription for important channels
      if (channelKey === 'plans_list') {
        const subscribedKey = `${channelKey}:subscribed`;
        const lastSubscribedLog = this.resubLogCache.get(subscribedKey) || 0;
        if (Date.now() - lastSubscribedLog > this.RESUB_LOG_THROTTLE_MS) {
          console.log(`✅ ${channelKey} SUBSCRIBED (attempts reset)`);
          this.resubLogCache.set(subscribedKey, Date.now());
        }
      }
    } else if (this.isResubscribeableStatus(status)) {
      channelInfo.isSubscribed = false;

      // Check if still in cool-off period
      if (channelInfo.coolOffUntil && now < channelInfo.coolOffUntil) {
        const coolOffKey = `${channelKey}:cooling_off`;
        const lastCoolOffLog = this.resubLogCache.get(coolOffKey) || 0;
        if (now - lastCoolOffLog > this.RESUB_LOG_THROTTLE_MS) {
          console.log(`⏸ cooling off ${channelKey} until ${new Date(channelInfo.coolOffUntil).toISOString()}`);
          this.resubLogCache.set(coolOffKey, now);
        }
        return;
      }

      // Check if max attempts reached
      if (channelInfo.attempts >= this.MAX_RESUB_ATTEMPTS) {
        // Enter cool-off mode
        channelInfo.coolOffUntil = now + this.COOL_OFF_MS;

        // Clear any pending timer
        if (channelInfo.activeTimer) {
          clearTimeout(channelInfo.activeTimer);
          channelInfo.activeTimer = null;
        }

        // Remove old channel before giving up
        if (channelInfo.channel) {
          try {
            supabase.removeChannel(channelInfo.channel);
          } catch (error) {
            console.error(`❌ Error removing channel ${channelKey} during cool-off:`, error);
          }
          channelInfo.channel = null;
        }

        const maxAttemptsKey = `${channelKey}:max_attempts`;
        const lastMaxAttemptsLog = this.resubLogCache.get(maxAttemptsKey) || 0;
        if (now - lastMaxAttemptsLog > this.RESUB_LOG_THROTTLE_MS) {
          console.log(`🧊 max attempts, cooling off ${channelKey}`);
          this.resubLogCache.set(maxAttemptsKey, now);
        }
        return;
      }

      // Schedule single recreate attempt with small backoff (1000ms)
      if (channelInfo.activeTimer) {
        clearTimeout(channelInfo.activeTimer);
      }

      channelInfo.attempts += 1;
      const resubAttemptKey = `${channelKey}:resub_attempt_${channelInfo.attempts}`;
      const lastResubAttemptLog = this.resubLogCache.get(resubAttemptKey) || 0;
      if (now - lastResubAttemptLog > this.RESUB_LOG_THROTTLE_MS) {
        console.log(`⏰ resub attempt ${channelInfo.attempts} for ${channelKey}`);
        this.resubLogCache.set(resubAttemptKey, now);
      }

      channelInfo.activeTimer = setTimeout(async () => {
        // Remove old channel before recreate
        if (channelInfo.channel) {
          const removeChannelKey = `${channelKey}:remove_channel`;
          const lastRemoveChannelLog = this.resubLogCache.get(removeChannelKey) || 0;
          if (now - lastRemoveChannelLog > this.RESUB_LOG_THROTTLE_MS) {
            console.log(`🧹 removing old channel before recreate ${channelKey}`);
            this.resubLogCache.set(removeChannelKey, now);
          }
          try {
            supabase.removeChannel(channelInfo.channel);
          } catch (error) {
            console.error(`❌ Error removing channel ${channelKey} during recreate:`, error);
          }
          channelInfo.channel = null;
        }

        // Recreate ONLY this specific channel (never call global initializers!)
        await this.recreateChannel(channelKey);
        channelInfo.activeTimer = null;
      }, this.INITIAL_BACKOFF_MS);
    }
  }

  private isResubscribeableStatus(status: ChannelStatus): status is ResubscribeableStatus {
    return ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status);
  }

  /**
   * Recreate a single failed channel
   * IMPORTANT: This should NEVER call startPlansChannels(), startFriendsChannels(), or any global initializers
   * It should ONLY recreate the specific channel that failed
   */
  private async recreateChannel(channelKey: string): Promise<void> {
    if (!this.isStarted || !this.currentUserId) {
      console.log(`🛑 Skipping recreate for ${channelKey} - manager stopped`);
      return;
    }

    // Get channel configuration for this specific channel
    const config = this.getChannelConfig(channelKey);
    if (!config) {
      console.error(`❌ No configuration found for channel: ${channelKey}`);
      return;
    }

    const recreateKey = `${channelKey}:recreate_channel`;
    const lastRecreateLog = this.resubLogCache.get(recreateKey) || 0;
    if (Date.now() - lastRecreateLog > this.RESUB_LOG_THROTTLE_MS) {
      console.log(`🔄 Recreating single channel: ${channelKey} (${config.eventName})`);
      this.resubLogCache.set(recreateKey, Date.now());
    }

    // Remove old channel from map if it exists
    const existingInfo = this.channels.get(channelKey);
    if (existingInfo?.channel) {
      try {
        supabase.removeChannel(existingInfo.channel);
      } catch (error) {
        console.error(`❌ Error removing old channel ${channelKey}:`, error);
      }
    }

    // Create fresh channel with new name (to avoid conflicts)
    const channelName = `${channelKey}_${this.currentUserId}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Set up event handler
    channel.on('postgres_changes', config.config, (payload) => {
      this.handleRealtimeEvent(config.eventName, payload);
    });

    // Set up status handler
    channel.subscribe((status) => {
      this.handleChannelStatus(channelKey, status);
    });

    // Store channel info with reset state
    this.channels.set(channelKey, {
      channel,
      name: channelName,
      lastStatus: null,
      lastStatusTime: Date.now(),
      isSubscribed: false,
      // Reset storm guard fields for fresh channel
      attempts: 0,
      coolOffUntil: null,
      activeTimer: null
    });
  }

  /**
   * Get configuration for a specific channel
   * IMPORTANT: This should NEVER be called from error handlers or resubscribe paths
   * It should only be used during initial channel creation in start*Channels methods
   */
  private getChannelConfig(channelKey: string): { config: any; eventName: string } | null {
    const userId = this.currentUserId!;
    const configs: Record<string, { config: any; eventName: string }> = {
      'plans_list': {
        config: {
          event: 'INSERT',
          schema: 'public',
          table: 'plans'
        },
        eventName: 'plans_list'
      },
      'plans': {
        config: {
          event: '*',
          schema: 'public',
          table: 'plans'
        },
        eventName: 'plans'
      },
      'plan_updates': {
        config: {
          event: '*',
          schema: 'public',
          table: 'plan_updates'
        },
        eventName: 'plan_updates'
      },
      'participants': {
        config: {
          event: '*',
          schema: 'public',
          table: 'plan_participants'
        },
        eventName: 'participants'
      },
      'polls': {
        config: {
          event: '*',
          schema: 'public',
          table: 'plan_polls'
        },
        eventName: 'polls'
      },
      'poll_votes': {
        config: {
          event: '*',
          schema: 'public',
          table: 'plan_poll_votes'
        },
        eventName: 'poll_votes'
      },
      'attendance': {
        config: {
          event: '*',
          schema: 'public',
          table: 'plan_attendance'
        },
        eventName: 'attendance'
      },
      'friend_requests_outgoing': {
        config: {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${userId}`
        },
        eventName: 'friend_requests'
      },
      'friend_requests_incoming': {
        config: {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${userId}`
        },
        eventName: 'friend_requests'
      },
      'friend_requests_delete': {
        config: {
          event: 'DELETE',
          schema: 'public',
          table: 'friend_requests'
        },
        eventName: 'friend_requests_delete'
      }
    };

    return configs[channelKey] || null;
  }



  private stopChannel(channelKey: string): void {
    const channelInfo = this.channels.get(channelKey);
    if (!channelInfo) return;

    // Clear any active timer
    if (channelInfo.activeTimer) {
      clearTimeout(channelInfo.activeTimer);
      channelInfo.activeTimer = null;
    }

    // Remove channel if it exists
    if (channelInfo.channel) {
      try {
        supabase.removeChannel(channelInfo.channel);
        console.log(`🛑 Stopped channel: ${channelKey}`);
      } catch (error) {
        console.error(`❌ Error stopping channel ${channelKey}:`, error);
      }
    }

    this.channels.delete(channelKey);
  }

  /**
   * Get current connection status
   */
  getStatus(): {
    isStarted: boolean;
    currentUserId: string | null;
    startedToken: number | null;
    channels: Record<string, { isSubscribed: boolean; lastStatus: string | null }>;
  } {
    const channels: Record<string, { isSubscribed: boolean; lastStatus: string | null }> = {};

    this.channels.forEach((info, key) => {
      channels[key] = {
        isSubscribed: info.isSubscribed,
        lastStatus: info.lastStatus
      };
    });

    return {
      isStarted: this.isStarted,
      currentUserId: this.currentUserId,
      startedToken: this.startedToken,
      channels
    };
  }
}

// Export singleton instance
export const realtimeManager = RealtimeManager.getInstance();
