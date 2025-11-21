# 🔔 NOTIFICATION SYSTEM IMPLEMENTATION GUIDE

## Overview
This guide provides complete step-by-step instructions for implementing a production-ready notification system for the Free to Hang app. The system consists of three layers:

1. **In-App Notification Center** - Feed of all notifications within the app
2. **Event-Based Push Notifications** - Real-time alerts for important events
3. **Strategic Engagement (MVP)** - Simple chain effect and re-engagement notifications

---

## 📐 ARCHITECTURE DIAGRAM

```
User Action (e.g., creates plan, sends invite)
    ↓
Backend API / Database Trigger
    ↓
Notification Service
    ├─→ Create DB Record (notifications table)
    ├─→ Trigger Realtime Update (Supabase)
    └─→ Send Push Notification (if user offline)
    ↓
Frontend
    ├─→ Notification Center (shows all)
    ├─→ Badge Counter (unread count)
    └─→ Push Handler (navigation)
```

---

## 🗄️ DATABASE SCHEMA

### 1. Create `notifications` table

```sql
-- Notifications table - stores all user notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Notification type and content
  type TEXT CHECK (type IN (
    'plan_invite',
    'plan_update', 
    'plan_participant_joined',
    'chat_message',
    'poll_created',
    'poll_ended',
    'poll_winner',
    'friend_request',
    'friend_accepted',
    'status_change',
    'engagement_friends_online',
    'engagement_comeback'
  )) NOT NULL,
  
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Navigation data (JSONB for flexibility)
  data JSONB,
  -- Examples:
  -- {"plan_id": "uuid", "screen": "PlanDetail"}
  -- {"user_id": "uuid", "screen": "Profile"}
  -- {"chat_id": "uuid", "plan_id": "uuid", "screen": "Chat"}
  
  -- Read status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Optional: who triggered this notification
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
USING (auth.uid() = user_id);

-- Service role can insert notifications (from backend)
CREATE POLICY "Service role can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);
```

### 2. Create `push_tokens` table

```sql
-- Push tokens table - stores Expo push tokens for each device
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  expo_push_token TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')) NOT NULL,
  
  active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One active token per device
  UNIQUE(user_id, expo_push_token)
);

-- Indexes
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(active) WHERE active = TRUE;

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own push tokens"
ON push_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
ON push_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
ON push_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
ON push_tokens FOR DELETE
USING (auth.uid() = user_id);
```

### 3. Create `notification_preferences` table

```sql
-- Notification preferences - user settings for notifications
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- Push notification toggles
  push_enabled BOOLEAN DEFAULT TRUE,
  
  -- Category toggles
  plan_notifications BOOLEAN DEFAULT TRUE,
  chat_notifications BOOLEAN DEFAULT TRUE,
  friend_notifications BOOLEAN DEFAULT TRUE,
  status_notifications BOOLEAN DEFAULT TRUE,
  engagement_notifications BOOLEAN DEFAULT TRUE,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own notification preferences"
ON notification_preferences FOR ALL
USING (auth.uid() = user_id);

-- Auto-create preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_notification_prefs
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();
```

### 4. Update `user_status` table (add tracking)

```sql
-- Add last_active column to track when user was last active in app
ALTER TABLE user_status 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for engagement queries
CREATE INDEX IF NOT EXISTS idx_user_status_last_active ON user_status(last_active);
```

---

## 📦 INSTALL DEPENDENCIES

### Frontend (React Native)
```bash
npx expo install expo-notifications expo-device
```

### Backend (Node.js)
Already have everything needed:
- `@supabase/supabase-js` ✓
- `express` ✓
- `node-cron` (add this for scheduled notifications)

```bash
cd backend
npm install node-cron
```

---

## 🎨 FRONTEND IMPLEMENTATION

### Step 1: Setup Notifications Tab

**File: `app/(tabs)/_layout.tsx`**

Add new tab between Plans and Profile:

```tsx
import { Bell } from 'lucide-react-native';

// In the Tabs component, add:
<Tabs.Screen
  name="notifications"
  options={{
    title: 'Notifications',
    tabBarIcon: ({ color, size }) => (
      <Bell size={size} color={color} />
    ),
    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
  }}
/>
```

