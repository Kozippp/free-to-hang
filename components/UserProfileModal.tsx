import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, UserPlus, UserMinus, UserX, Eye, EyeOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import useFriendsStore from '@/store/friendsStore';
import GhostSelectionModal from '@/components/GhostSelectionModal';

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
  status?: 'available' | 'busy' | 'offline';
}

interface UserProfileModalProps {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}

type RelationshipStatus = 
  | 'none' 
  | 'pending_sent' 
  | 'pending_received' 
  | 'friends' 
  | 'blocked_by_me' 
  | 'blocked_by_them';

export default function UserProfileModal({ visible, userId, onClose }: UserProfileModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>('none');
  const [actionLoading, setActionLoading] = useState(false);
  const [showGhostModal, setShowGhostModal] = useState(false);

  const { 
    sendFriendRequest, 
    acceptFriendRequest, 
    declineFriendRequest, 
    cancelSentRequest,
    ghostFriend,
    unghostFriend,
    getGhostStatus,
    friendRequests,
    sentRequests,
    getRelationshipStatus,
    refreshRelationshipStatus 
  } = useFriendsStore();

  // Load user data and relationship status when modal opens
  useEffect(() => {
    if (visible && userId) {
      loadUserData();
      // Get cached relationship status or refresh if not available
      const cachedStatus = getRelationshipStatus(userId);
      setRelationshipStatus(cachedStatus);
      
      // If status is 'none', refresh it to make sure it's accurate
      if (cachedStatus === 'none') {
        refreshRelationshipStatus(userId).then(newStatus => {
          setRelationshipStatus(newStatus);
        });
      }
    } else {
      // Reset state when modal closes
      setUser(null);
      setRelationshipStatus('none');
    }
  }, [visible, userId]);

  // Listen for relationship status changes in the store
  useEffect(() => {
    if (visible && userId) {
      const checkStatusUpdate = () => {
        const currentStatus = getRelationshipStatus(userId);
        setRelationshipStatus(currentStatus);
      };
      
      // Check status every second while modal is open
      const interval = setInterval(checkStatusUpdate, 1000);
      return () => clearInterval(interval);
    }
  }, [visible, userId, getRelationshipStatus]);

  const loadUserData = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio, vibe, status')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await sendFriendRequest(user.id);
      setRelationshipStatus('pending_sent');
    } catch (error) {
      console.error('Add friend error:', error);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const sentRequest = sentRequests.find(req => req.friend_id === user.id);
      if (sentRequest) {
        await cancelSentRequest(sentRequest.id);
        setRelationshipStatus('none');
      }
    } catch (error) {
      console.error('Cancel request error:', error);
      Alert.alert('Error', 'Failed to cancel friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const receivedRequest = friendRequests.find(req => req.user_id === user.id);
      if (receivedRequest) {
        await acceptFriendRequest(receivedRequest.id);
        setRelationshipStatus('friends');
      }
    } catch (error) {
      console.error('Accept request error:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const receivedRequest = friendRequests.find(req => req.user_id === userId);
      if (receivedRequest) {
        await declineFriendRequest(receivedRequest.id);
        setRelationshipStatus('none');
      }
    } catch (error) {
      console.error('Decline request error:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!user) return;
    
    Alert.alert(
      'Remove Friend',
      `Remove ${user.name} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (!currentUser) return;

              // Remove bidirectional friendship
              await supabase
                .from('friendships')
                .delete()
                .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${currentUser.id})`);

              setRelationshipStatus('none');
            } catch (error) {
              console.error('Remove friend error:', error);
              Alert.alert('Error', 'Failed to remove friend');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleGhostFriend = async () => {
    if (!user) return;
    
    // Check if already ghosted
    const ghostStatus = getGhostStatus(user.id);
    if (ghostStatus) {
      // If already ghosted, unghost them
      try {
        setActionLoading(true);
        await unghostFriend(user.id);
      } catch (error) {
        console.error('Unghost error:', error);
        Alert.alert('Error', 'Failed to unghost friend');
      } finally {
        setActionLoading(false);
      }
    } else {
      // Show ghost selection modal
      setShowGhostModal(true);
    }
  };

  const handleGhostSelection = async (duration: '1_day' | '3_days' | 'forever') => {
    if (!user) return;
    
    try {
      setActionLoading(true);
      await ghostFriend(user.id, duration);
    } catch (error) {
      console.error('Ghost error:', error);
      Alert.alert('Error', 'Failed to ghost friend');
    } finally {
      setActionLoading(false);
    }
  };

  const getGhostButtonText = () => {
    if (!user) return 'Ghost Friend';
    
    const ghostStatus = getGhostStatus(user.id);
    if (!ghostStatus) return 'Ghost Friend';
    
    if (ghostStatus.duration_type === 'forever') {
      return '🔕 Ghosted forever';
    }
    
    // Calculate time remaining
    if (ghostStatus.expires_at) {
      const now = new Date();
      const expiry = new Date(ghostStatus.expires_at);
      const diff = expiry.getTime() - now.getTime();
      
      if (diff <= 0) {
        return 'Ghost Friend'; // Expired
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        return `🔕 Ghosted for ${hours}h ${minutes}min`;
      } else {
        return `🔕 Ghosted for ${minutes}min`;
      }
    }
    
    return 'Ghost Friend';
  };

  const handleBlockUser = async () => {
    if (!user) return;
    
    Alert.alert(
      'Block User',
      `Block ${user.name}? They won't be able to find you or send friend requests.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (!currentUser) return;

              // Remove any existing friendship first
              await supabase
                .from('friendships')
                .delete()
                .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${currentUser.id})`);

              // Remove any pending friend requests
              await supabase
                .from('friend_requests')
                .delete()
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${user.id}),and(sender_id.eq.${user.id},receiver_id.eq.${currentUser.id})`);

              // Add to blocked users
              await supabase
                .from('blocked_users')
                .insert({ blocker_id: currentUser.id, blocked_id: user.id });

              setRelationshipStatus('blocked_by_me');
            } catch (error) {
              console.error('Block user error:', error);
              Alert.alert('Error', 'Failed to block user');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!user) return;
    
    setActionLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', user.id);

      setRelationshipStatus('none');
    } catch (error) {
      console.error('Unblock user error:', error);
      Alert.alert('Error', 'Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
  };

  const getAvailabilityText = () => {
    if (!user) return '';
    
    switch (user.status) {
      case 'available':
        return 'Available to hang';
      case 'busy':
        return 'Busy';
      case 'offline':
        return 'Offline';
      default:
        return 'Offline';
    }
  };

  const renderActionButtons = () => {
    if (actionLoading) {
      return <ActivityIndicator size="small" color={Colors.light.primary} />;
    }

    switch (relationshipStatus) {
      case 'none':
        return (
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddFriend}>
            <UserPlus size={20} color="white" />
            <Text style={styles.primaryButtonText}>Add Friend</Text>
          </TouchableOpacity>
        );

      case 'pending_sent':
        return (
          <TouchableOpacity style={styles.pendingButton} onPress={handleCancelRequest}>
            <Text style={styles.pendingButtonText}>Pending</Text>
          </TouchableOpacity>
        );

      case 'pending_received':
        return (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptRequest}>
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineButton} onPress={handleDeclineRequest}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        );

      case 'friends':
        return (
          <View style={styles.friendButtonsContainer}>
            <TouchableOpacity 
              style={[
                styles.ghostButton,
                getGhostStatus(user?.id || '') && styles.ghostedButton
              ]} 
              onPress={handleGhostFriend}
            >
              <EyeOff size={18} color={getGhostStatus(user?.id || '') ? '#FF6B6B' : Colors.light.text} />
              <Text style={[
                styles.ghostButtonText,
                getGhostStatus(user?.id || '') && styles.ghostedButtonText
              ]}>
                {getGhostButtonText()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeButton} onPress={handleRemoveFriend}>
              <UserMinus size={18} color="#FF4444" />
              <Text style={styles.removeButtonText}>Remove Friend</Text>
            </TouchableOpacity>
          </View>
        );

      case 'blocked_by_me':
        return (
          <TouchableOpacity style={styles.blockedButton} onPress={handleUnblockUser}>
            <Text style={styles.blockedButtonText}>Blocked</Text>
          </TouchableOpacity>
        );

      case 'blocked_by_them':
        return null; // They blocked you, no actions available

      default:
        return null;
    }
  };

  if (!visible || !userId) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.modal}
          activeOpacity={1}
          onPress={() => {}} // Prevent closing when clicking inside modal
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color={Colors.light.secondaryText} />
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.light.primary} />
          ) : user ? (
            <>
              {/* Profile Header */}
              <View style={styles.profileHeader}>
                <Image 
                  source={{ uri: user.avatar_url || generateDefaultAvatar(user.name, user.id) }} 
                  style={styles.avatar} 
                />
                <View style={styles.userInfo}>
                  <Text style={styles.name}>{user.name}</Text>
                  <Text style={styles.username}>@{user.username}</Text>
                  {relationshipStatus === 'friends' && (
                    <Text style={styles.availability}>{getAvailabilityText()}</Text>
                  )}
                </View>
              </View>

              {/* Vibe Section - Only show if not blocked */}
              {relationshipStatus !== 'blocked_by_me' && relationshipStatus !== 'blocked_by_them' && user.vibe && (
                <View style={styles.vibeSection}>
                  <Text style={styles.vibeHeader}>Ideal hang vibe:</Text>
                  <Text style={styles.vibeText}>"{user.vibe}"</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionsSection}>
                {renderActionButtons()}
              </View>

              {/* Block Button - Only show if not already blocked */}
              {relationshipStatus !== 'blocked_by_me' && relationshipStatus !== 'blocked_by_them' && (
                <TouchableOpacity style={styles.blockTextButton} onPress={handleBlockUser}>
                  <Text style={styles.blockText}>Block user</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.errorText}>User not found</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
      
      {/* Ghost Selection Modal */}
      <GhostSelectionModal
        visible={showGhostModal}
        onClose={() => setShowGhostModal(false)}
        onSelectDuration={handleGhostSelection}
      />
    </Modal>
  );
}

// Global function to open user modal
let openUserProfileModal: ((userId: string) => void) | null = null;

export const openUserModal = (userId: string) => {
  if (openUserProfileModal) {
    openUserProfileModal(userId);
  }
};

export const setOpenUserModalFunction = (fn: (userId: string) => void) => {
  openUserProfileModal = fn;
};

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
    padding: 30,
    alignItems: 'center',
    minWidth: 320,
    maxWidth: 360,
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
    marginBottom: 24,
    width: '100%',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
    paddingTop: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginBottom: 8,
  },
  availability: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  vibeSection: {
    width: '100%',
    marginBottom: 24,
  },
  vibeHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  vibeText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionsSection: {
    width: '100%',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  pendingButton: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  pendingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  friendButtonsContainer: {
    gap: 12,
  },
  ghostButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  ghostButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  removeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
    gap: 8,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4444',
  },
  blockedButton: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  blockedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
  },
  blockTextButton: {
    paddingVertical: 8,
  },
  blockText: {
    fontSize: 14,
    color: '#FF4444',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
  ghostedButton: {
    backgroundColor: '#FFE0E0',
  },
  ghostedButtonText: {
    color: '#FF6B6B',
  },
}); 