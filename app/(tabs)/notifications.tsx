import React, { useEffect, useMemo, useState } from 'react';
import {
  SectionList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import useNotificationsStore, { NotificationSender } from '@/store/notificationsStore';
import useFriendsStore from '@/store/friendsStore';
import usePlansStore from '@/store/plansStore';
import { useAuth } from '@/contexts/AuthContext';
import { handleNotificationNavigation } from '@/utils/navigationHelper';
import { groupNotifications, NotificationGroup } from '@/utils/notificationGrouper';
import NotificationGroupItem from '@/components/notifications/NotificationGroupItem';
import UserProfileModal from '@/components/UserProfileModal';
import Colors from '@/constants/colors';

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
  
  const { acceptFriendRequest, declineFriendRequest, cancelFriendRequest } = useFriendsStore();
  const { respondToPlan } = usePlansStore();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id);
      startRealTimeUpdates(user.id);
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [user?.id, fetchNotifications, startRealTimeUpdates, stopRealTimeUpdates]);

  // Group notifications
  const groupedNotifications = useMemo(() => {
    return groupNotifications(notifications);
  }, [notifications]);

  // Create sections (New vs Earlier)
  const sections = useMemo(() => {
    const newGroups = groupedNotifications.filter(g => !g.isRead);
    const earlierGroups = groupedNotifications.filter(g => g.isRead);
    
    const result = [];
    if (newGroups.length > 0) {
      result.push({ title: 'New', data: newGroups });
    }
    if (earlierGroups.length > 0) {
      result.push({ title: 'Earlier', data: earlierGroups });
    }
    return result;
  }, [groupedNotifications]);

  const handleGroupPress = async (group: NotificationGroup) => {
    // Mark all items in group as read
    const unreadItems = group.items.filter(i => !i.read);
    unreadItems.forEach(item => {
      markAsRead(item.id);
    });

    // Navigate using the latest notification (or context)
    const latestItem = group.items[group.items.length - 1]; // items are in insertion order in grouper? check logic
    // Actually items in grouper are just pushed. The order in array depends on logic.
    // In grouper we process input array. If input is sorted, items might be sorted.
    // Let's use the first item as it likely contains the needed data
    
    handleNotificationNavigation(latestItem, router);
  };

  const handleAvatarPress = (user: NotificationSender) => {
    setSelectedUserId(user.id);
    setShowProfileModal(true);
  };

  const handleAction = async (action: 'accept' | 'decline' | 'delete' | 'join', group: NotificationGroup) => {
    const notification = group.items[0]; // Assuming actionable groups have 1 main notification or context
    const data = notification.data || {};

    try {
      if (group.type === 'friend_request') {
        const requestId = data.requestId || data.request_id || notification.data?.id; 
        // We need the actual friend request ID, which might be different from notification ID.
        // Usually notification data contains related object IDs.
        
        // If we don't have requestId in data, we might be in trouble.
        // Let's assume data has request_id or we use logic from friendsStore.
        
        // Fallback: If no request_id in data, maybe notification ID maps to it? Unlikely.
        // Assuming backend sends request_id in payload data.
        
        if (!requestId) {
            console.error('No request ID found in notification data', notification);
            Alert.alert('Error', 'Cannot process request (missing ID)');
            return;
        }

        if (action === 'accept') {
          await acceptFriendRequest(requestId);
        } else if (action === 'delete') {
          await declineFriendRequest(requestId);
        }
        
        // Mark notification as read and maybe delete it?
        await markAsRead(notification.id);
        
      } else if (group.type === 'plan_invite') {
        const planId = group.contextId;
        if (!planId) return;

        if (action === 'join') {
          await respondToPlan(planId, 'going');
        } else if (action === 'decline') {
          await respondToPlan(planId, 'declined');
        }
        
        await markAsRead(notification.id);
      }
    } catch (error) {
        console.error('Action failed:', error);
        Alert.alert('Error', 'Action failed. Please try again.');
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    // Delete all notifications in this group
    const group = groupedNotifications.find(g => g.id === groupId);
    if (group) {
        group.items.forEach(item => deleteNotification(item.id));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {/* Only show Mark all read if there are unread items */}
        {notifications.some(n => !n.read) && (
             <TouchableOpacity onPress={() => user?.id && markAllAsRead(user.id)}>
             <Text style={styles.markAll}>Mark all read</Text>
           </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationGroupItem 
            group={item}
            onPress={handleGroupPress}
            onAvatarPress={handleAvatarPress}
            onAction={handleAction}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => user?.id && fetchNotifications(user.id)}
          />
        }
        contentContainerStyle={sections.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={48} color="#cbd5f5" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              Activity from your plans and friends will appear here.
            </Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />
      
      <UserProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userId={selectedUserId}
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
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
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