### Step 2: Create Notification Store

**File: `store/notificationsStore.ts`**

```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  read: boolean;
  read_at: string | null;
  triggered_by: string | null;
  created_at: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  subscriptionActive: boolean;

  // Actions
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  startRealTimeUpdates: (userId: string) => void;
  stopRealTimeUpdates: () => void;
  updateUnreadCount: () => void;
}

let notificationsChannel: any = null;

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
        notifications: data || [],
        loading: false 
      });
      
      get().updateUnreadCount();
    } catch (error) {
      console.error('Error fetching notifications:', error);
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

      // Update local state
      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === notificationId
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      }));

      get().updateUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
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

      // Update local state
      set(state => ({
        notifications: state.notifications.map(n => ({
          ...n,
          read: true,
          read_at: new Date().toISOString()
        }))
      }));

      get().updateUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== notificationId)
      }));

      get().updateUnreadCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },

  updateUnreadCount: () => {
    const { notifications } = get();
    const count = notifications.filter(n => !n.read).length;
    set({ unreadCount: count });
  },

  startRealTimeUpdates: (userId: string) => {
    console.log('🔔 Starting notifications real-time updates for user:', userId);

    // Clean up existing subscription
    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel);
    }

    // Subscribe to notifications table
    notificationsChannel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 New notification received:', payload);
          
          // Add new notification to state
          set(state => ({
            notifications: [payload.new as Notification, ...state.notifications]
          }));

          get().updateUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 Notification updated:', payload);
          
          // Update notification in state
          set(state => ({
            notifications: state.notifications.map(n =>
              n.id === payload.new.id ? payload.new as Notification : n
            )
          }));

          get().updateUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 Notification deleted:', payload);
          
          // Remove notification from state
          set(state => ({
            notifications: state.notifications.filter(n => n.id !== payload.old.id)
          }));

          get().updateUnreadCount();
        }
      )
      .subscribe();

    set({ subscriptionActive: true });
  },

  stopRealTimeUpdates: () => {
    console.log('🔔 Stopping notifications real-time updates');
    
    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }

    set({ subscriptionActive: false });
  }
}));

export default useNotificationsStore;
```

### Step 3: Create Notifications Screen

**File: `app/(tabs)/notifications.tsx`**

```tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Bell, 
  Users, 
  Calendar, 
  MessageCircle, 
  CheckCircle2,
  UserPlus,
  TrendingUp,
  X
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import useNotificationsStore from '@/store/notificationsStore';
import { formatDistanceToNow } from '@/utils/time';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    startRealTimeUpdates,
    stopRealTimeUpdates
  } = useNotificationsStore();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id);
      startRealTimeUpdates(user.id);
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [user?.id]);

  const handleNotificationPress = async (notification: any) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    const { data, type } = notification;

    switch (type) {
      case 'plan_invite':
      case 'plan_update':
      case 'plan_participant_joined':
      case 'poll_created':
      case 'poll_ended':
      case 'poll_winner':
        if (data?.plan_id) {
          router.push(`/plans/${data.plan_id}`);
        }
        break;

      case 'chat_message':
        if (data?.plan_id) {
          router.push(`/plans/${data.plan_id}?tab=chat`);
        }
        break;

      case 'friend_request':
      case 'friend_accepted':
        if (data?.user_id) {
          router.push(`/profile/${data.user_id}`);
        } else {
          router.push('/friends');
        }
        break;

      case 'status_change':
        if (data?.user_id) {
          router.push(`/profile/${data.user_id}`);
        }
        break;

      case 'engagement_friends_online':
        router.push('/hang');
        break;

      case 'engagement_comeback':
        router.push('/plans');
        break;

      default:
        console.log('Unknown notification type:', type);
    }
  };

  const handleDelete = (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(notificationId)
        }
      ]
    );
  };

  const handleMarkAllRead = () => {
    if (user?.id) {
      markAllAsRead(user.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconProps = { size: 24, color: '#666' };

    switch (type) {
      case 'plan_invite':
      case 'plan_update':
      case 'plan_participant_joined':
        return <Calendar {...iconProps} />;
      
      case 'chat_message':
        return <MessageCircle {...iconProps} />;
      
      case 'poll_created':
      case 'poll_ended':
      case 'poll_winner':
        return <CheckCircle2 {...iconProps} />;
      
      case 'friend_request':
      case 'friend_accepted':
        return <UserPlus {...iconProps} />;
      
      case 'status_change':
        return <Users {...iconProps} />;
      
      case 'engagement_friends_online':
      case 'engagement_comeback':
        return <TrendingUp {...iconProps} />;
      
      default:
        return <Bell {...iconProps} />;
    }
  };

  const renderNotification = ({ item }: { item: any }) => (
    <View style={[styles.notificationCard, !item.read && styles.unread]}>
      <TouchableOpacity
        style={styles.notificationContent}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconContainer}>
          {getNotificationIcon(item.type)}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>
            {formatDistanceToNow(new Date(item.created_at))}
          </Text>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id)}
      >
        <X size={20} color="#999" />
      </TouchableOpacity>
    </View>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => user?.id && fetchNotifications(user.id)}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>
              You'll see notifications here when something happens
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  markAllRead: {
    color: '#007AFF',
    fontSize: 14
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff'
  },
  unread: {
    backgroundColor: '#f0f8ff'
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2
  },
  textContainer: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000'
  },
  body: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  time: {
    fontSize: 12,
    color: '#999'
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: 8,
    marginTop: 6
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    color: '#333'
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32
  }
});
```

