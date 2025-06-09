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
import { relationshipService, RelationshipStatus } from '@/lib/relationship-service';
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

export default function UserProfileModal({ visible, userId, onClose }: UserProfileModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>('none');
  const [actionLoading, setActionLoading] = useState(false);
  const [showGhostModal, setShowGhostModal] = useState(false);

  const { 
    ghostFriend,
    unghostFriend,
    getGhostStatus,
    loadAllRelationships
  } = useFriendsStore();

  // Load user data and relationship status when modal opens
  useEffect(() => {
    if (visible && userId) {
      loadUserData();
      determineRelationshipStatus();
    } else {
      // Reset state when modal closes
      setUser(null);
      setRelationshipStatus('none');
    }
  }, [visible, userId]);

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

  // Simple single-query relationship status check
  const determineRelationshipStatus = async () => {
    if (!userId) return;
    
    try {
      const status = await relationshipService.getRelationshipStatus(userId);
      setRelationshipStatus(status);
    } catch (error) {
      console.error('Error determining relationship status:', error);
      setRelationshipStatus('none');
    }
  };

  const handleAddFriend = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const success = await relationshipService.sendFriendRequest(user.id);
      if (success) {
        await loadAllRelationships(); // Refresh store data
        await determineRelationshipStatus(); // Refresh local status
      } else {
        Alert.alert('Error', 'Failed to send friend request');
      }
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
      const success = await relationshipService.declineFriendRequest(user.id);
      if (success) {
        await loadAllRelationships(); // Refresh store data
        await determineRelationshipStatus(); // Refresh local status
      } else {
        Alert.alert('Error', 'Failed to cancel friend request');
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
      const success = await relationshipService.acceptFriendRequest(user.id);
      if (success) {
        await loadAllRelationships(); // Refresh store data
        await determineRelationshipStatus(); // Refresh local status
      } else {
        Alert.alert('Error', 'Failed to accept friend request');
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
      const success = await relationshipService.declineFriendRequest(user.id);
      if (success) {
        await loadAllRelationships(); // Refresh store data
        await determineRelationshipStatus(); // Refresh local status
      } else {
        Alert.alert('Error', 'Failed to decline friend request');
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
      `Are you sure you want to remove ${user.name} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const success = await relationshipService.removeFriend(user.id);
              if (success) {
                await loadAllRelationships(); // Refresh store data
                await determineRelationshipStatus(); // Refresh local status
              } else {
                Alert.alert('Error', 'Failed to remove friend');
              }
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
    setShowGhostModal(true);
  };

  const handleGhostSelection = async (duration: '1_day' | '3_days' | 'forever') => {
    if (!user) return;
    setShowGhostModal(false);
    setActionLoading(true);
    try {
      await ghostFriend(user.id, duration);
    } catch (error) {
      console.error('Ghost friend error:', error);
      Alert.alert('Error', 'Failed to ghost friend');
    } finally {
      setActionLoading(false);
    }
  };

  const getGhostButtonText = () => {
    if (!user) return 'Ghost';
    
    const ghostStatus = getGhostStatus(user.id);
    if (!ghostStatus) return 'Ghost';
    
    switch (ghostStatus.duration_type) {
      case '1_day':
        return 'Ghosted (1 day)';
      case '3_days':
        return 'Ghosted (3 days)';
      case 'forever':
        return 'Ghosted (forever)';
      default:
        return 'Ghost';
    }
  };

  const handleBlockUser = async () => {
    if (!user) return;
    
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${user.name}? This will remove them from your friends and prevent them from contacting you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const success = await relationshipService.blockUser(user.id);
              if (success) {
                await loadAllRelationships(); // Refresh store data
                await determineRelationshipStatus(); // Refresh local status
                onClose(); // Close modal after successful blocking
              } else {
                Alert.alert('Error', 'Failed to block user');
              }
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
      const success = await relationshipService.unblockUser(user.id);
      if (success) {
        await loadAllRelationships(); // Refresh store data
        await determineRelationshipStatus(); // Refresh local status
      } else {
        Alert.alert('Error', 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Unblock user error:', error);
      Alert.alert('Error', 'Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
  };

  const getAvailabilityText = () => {
    if (!user?.status) return '';
    
    switch (user.status) {
      case 'available':
        return 'Available to hang';
      case 'busy':
        return 'Busy';
      case 'offline':
        return 'Offline';
      default:
        return '';
    }
  };

  const renderActionButtons = () => {
    if (!user) return null;

    const ghostStatus = getGhostStatus(user.id);
    const isGhosted = !!ghostStatus;

    switch (relationshipStatus) {
      case 'none':
        return (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAddFriend}
            disabled={actionLoading}
          >
            <UserPlus size={20} color="white" />
            <Text style={styles.primaryButtonText}>Add Friend</Text>
          </TouchableOpacity>
        );

      case 'pending_sent':
        return (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCancelRequest}
            disabled={actionLoading}
          >
            <UserMinus size={20} color={Colors.light.primary} />
            <Text style={styles.secondaryButtonText}>Cancel Request</Text>
          </TouchableOpacity>
        );

      case 'pending_received':
        return (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.halfButton]}
              onPress={handleAcceptRequest}
              disabled={actionLoading}
            >
              <UserPlus size={18} color="white" />
              <Text style={styles.primaryButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.halfButton]}
              onPress={handleDeclineRequest}
              disabled={actionLoading}
            >
              <UserMinus size={18} color={Colors.light.primary} />
              <Text style={styles.secondaryButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        );

      case 'friends':
        return (
          <View style={styles.friendButtonsContainer}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.halfButton]}
                onPress={isGhosted ? () => unghostFriend(user.id) : handleGhostFriend}
                disabled={actionLoading}
              >
                {isGhosted ? (
                  <Eye size={18} color={Colors.light.primary} />
                ) : (
                  <EyeOff size={18} color={Colors.light.primary} />
                )}
                <Text style={styles.secondaryButtonText}>
                  {isGhosted ? 'Unghost' : getGhostButtonText()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, styles.halfButton]}
                onPress={handleRemoveFriend}
                disabled={actionLoading}
              >
                <UserMinus size={18} color="white" />
                <Text style={styles.dangerButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.blockButton}
              onPress={handleBlockUser}
              disabled={actionLoading}
            >
              <UserX size={20} color="white" />
              <Text style={styles.blockButtonText}>Block User</Text>
            </TouchableOpacity>
          </View>
        );

      case 'blocked_by_me':
        return (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleUnblockUser}
            disabled={actionLoading}
          >
            <Text style={styles.primaryButtonText}>Unblock User</Text>
          </TouchableOpacity>
        );

      case 'blocked_by_them':
        return (
          <View style={styles.blockedContainer}>
            <Text style={styles.blockedText}>This user has blocked you</Text>
          </View>
        );

      default:
        return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={Colors.light.secondaryText} />
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          ) : user ? (
            <View style={styles.content}>
              <View style={styles.header}>
                <Image
                  source={{ uri: user.avatar_url || generateDefaultAvatar(user.name) }}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.name}>{user.name}</Text>
                  <Text style={styles.username}>@{user.username}</Text>
                  {user.status && (
                    <Text style={styles.availability}>{getAvailabilityText()}</Text>
                  )}
                </View>
              </View>

              {user.bio && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Bio</Text>
                  <Text style={styles.bio}>{user.bio}</Text>
                </View>
              )}

              {user.vibe && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Vibe</Text>
                  <Text style={styles.vibe}>{user.vibe}</Text>
                </View>
              )}

              <View style={styles.actions}>
                {actionLoading ? (
                  <View style={styles.actionLoadingContainer}>
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                    <Text style={styles.actionLoadingText}>Processing...</Text>
                  </View>
                ) : (
                  renderActionButtons()
                )}
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load user profile</Text>
            </View>
          )}
        </View>
      </View>

      <GhostSelectionModal
        visible={showGhostModal}
        onClose={() => setShowGhostModal(false)}
        onSelectDuration={handleGhostSelection}
      />
    </Modal>
  );
}

// Global reference for opening user modal
let globalOpenUserModal: ((userId: string) => void) | null = null;

export const openUserModal = (userId: string) => {
  if (globalOpenUserModal) {
    globalOpenUserModal(userId);
  } else {
    console.warn('User modal not ready yet');
  }
};

export const setOpenUserModalFunction = (fn: (userId: string) => void) => {
  globalOpenUserModal = fn;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 10,
    marginBottom: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginBottom: 2,
  },
  availability: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 22,
  },
  vibe: {
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 22,
    textAlign: 'left',
  },
  actions: {
    marginTop: 20,
  },
  actionLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  actionLoadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dangerButton: {
    backgroundColor: Colors.light.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  blockButton: {
    backgroundColor: Colors.light.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  blockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  halfButton: {
    flex: 0.48,
  },
  friendButtonsContainer: {
    gap: 0,
  },
  blockedContainer: {
    alignItems: 'center',
    padding: 20,
  },
  blockedText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.destructive,
    textAlign: 'center',
  },
}); 