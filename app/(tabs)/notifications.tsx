import React, { useEffect, useMemo } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  Calendar,
  CheckCircle2,
  MessageCircle,
  TrendingUp,
  UserPlus,
  Users,
  X
} from 'lucide-react-native';
import useNotificationsStore from '@/store/notificationsStore';
import { useAuth } from '@/contexts/AuthContext';
import { formatTimeAgo } from '@/utils/time';

const iconForType = (type: string, color: string) => {
  switch (type) {
    case 'plan_invite':
    case 'plan_update':
    case 'plan_participant_joined':
      return <Calendar size={22} color={color} />;
    case 'chat_message':
      return <MessageCircle size={22} color={color} />;
    case 'poll_created':
    case 'poll_ended':
    case 'poll_winner':
      return <CheckCircle2 size={22} color={color} />;
    case 'friend_request':
    case 'friend_accepted':
      return <UserPlus size={22} color={color} />;
    case 'status_change':
      return <Users size={22} color={color} />;
    case 'engagement_friends_online':
    case 'engagement_comeback':
      return <TrendingUp size={22} color={color} />;
    default:
      return <Bell size={22} color={color} />;
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
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
  }, [user?.id, fetchNotifications, startRealTimeUpdates, stopRealTimeUpdates]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const handleNotificationNavigation = (notification: any) => {
    const { type, data } = notification;
    if (!data) return;

    if (
      [
        'plan_invite',
        'plan_update',
        'plan_participant_joined',
        'poll_created',
        'poll_ended',
        'poll_winner'
      ].includes(type)
    ) {
      if (data.plan_id) {
        router.push({
          pathname: '/plans',
          params: { highlightPlan: data.plan_id, tab: 'plan' }
        });
      } else {
        router.push('/plans');
      }
      return;
    }

    if (type === 'chat_message' && data.plan_id) {
      router.push({
        pathname: '/plans',
        params: { highlightPlan: data.plan_id, tab: 'plan' }
      });
      return;
    }

    if (type === 'friend_request' || type === 'friend_accepted') {
      router.push('/profile');
      return;
    }

    if (type === 'status_change' || type === 'engagement_friends_online') {
      router.push('/');
      return;
    }

    if (type === 'engagement_comeback') {
      router.push('/plans');
      return;
    }
  };

  const handlePress = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    handleNotificationNavigation(notification);
  };

  const handleDelete = (notificationId: string) => {
    Alert.alert(
      'Delete notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(notificationId) }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, !item.read && styles.unreadCard]}>
      <TouchableOpacity style={styles.cardContent} onPress={() => handlePress(item)}>
        <View style={styles.iconContainer}>{iconForType(item.type, '#4a5568')}</View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
        <X size={18} color="#9ca3af" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => user?.id && markAllAsRead(user.id)}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => user?.id && fetchNotifications(user.id)}
          />
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={48} color="#cbd5f5" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              You will see plan invites, chat updates and friend activity here.
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827'
  },
  markAll: {
    color: '#2563eb',
    fontWeight: '600'
  },
  card: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff'
  },
  unreadCard: {
    backgroundColor: '#f8fbff'
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row'
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 4
  },
  textContainer: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4
  },
  body: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 6
  },
  time: {
    fontSize: 12,
    color: '#9ca3af'
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    marginLeft: 8,
    marginTop: 8
  },
  deleteButton: {
    justifyContent: 'center',
    paddingLeft: 16
  },
  emptyList: {
    flexGrow: 1
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16
  },
  emptyBody: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8
  }
});