### Step 4: Setup Push Notifications

**File: `utils/pushNotifications.ts`**

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register for push notifications and save token
export async function registerForPushNotifications(userId: string) {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id' // Get this from app.json
    })).data;

    console.log('📱 Push token:', token);

    // Save token to database
    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          expo_push_token: token,
          device_type: Platform.OS,
          active: true,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,expo_push_token'
        });

      if (error) throw error;
      console.log('✅ Push token saved to database');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Handle notification received while app is open
export function useNotificationObserver() {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received while app open:', notification);
      // Show in-app toast or handle differently
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 Notification tapped:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);
}

function handleNotificationNavigation(data: any) {
  // Navigate based on notification data
  // This will be similar to the notification press handler in NotificationsScreen
  // Implementation depends on your routing setup
  console.log('Navigate to:', data);
}

// Update last active timestamp (call this in App component)
export async function updateLastActive(userId: string) {
  try {
    await supabase
      .from('user_status')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error updating last active:', error);
  }
}
```

### Step 5: Integrate into App Layout

**File: `app/_layout.tsx`**

Add this to your root layout:

```tsx
import { useEffect } from 'react';
import { registerForPushNotifications, updateLastActive } from '@/utils/pushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import useNotificationsStore from '@/store/notificationsStore';

export default function RootLayout() {
  const { user } = useAuth();
  const unreadCount = useNotificationsStore(state => state.unreadCount);

  useEffect(() => {
    if (user?.id) {
      // Register for push notifications
      registerForPushNotifications(user.id);

      // Update last active every 5 minutes
      const interval = setInterval(() => {
        updateLastActive(user.id);
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Set badge count
  useEffect(() => {
    Notifications.setBadgeCountAsync(unreadCount);
  }, [unreadCount]);

  // ... rest of your layout
}
```

---

## 🔧 BACKEND IMPLEMENTATION

### Step 1: Create Notification Service

**File: `backend/services/notificationService.js`**

```javascript
const { Expo } = require('expo-server-sdk');
const supabase = global.supabase;

// Create Expo SDK client
const expo = new Expo();

/**
 * Create a notification in the database
 */
async function createNotification({
  userId,
  type,
  title,
  body,
  data = {},
  triggeredBy = null
}) {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data,
        triggered_by: triggeredBy,
        read: false
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Notification created:', notification.id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
}

/**
 * Send push notification to user's devices
 */
async function sendPushNotification({
  userId,
  title,
  body,
  data = {}
}) {
  try {
    // Get user's push tokens
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId)
      .eq('active', true);

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      console.log('ℹ️ No push tokens found for user:', userId);
      return;
    }

    // Check user's notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!prefs || !prefs.push_enabled) {
      console.log('ℹ️ Push notifications disabled for user:', userId);
      return;
    }

    // Check quiet hours
    if (prefs.quiet_hours_enabled) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      
      if (isInQuietHours(currentTime, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        console.log('ℹ️ User in quiet hours, skipping push notification');
        return;
      }
    }

    // Prepare messages
    const messages = tokens
      .map(({ expo_push_token }) => ({
        to: expo_push_token,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high'
      }))
      .filter(message => Expo.isExpoPushToken(message.to));

    // Send in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log('✅ Push notifications sent:', ticketChunk.length);
      } catch (error) {
        console.error('❌ Error sending push notification chunk:', error);
      }
    }

    return tickets;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    throw error;
  }
}

