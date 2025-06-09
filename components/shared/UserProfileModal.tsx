import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { X, UserPlus, UserMinus, UserX, Clock, Circle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import useFriendsStore from '@/store/friendsStore';
import useHangStore from '@/store/hangStore';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
  status?: 'available' | 'offline';
  last_seen?: string;
}

interface UserProfileModalProps {
  visible: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSendFriendRequest?: (userId: string) => void;
  onCancelFriendRequest?: (userId: string) => void;
  onAcceptFriendRequest?: (requestId: string) => void;
  onDeclineFriendRequest?: (requestId: string) => void;
  onRemoveFriend?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  onGhostFriend?: (userId: string) => void;
}

export default function UserProfileModal({
  visible,
  user,
  onClose,
  onSendFriendRequest,
  onCancelFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriend,
  onBlockUser,
  onGhostFriend,
}: UserProfileModalProps) {
  const { 
    sentRequests,
    friendRequests,
  } = useFriendsStore();
  
  const { friends } = useHangStore();

  if (!user) return null;

  // Determine relationship status
  const hasSentRequest = sentRequests.some(req => req.friend_id === user.id);
  const hasIncomingRequest = friendRequests.some(req => req.user_id === user.id);
  const isFriend = friends.some((friend: any) => friend.id === user.id);
  
  const incomingRequest = friendRequests.find(req => req.user_id === user.id);

  const renderActionButtons = () => {
    if (isFriend) {
      return (
        <View style={styles.friendButtonsContainer}>
          {/* Availability Block */}
          <View style={styles.availabilityBlock}>
            <View style={styles.availabilityRow}>
              <Circle 
                size={8} 
                color={user.status === 'available' ? Colors.light.onlineGreen : Colors.light.secondaryText}
                fill={user.status === 'available' ? Colors.light.onlineGreen : Colors.light.secondaryText}
              />
              <Text style={styles.availabilityText}>
                {user.status === 'available' ? 'Available to hang' : 
                 user.last_seen ? `Last available ${user.last_seen}` : 'Offline'}
              </Text>
            </View>
          </View>
          
          {/* Friend Actions */}
          <TouchableOpacity
            style={styles.friendActionButton}
            onPress={() => onGhostFriend?.(user.id)}
          >
            <Clock size={20} color={Colors.light.secondaryText} />
            <Text style={styles.friendActionText}>Ghost Friend</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.friendActionButton}
            onPress={() => onRemoveFriend?.(user.id)}
          >
            <UserMinus size={20} color={Colors.light.secondaryText} />
            <Text style={styles.friendActionText}>Remove Friend</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.friendActionButton, styles.blockButton]}
            onPress={() => onBlockUser?.(user.id)}
          >
            <UserX size={20} color={Colors.light.destructive} />
            <Text style={[styles.friendActionText, styles.blockText]}>Block Friend</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasIncomingRequest) {
      return (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => incomingRequest && onAcceptFriendRequest?.(incomingRequest.id)}
          >
            <UserPlus size={20} color="white" />
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => incomingRequest && onDeclineFriendRequest?.(incomingRequest.id)}
          >
            <Text style={[styles.actionButtonText, { color: Colors.light.secondaryText }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasSentRequest) {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.pendingButton]}
          onPress={() => onCancelFriendRequest?.(user.id)}
        >
          <Text style={styles.pendingButtonText}>Pending</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.actionButton, styles.addButton]}
        onPress={() => onSendFriendRequest?.(user.id)}
      >
        <UserPlus size={20} color="white" />
        <Text style={styles.actionButtonText}>Add Friend</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modal}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <X size={20} color={Colors.light.secondaryText} />
            </TouchableOpacity>

            {/* Profile Header - Avatar + Info */}
            <View style={styles.profileHeader}>
              {/* Avatar Left */}
              <Image 
                source={{ uri: user.avatar_url || generateDefaultAvatar(user.name, user.id) }} 
                style={styles.avatar} 
              />
              
              {/* Info Right */}
              <View style={styles.infoSection}>
                <Text style={styles.name}>{user.name}</Text>
                <Text style={styles.username}>@{user.username}</Text>
                
                {isFriend && (
                  <View style={styles.statusIndicator}>
                    <Circle 
                      size={6} 
                      color={user.status === 'available' ? Colors.light.onlineGreen : Colors.light.secondaryText}
                      fill={user.status === 'available' ? Colors.light.onlineGreen : Colors.light.secondaryText}
                    />
                    <Text style={styles.statusText}>
                      {user.status === 'available' ? 'Available' : 'Offline'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Vibe Section */}
            {user.vibe && (
              <View style={styles.vibeSection}>
                <Text style={styles.vibeHeader}>Ideal hang vibe:</Text>
                <View style={styles.vibeQuote}>
                  <Text style={styles.vibeText}>"{user.vibe}"</Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsSection}>
              {renderActionButtons()}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    minWidth: 300,
    maxWidth: 340,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  infoSection: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 6,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  vibeSection: {
    marginBottom: 24,
  },
  vibeHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  vibeQuote: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  vibeText: {
    fontSize: 14,
    color: Colors.light.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionsSection: {
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  addButton: {
    backgroundColor: Colors.light.primary,
  },
  acceptButton: {
    backgroundColor: Colors.light.primary,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pendingButton: {
    backgroundColor: '#E0E0E0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  pendingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
  },
  friendButtonsContainer: {
    gap: 12,
  },
  availabilityBlock: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  friendActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  friendActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  blockButton: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFE5E5',
  },
  blockText: {
    color: Colors.light.destructive,
  },
}); 