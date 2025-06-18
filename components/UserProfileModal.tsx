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
  ScrollView,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { X, UserPlus, UserMinus, UserX, Eye, EyeOff, Clock, MapPin, Calendar, Heart, MessageCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import useFriendsStore from '@/store/friendsStore';
import { relationshipService, RelationshipStatus } from '@/lib/relationship-service';
import GhostSelectionModal from '@/components/GhostSelectionModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
  status?: 'available' | 'busy' | 'offline';
  created_at?: string;
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
        .select('id, name, username, avatar_url, bio, vibe, status, created_at')
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
    console.log('🚫 Add friend disabled (frontend only)');
    setActionLoading(false);
  };

  const handleCancelRequest = async () => {
    console.log('🚫 Cancel friend request disabled (frontend only)');
    setActionLoading(false);
  };

  const handleAcceptRequest = async () => {
    console.log('🚫 Accept friend request disabled (frontend only)');
    setActionLoading(false);
  };

  const handleDeclineRequest = async () => {
    console.log('🚫 Decline friend request disabled (frontend only)');
    setActionLoading(false);
  };

  const handleRemoveFriend = async () => {
    console.log('🚫 Remove friend disabled (frontend only)');
    setActionLoading(false);
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
    if (ghostStatus) {
      switch (ghostStatus.duration_type) {
        case '1_day': return 'Ghosted (1 day)';
        case '3_days': return 'Ghosted (3 days)';
        case 'forever': return 'Ghosted (forever)';
        default: return 'Ghosted';
      }
    }
    return 'Ghost';
  };

  const handleBlockUser = async () => {
    console.log('🚫 Block user disabled (frontend only)');
    setActionLoading(false);
  };

  const handleUnblockUser = async () => {
    console.log('🚫 Unblock user disabled (frontend only)');
    setActionLoading(false);
  };

  const getAvailabilityText = () => {
    if (!user?.status) return '';
    switch (user.status) {
      case 'available': return 'Available to hang';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return '';
    }
  };

  const getStatusColor = () => {
    if (!user?.status) return '#999';
    switch (user.status) {
      case 'available': return '#4CAF50';
      case 'busy': return '#FF9800';
      case 'offline': return '#999';
      default: return '#999';
    }
  };

  const formatJoinDate = (dateString?: string) => {
    if (!dateString) return 'Recently joined';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `Joined ${diffDays} days ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `Joined ${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `Joined ${years} year${years > 1 ? 's' : ''} ago`;
    }
  };

  const getRelationshipStatusText = () => {
    switch (relationshipStatus) {
      case 'friends': return '👥 Friends';
      case 'pending_sent': return '⏳ Request sent';
      case 'pending_received': return '📨 Wants to be friends';
      case 'blocked_by_me': return '🚫 Blocked';
      case 'blocked_by_them': return '❌ Has blocked you';
      default: return '';
    }
  };

  const getRelationshipColor = () => {
    switch (relationshipStatus) {
      case 'friends': return Colors.light.primary;
      case 'pending_sent': return '#FF9800';
      case 'pending_received': return Colors.light.primary;
      case 'blocked_by_me': return Colors.light.destructive;
      case 'blocked_by_them': return Colors.light.destructive;
      default: return Colors.light.secondaryText;
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
                  {isGhosted ? 'Unghost' : 'Ghost'}
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
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <View style={styles.closeButtonBg}>
                <X size={20} color={Colors.light.secondaryText} />
              </View>
            </TouchableOpacity>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
                <Text style={styles.loadingText}>Loading profile...</Text>
              </View>
            ) : user ? (
              <ScrollView 
                style={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Header with Avatar and Basic Info */}
                <View style={styles.header}>
                  <View style={styles.avatarContainer}>
                    <Image
                      source={{ uri: user.avatar_url || generateDefaultAvatar(user.name, user.id) }}
                      style={styles.avatar}
                    />
                    {user.status && (
                      <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
                    )}
                  </View>
                  
                  <View style={styles.userBasicInfo}>
                    <Text style={styles.name}>{user.name}</Text>
                    <Text style={styles.username}>@{user.username}</Text>
                    
                    {/* Relationship Status Badge */}
                    {relationshipStatus !== 'none' && (
                      <View style={[styles.relationshipBadge, { backgroundColor: getRelationshipColor() + '20' }]}>
                        <Text style={[styles.relationshipText, { color: getRelationshipColor() }]}>
                          {getRelationshipStatusText()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Status */}
                {user.status && (
                  <View style={styles.statusContainer}>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                      <Text style={[styles.statusText, { color: getStatusColor() }]}>
                        {getAvailabilityText()}
                      </Text>
                    </View>
                  </View>
                )}

                {/* User Info Cards */}
                <View style={styles.infoCards}>
                  {/* Bio Card */}
                  {user.bio && (
                    <View style={styles.infoCard}>
                      <View style={styles.cardHeader}>
                        <Heart size={16} color={Colors.light.primary} />
                        <Text style={styles.cardTitle}>About</Text>
                      </View>
                      <Text style={styles.cardContent}>{user.bio}</Text>
                    </View>
                  )}

                  {/* Vibe Card */}
                  {user.vibe && (
                    <View style={styles.infoCard}>
                      <View style={styles.cardHeader}>
                        <MessageCircle size={16} color={Colors.light.primary} />
                        <Text style={styles.cardTitle}>Current Vibe</Text>
                      </View>
                      <Text style={styles.cardContent}>{user.vibe}</Text>
                    </View>
                  )}

                  {/* Join Date Card */}
                  <View style={styles.infoCard}>
                    <View style={styles.cardHeader}>
                      <Calendar size={16} color={Colors.light.primary} />
                      <Text style={styles.cardTitle}>Member Since</Text>
                    </View>
                    <Text style={styles.cardContent}>{formatJoinDate(user.created_at)}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
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
              </ScrollView>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Failed to load user profile</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadUserData}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    maxHeight: screenHeight * 0.85,
  },
  modal: {
    backgroundColor: Colors.light.background,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeButtonBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    maxHeight: screenHeight * 0.75,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'white',
  },
  userBasicInfo: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  username: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginBottom: 12,
    fontWeight: '500',
  },
  relationshipBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  relationshipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoCards: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 8,
  },
  cardContent: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 22,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  actionLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  actionLoadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.light.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  dangerButton: {
    backgroundColor: Colors.light.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 12,
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  blockButton: {
    backgroundColor: Colors.light.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  blockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  halfButton: {
    flex: 0.48,
  },
  friendButtonsContainer: {
    gap: 0,
  },
  blockedContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 16,
  },
  blockedText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.destructive,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 