/**
 * Create notification and send push notification
 */
async function notifyUser({
  userId,
  type,
  title,
  body,
  data = {},
  triggeredBy = null,
  sendPush = true
}) {
  try {
    // Create notification in database
    const notification = await createNotification({
      userId,
      type,
      title,
      body,
      data,
      triggeredBy
    });

    // Send push notification if user is offline
    if (sendPush) {
      // Check if user is currently active in app
      const isUserActive = await checkIfUserActive(userId);
      
      if (!isUserActive) {
        await sendPushNotification({
          userId,
          title,
          body,
          data: { ...data, notification_id: notification.id }
        });
      } else {
        console.log('ℹ️ User is active in app, skipping push notification');
      }
    }

    return notification;
  } catch (error) {
    console.error('❌ Error notifying user:', error);
    throw error;
  }
}

/**
 * Check if user is currently active in app (within last 2 minutes)
 */
async function checkIfUserActive(userId) {
  try {
    const { data, error } = await supabase
      .from('user_status')
      .select('last_active')
      .eq('user_id', userId)
      .single();

    if (error || !data) return false;

    const lastActive = new Date(data.last_active);
    const now = new Date();
    const diffMinutes = (now - lastActive) / 1000 / 60;

    return diffMinutes < 2; // Active within last 2 minutes
  } catch (error) {
    console.error('Error checking user active status:', error);
    return false;
  }
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(currentTime, startTime, endTime) {
  if (!startTime || !endTime) return false;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }
  
  // Normal quiet hours (e.g., 12:00 - 14:00)
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Notification templates for different events
 */
const NotificationTemplates = {
  plan_invite: (planTitle, inviterName) => ({
    type: 'plan_invite',
    title: '📨 New Plan Invitation',
    body: `${inviterName} invited you to: ${planTitle}`
  }),

  plan_participant_joined: (planTitle, userName) => ({
    type: 'plan_participant_joined',
    title: '🎉 Someone joined your plan',
    body: `${userName} joined "${planTitle}"`
  }),

  poll_created: (planTitle, pollTitle) => ({
    type: 'poll_created',
    title: '🗳️ New Poll',
    body: `Vote on "${pollTitle}" in ${planTitle}`
  }),

  poll_ended: (planTitle, winnerOption) => ({
    type: 'poll_ended',
    title: '✅ Poll Ended',
    body: `"${winnerOption}" won in ${planTitle}`
  }),

  chat_message: (planTitle, senderName, preview) => ({
    type: 'chat_message',
    title: `💬 ${senderName} in ${planTitle}`,
    body: preview
  }),

  friend_request: (userName) => ({
    type: 'friend_request',
    title: '👋 New Friend Request',
    body: `${userName} wants to be your friend`
  }),

  friend_accepted: (userName) => ({
    type: 'friend_accepted',
    title: '🎉 Friend Request Accepted',
    body: `${userName} accepted your friend request`
  }),

  status_change_online: (userName) => ({
    type: 'status_change',
    title: '🟢 Friend is online',
    body: `${userName} is now free to hang!`
  }),

  engagement_friends_online: (friendNames) => ({
    type: 'engagement_friends_online',
    title: '🔥 Your friends are looking for plans!',
    body: `${friendNames} and others are online right now`
  }),

  engagement_comeback: () => ({
    type: 'engagement_comeback',
    title: '👋 Miss making memories?',
    body: 'Show your friends you\'re free tonight!'
  })
};

module.exports = {
  createNotification,
  sendPushNotification,
  notifyUser,
  checkIfUserActive,
  NotificationTemplates
};
```

### Step 2: Install Expo Server SDK

```bash
cd backend
npm install expo-server-sdk
```

### Step 3: Create Notification Routes

**File: `backend/routes/notifications.js`**

```javascript
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const supabase = global.supabase;

// Get user's notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ notifications: data || [] });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ notification: data });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get notification preferences
router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.json({ preferences: data });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update notification preferences
router.patch('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ preferences: data });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

module.exports = router;
```

### Step 4: Integrate Notifications into Existing Routes

**Update `backend/routes/plans.js`:**

Add notifications when:
- User is invited to plan
- Someone joins plan
- Plan is updated

```javascript
const { notifyUser, NotificationTemplates } = require('../services/notificationService');

// Example: When inviting user to plan
router.post('/:planId/invite', verifyToken, async (req, res) => {
  try {
    const { userId: inviteeId } = req.body;
    const planId = req.params.planId;
    const inviterId = req.user.id;

    // ... existing invite logic ...

    // Get plan and inviter details
    const { data: plan } = await supabase
      .from('plans')
      .select('title')
      .eq('id', planId)
      .single();

    const { data: inviter } = await supabase
      .from('users')
      .select('name')
      .eq('id', inviterId)
      .single();

    // Send notification
    const template = NotificationTemplates.plan_invite(plan.title, inviter.name);
    await notifyUser({
      userId: inviteeId,
      ...template,
      data: { plan_id: planId },
      triggeredBy: inviterId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Similar pattern for other events...
```

**Update `backend/routes/chat.js`:**

Send notification on new message:

```javascript
router.post('/:planId/messages', verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    const planId = req.params.planId;
    const senderId = req.user.id;

    // ... existing message creation ...

    // Get plan participants (except sender)
    const { data: participants } = await supabase
      .from('plan_participants')
      .select('user_id')
      .eq('plan_id', planId)
      .neq('user_id', senderId);

    // Get plan and sender details
    const { data: plan } = await supabase
      .from('plans')
      .select('title')
      .eq('id', planId)
      .single();

    const { data: sender } = await supabase
      .from('users')
      .select('name')
      .eq('id', senderId)
      .single();

    // Send notification to all participants
    const template = NotificationTemplates.chat_message(
      plan.title,
      sender.name,
      content.substring(0, 100)
    );

    for (const participant of participants) {
      await notifyUser({
        userId: participant.user_id,
        ...template,
        data: { plan_id: planId, message_id: message.id },
        triggeredBy: senderId
      });
    }

    res.json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});
```

### Step 5: Create Engagement Service (MVP)

**File: `backend/services/engagementService.js`**

```javascript
const cron = require('node-cron');
const { notifyUser, NotificationTemplates } = require('./notificationService');
const supabase = global.supabase;

/**
 * Chain Effect: When a friend goes online, notify their friends
 */
async function handleFriendStatusChange(userId, isAvailable) {
  if (!isAvailable) return; // Only trigger when going online

  try {
    // Get user's friends
    const { data: friendships } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (!friendships || friendships.length === 0) return;

    // Get friend IDs
    const friendIds = friendships.map(f => 
      f.user_id === userId ? f.friend_id : f.user_id
    );

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    if (!user) return;

    // Check which friends are also online (for the "X friends online" message)
    const { data: onlineFriends } = await supabase
      .from('user_status')
      .select('user_id')
      .in('user_id', friendIds)
      .eq('is_available', true);

    // If multiple friends are online, send enhanced notification
    const onlineCount = (onlineFriends?.length || 0) + 1;

    // Notify each friend
    const template = NotificationTemplates.status_change_online(user.name);
    
    for (const friendId of friendIds) {
      await notifyUser({
        userId: friendId,
        ...template,
        data: { user_id: userId, online_count: onlineCount },
        triggeredBy: userId
      });
    }

    console.log(`✅ Notified ${friendIds.length} friends about ${user.name} going online`);
  } catch (error) {
    console.error('Error handling friend status change:', error);
  }
}

/**
 * Check for inactive users and send comeback notifications
 * Runs daily at 6 PM
 */
function startEngagementScheduler() {
  // Run every day at 6 PM
  cron.schedule('0 18 * * *', async () => {
    console.log('🔔 Running engagement scheduler...');

    try {
      // Find users who haven't been active in 3+ days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: inactiveUsers } = await supabase
        .from('user_status')
        .select('user_id, last_active')
        .lt('last_active', threeDaysAgo.toISOString());

      if (!inactiveUsers || inactiveUsers.length === 0) {
        console.log('ℹ️ No inactive users found');
        return;
      }

      console.log(`📊 Found ${inactiveUsers.length} inactive users`);

      // Check if any of their friends are active
      for (const { user_id } of inactiveUsers) {
        // Get user's friends
        const { data: friendships } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${user_id},friend_id.eq.${user_id}`);

        if (!friendships || friendships.length === 0) continue;

        const friendIds = friendships.map(f => 
          f.user_id === user_id ? f.friend_id : f.user_id
        );

        // Check if any friends have been active recently (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: activeFriends } = await supabase
          .from('user_status')
          .select('user_id')
          .in('user_id', friendIds)
          .gt('last_active', sevenDaysAgo.toISOString());

        // Only send notification if they have active friends
        if (activeFriends && activeFriends.length > 0) {
          const template = NotificationTemplates.engagement_comeback();
          
          await notifyUser({
            userId: user_id,
            ...template,
            data: { 
              type: 'comeback',
              active_friends_count: activeFriends.length 
            }
          });

          console.log(`✅ Sent comeback notification to user ${user_id}`);
        }
      }

      console.log('✅ Engagement scheduler completed');
    } catch (error) {
      console.error('❌ Error in engagement scheduler:', error);
    }
  });

  console.log('✅ Engagement scheduler started (runs daily at 6 PM)');
}

/**
 * Send "friends online" notification
 * This can be called when multiple friends go online in a short period
 */
async function notifyFriendsOnline(userId, onlineFriendIds) {
  try {
    if (onlineFriendIds.length < 2) return; // Need at least 2 friends online

    // Get friend names
    const { data: friends } = await supabase
      .from('users')
      .select('name')
      .in('id', onlineFriendIds.slice(0, 3)); // First 3 names

    if (!friends || friends.length === 0) return;

    const friendNames = friends.map(f => f.name).join(', ');
    const template = NotificationTemplates.engagement_friends_online(friendNames);

    await notifyUser({
      userId,
      ...template,
      data: { 
        friend_ids: onlineFriendIds,
        count: onlineFriendIds.length 
      }
    });

    console.log(`✅ Sent "friends online" notification to user ${userId}`);
  } catch (error) {
    console.error('Error sending friends online notification:', error);
  }
}

module.exports = {
  handleFriendStatusChange,
  startEngagementScheduler,
  notifyFriendsOnline
};
```

### Step 6: Update Backend Index

**File: `backend/index.js`**

Add notification routes and start engagement scheduler:

```javascript
// Import notification routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

// Start engagement scheduler
if (supabase) {
  try {
    const engagementService = require('./services/engagementService');
    engagementService.startEngagementScheduler();
    console.log('✅ Engagement scheduler started');
  } catch (error) {
    console.error('❌ Failed to start engagement scheduler:', error);
  }
}
```

### Step 7: Update Status Change Handler

**File: `backend/routes/user.js`**

Add notification trigger when user status changes:

```javascript
const { handleFriendStatusChange } = require('../services/engagementService');

router.patch('/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_available, activity } = req.body;

    // Update status
    const { data, error } = await supabase
      .from('user_status')
      .update({
        is_available,
        activity,
        last_active: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    // Trigger chain effect notification
    if (is_available) {
      await handleFriendStatusChange(userId, true);
    }

    res.json({ status: data });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
```

---

## 🧪 TESTING CHECKLIST

### Frontend Testing

- [ ] Notifications tab appears in tab bar
- [ ] Badge shows correct unread count
- [ ] Can view list of notifications
- [ ] Can tap notification to navigate to correct screen
- [ ] Can mark notification as read
- [ ] Can mark all as read
- [ ] Can delete notification
- [ ] Pull to refresh works
- [ ] Empty state shows when no notifications
- [ ] Real-time updates work (new notifications appear instantly)

### Push Notifications Testing

- [ ] Push token is registered on app launch
- [ ] Push notifications received when app is closed
- [ ] Push notifications received when app is in background
- [ ] In-app toast shows when notification received while app open
- [ ] Tapping push notification navigates to correct screen
- [ ] Badge count updates correctly

### Backend Testing

- [ ] Can create notification via API
- [ ] Notifications appear in database
- [ ] Push notifications are sent to correct devices
- [ ] Quiet hours respected
- [ ] User preferences respected
- [ ] Chain effect works (friend goes online → notifications sent)
- [ ] Comeback notifications sent after 3 days inactivity

### Integration Testing

Test each notification type:

- [ ] Plan invitation
- [ ] Someone joins plan
- [ ] New poll created
- [ ] Poll ended
- [ ] Chat message
- [ ] Friend request
- [ ] Friend accepted
- [ ] Status change (friend online)
- [ ] Engagement: friends online
- [ ] Engagement: comeback

---

## 📱 APP.JSON CONFIGURATION

Add this to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#000000",
      "androidMode": "default",
      "androidCollapsedTitle": "{{unread_count}} new notifications"
    }
  }
}
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Database Setup

Run the SQL schema in Supabase dashboard:
```bash
# Copy contents of database schema section above
# Paste into Supabase SQL Editor
# Execute
```

### 2. Backend Deployment

```bash
cd backend
npm install expo-server-sdk node-cron
# Commit and deploy to Railway/your hosting
```

### 3. Frontend Deployment

```bash
npx expo install expo-notifications expo-device
# Update app.json with notification config
# Build and deploy
npx expo prebuild
npx expo run:ios  # or run:android
```

---

## 🎯 MVP PRIORITIES

### Phase 1 (Core - Must Have)
1. Database tables ✓
2. Notification Center UI ✓
3. Basic notification creation ✓
4. Real-time updates ✓
5. Mark as read/delete ✓

### Phase 2 (Push Notifications - Important)
1. Push token registration ✓
2. Expo push service ✓
3. Event-based notifications ✓
4. Navigation handling ✓

### Phase 3 (Engagement - Nice to Have)
1. Chain effect (friend online) ✓
2. Comeback notifications ✓
3. Scheduling system ✓

---

## 🔧 TROUBLESHOOTING

### Push notifications not working

1. Check expo project ID in `app.json`
2. Verify push token saved to database
3. Check notification preferences
4. Test with physical device (not simulator)
5. Check Expo dashboard for push receipt errors

### Real-time not updating

1. Check Supabase RLS policies
2. Verify subscription is active
3. Check console for subscription errors
4. Ensure user is authenticated

### Badge count not updating

1. Check iOS permissions
2. Verify badge count API call
3. Check unread count calculation

---

## 📚 RESOURCES

- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ FINAL CHECKLIST

Before marking complete:

- [ ] All database tables created
- [ ] Frontend components implemented
- [ ] Backend services implemented
- [ ] Push notifications working
- [ ] Real-time updates working
- [ ] All notification types tested
- [ ] Chain effect tested
- [ ] Comeback notifications scheduled
- [ ] Badge count working
- [ ] Navigation working
- [ ] User preferences working
- [ ] Deployed to production

---

## 🎉 SUCCESS METRICS

After implementation, you should have:

1. ✅ Full in-app notification center
2. ✅ Real-time notification updates
3. ✅ Push notifications for all key events
4. ✅ Chain effect when friends go online
5. ✅ Re-engagement notifications
6. ✅ Badge counts
7. ✅ User preferences
8. ✅ Production-ready system

---

**Good luck with the implementation! 🚀**

