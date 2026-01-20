import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NotificationGroup } from '@/utils/notificationGrouper';
import NotificationAvatarStack from './NotificationAvatarStack';
import { formatTimeAgo } from '@/utils/time';
import { NotificationSender } from '@/store/notificationsStore';

interface Props {
  group: NotificationGroup;
  onPress: (group: NotificationGroup) => void;
  onAvatarPress: (user: NotificationSender) => void;
  onAction?: (action: 'accept' | 'decline' | 'delete' | 'join', group: NotificationGroup) => void;
}

export default function NotificationGroupItem({ group, onPress, onAvatarPress, onAction }: Props) {
  const isActionable = group.type === 'friend_request' || group.type === 'plan_invite';
  const isUnread = !group.isRead;

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
            onPress: () => onAction(action, group) 
          }
        ]
      );
    } else if (onAction) {
      onAction(action, group);
    }
  };

  // Simple parser for bold text (**text**)
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <Text style={styles.bodyText} numberOfLines={2}>
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
        )}
      </View>

      {/* Unread Indicator for non-actionable items */}
      {!isActionable && isUnread && (
        <View style={styles.rightContainer}>
           <View style={styles.unreadDot} />
        </View>
      )}
      
      {/* Plan Image or Context Icon could go here for non-actionable items if desired */}
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
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 8,
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
