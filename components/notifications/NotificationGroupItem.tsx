import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NotificationGroup } from '@/utils/notificationGrouper';
import NotificationAvatarStack from './NotificationAvatarStack';
import { formatTimeAgo } from '@/utils/time';
import { NotificationSender } from '@/store/notificationsStore';
import useFriendsStore from '@/store/friendsStore';
import usePlansStore from '@/store/plansStore';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  group: NotificationGroup;
  onPress: (group: NotificationGroup) => void;
  onAvatarPress: (user: NotificationSender) => void;
  onAction?: (action: 'accept' | 'decline' | 'delete' | 'join', group: NotificationGroup) => void;
}

type ActionStatus = 'pending' | 'accepted' | 'declined' | 'joined' | 'deleted' | null;

export default function NotificationGroupItem({ group, onPress, onAvatarPress, onAction }: Props) {
  const isActionable = group.type === 'friend_request' || group.type === 'plan_invite';
  const isUnread = !group.isRead;
  
  // Store hooks for real-time status checking
  const { friends, incomingRequests } = useFriendsStore();
  const { plans } = usePlansStore();
  const { user } = useAuth();

  // Local state for immediate UI feedback
  const [status, setStatus] = useState<ActionStatus>('pending');

  // Sync with global store state
  useEffect(() => {
    if (!isActionable) return;

    const notification = group.items[0];
    const data = notification?.data || {};

    if (group.type === 'friend_request') {
      // Check friend request status
      const requestId = data.requestId || data.request_id || notification.data?.id;
      // Also check by sender ID as fallback/confirmation
      const senderId = group.actors[0]?.id;

      // Check if user is already a friend (using friend_id from store)
      const isAlreadyFriend = senderId && friends.some(f => f.friend_id === senderId);
      
      // Check if request is still incoming
      const hasIncomingRequest = requestId 
        ? incomingRequests.some(r => r.request_id === requestId || r.id === requestId)
        : (senderId && incomingRequests.some(r => r.sender_id === senderId));

      if (isAlreadyFriend) {
        setStatus('accepted');
      } else if (!hasIncomingRequest) {
        // If not a friend and no incoming request, assume handled (declined/deleted)
        // But only change if we are currently pending to avoid overriding optimistic updates inappropriately
        // However, if we load the component and it's already handled, we want to show that.
        // We'll trust the store: if not friend and not incoming -> handled.
        // We default to 'declined' or generic handled state if we don't know exactly what happened,
        // but since 'pending' shows buttons, we want to move away from it.
        if (status === 'pending') {
             // If we just loaded and data is ready, set to declined/deleted
             setStatus('declined'); 
        }
      } else {
        setStatus('pending');
      }

    } else if (group.type === 'plan_invite') {
      const planId = group.contextId;
      if (planId && plans[planId]) {
        const plan = plans[planId];
        const myParticipant = plan.participants.find(p => p.id === 'current' || p.id === user?.id);
        
        if (myParticipant) {
          if (myParticipant.status === 'going') setStatus('joined');
          else if (myParticipant.status === 'declined') setStatus('declined');
          else if (myParticipant.status === 'pending') setStatus('pending');
          // For maybe/conditional we might still want to show buttons or a specific status, 
          // but for now let's treat them as pending or create new statuses if needed.
          // The prompt specifically mentioned "Join" -> "going".
        }
      }
    }
  }, [group, friends, incomingRequests, plans, isActionable, user?.id]);

  const handleAction = (action: 'accept' | 'decline' | 'delete' | 'join') => {
    if ((action === 'decline' || action === 'delete') && onAction) {
      Alert.alert(
        'Are you sure?',
        action === 'decline' 
          ? 'Are you sure you want to decline this invitation? You might not be able to join later.'
          : 'Are you sure you want to delete this request?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: action === 'decline' ? 'Decline' : 'Delete', 
            style: 'destructive', 
            onPress: () => {
              // Optimistic update
              setStatus(action === 'decline' ? 'declined' : 'deleted');
              onAction(action, group);
            }
          }
        ]
      );
    } else if (onAction) {
      // Optimistic update
      if (action === 'accept') setStatus('accepted');
      if (action === 'join') setStatus('joined');
      onAction(action, group);
    }
  };

  // Advanced parser for bold text (**text**) and newlines
  const renderText = (text: string) => {
    // Split by newline first to handle lines
    const lines = text.split('\n');
    
    return (
      <View>
        {lines.map((line, lineIndex) => {
          // Split by bold markers
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <Text key={lineIndex} style={styles.bodyText} numberOfLines={2}>
              {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <Text key={index} style={styles.boldText}>
                      {part.slice(2, -2)}
                    </Text>
                  );
                }
                return <Text key={index}>{part}</Text>;
              })}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderStatusText = () => {
    let text = '';
    let color = '#6b7280'; // gray-500

    switch (status) {
      case 'accepted':
        text = 'Friend request accepted';
        color = '#059669'; // green-600
        break;
      case 'joined':
        text = 'Status set to "going"';
        color = '#059669'; // green-600
        break;
      case 'declined':
        text = 'Invitation declined';
        break;
      case 'deleted':
        text = 'Request removed';
        break;
      default:
        return null;
    }

    return (
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color }]}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, isUnread && styles.unreadContainer]}>
      {/* Avatar Section */}
      <View style={styles.leftContainer}>
        <NotificationAvatarStack 
          actors={group.actors} 
          type={group.type} 
          onPress={onAvatarPress}
        />
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        <TouchableOpacity 
          style={styles.textContainer} 
          onPress={() => onPress(group)}
          activeOpacity={0.7}
        >
          {renderText(group.title)}
          <Text style={styles.timeText}>{formatTimeAgo(group.lastCreated)}</Text>
        </TouchableOpacity>

        {/* Actions Section */}
        {isActionable && (
          <View style={styles.actionsWrapper}>
            {status === 'pending' ? (
              <View style={styles.actionsContainer}>
                {group.type === 'friend_request' ? (
                  <>
                    <TouchableOpacity 
                      style={[styles.button, styles.primaryButton]} 
                      onPress={() => handleAction('accept')}
                    >
                      <Text style={styles.primaryButtonText}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.button, styles.secondaryButton]} 
                      onPress={() => handleAction('delete')}
                    >
                      <Text style={styles.secondaryButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // Plan Invite
                  <>
                    <TouchableOpacity 
                      style={[styles.button, styles.primaryButton]} 
                      onPress={() => handleAction('join')}
                    >
                      <Text style={styles.primaryButtonText}>Join</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.button, styles.secondaryButton]} 
                      onPress={() => handleAction('decline')}
                    >
                      <Text style={styles.secondaryButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              renderStatusText()
            )}
          </View>
        )}
      </View>

      {/* Unread Indicator for non-actionable items */}
      {!isActionable && isUnread && (
        <View style={styles.rightContainer}>
           <View style={styles.unreadDot} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    alignItems: 'flex-start', // Align to top for multiline text
  },
  unreadContainer: {
    // We can add a subtle background or just keep the dot
    backgroundColor: '#fff', 
  },
  leftContainer: {
    marginRight: 0,
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  textContainer: {
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#262626', // Instagram-like dark gray
  },
  boldText: {
    fontWeight: '600',
    color: '#000',
  },
  timeText: {
    fontSize: 12,
    color: '#8e8e8e', // Lighter gray for time
    marginTop: 2,
  },
  actionsWrapper: {
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  statusContainer: {
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#0095f6', // Instagram Blue
  },
  secondaryButton: {
    backgroundColor: '#efefef', // Light gray
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 13,
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    alignSelf: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0095f6',
  },
});
