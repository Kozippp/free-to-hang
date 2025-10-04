import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Check, Search, UserPlus, Link } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface Friend {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  status: 'available' | 'offline' | 'pinged';
  activity?: string;
  lastActive?: string;
  lastSeen?: string;
}

interface AddMoreFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  availableFriends: Friend[];
  alreadyInvited: Friend[];
  onAddFriends: (friendIds: string[]) => void;
}

export default function AddMoreFriendsModal({
  visible,
  onClose,
  availableFriends,
  alreadyInvited,
  onAddFriends,
}: AddMoreFriendsModalProps) {
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');


  // Filter out friends who are already invited
  const alreadyInvitedIds = new Set(alreadyInvited.map(f => f.id));
  const uninvitedFriends = availableFriends.filter(f => !alreadyInvitedIds.has(f.id));

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) {
      return uninvitedFriends;
    }

    const query = searchQuery.trim().toLowerCase();
    return uninvitedFriends.filter(friend => {
      const matchesName = friend.name.toLowerCase().includes(query);
      const matchesUsername = friend.username?.toLowerCase().includes(query);
      return matchesName || matchesUsername;
    });
  }, [uninvitedFriends, searchQuery]);

  // Clear selections when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedFriendIds([]);
      setSearchQuery('');
    }
  }, [visible]);

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const handleAddFriends = () => {
    if (selectedFriendIds.length > 0) {
      onAddFriends(selectedFriendIds);
      setSelectedFriendIds([]);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedFriendIds([]);
    setSearchQuery('');
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add More Friends</Text>
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={22} color={Colors.light.secondaryText} />
          </TouchableOpacity>

          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>Select friends to add to this plan</Text>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.light.secondaryText} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.light.secondaryText}
              autoCorrect={false}
            />
          </View>

          {uninvitedFriends.length === 0 ? (
            <View style={[styles.friendsList, styles.centerContent]}>
              <Text style={styles.emptyText}>
                All your friends are already part of this plan.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={[styles.friendsList, { flex: 1 }]} // Allow it to expand
              contentContainerStyle={[
                styles.friendsListContent,
                filteredFriends.length === 0 ? styles.centerContent : null,
              ]}
              showsVerticalScrollIndicator={false}
            >
              {filteredFriends.map((friend) => {
                const isSelected = selectedFriendIds.includes(friend.id);
                const isAvailable = friend.status === 'available';

                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={[styles.friendItem, isSelected && styles.selectedFriendItem]}
                    onPress={() => toggleFriend(friend.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.friendInfo}>
                      <View style={styles.friendAvatarContainer}>
                        <Image
                          source={{ uri: friend.avatar }}
                          style={styles.friendAvatar}
                        />
                        <View
                          style={[
                            styles.statusIndicator,
                            isAvailable ? styles.statusAvailable : styles.statusOffline,
                          ]}
                        />
                      </View>
                      <View style={styles.friendDetails}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        {friend.username && (
                          <Text style={styles.friendHandle}>@{friend.username}</Text>
                        )}
                      </View>
                    </View>

                    {isSelected ? (
                      <View style={styles.checkmark}>
                        <Check size={16} color="white" />
                      </View>
                    ) : (
                      <View style={styles.addIconWrapper}>
                        <UserPlus size={16} color={Colors.light.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {filteredFriends.length === 0 && (
                <Text style={styles.emptyText}>No friends found</Text>
              )}
            </ScrollView>
          )}

          <View style={styles.inviteLinkSection}>
            <TouchableOpacity
              style={styles.inviteLinkButton}
              onPress={() => {
                Alert.alert(
                  'Invite by Link',
                  'This feature will be available soon!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Link size={16} color={Colors.light.primary} />
              <Text style={styles.inviteLinkButtonText}>Invite friends outside the app</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addButton,
                selectedFriendIds.length === 0 && styles.disabledButton,
              ]}
              onPress={handleAddFriends}
              disabled={selectedFriendIds.length === 0}
            >
              <Text style={styles.addButtonText}>
                Add {selectedFriendIds.length > 0 ? `(${selectedFriendIds.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 16,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    zIndex: 2,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    marginHorizontal: 20,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.light.text,
  },
  friendsList: {
    flex: 1,
    minHeight: 100, // Minimum height when empty
    maxHeight: 500, // Maximum height when full
  },
  friendsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  selectedFriendItem: {
    backgroundColor: `${Colors.light.primary}10`,
    borderRadius: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  statusAvailable: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: Colors.light.secondaryText,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  friendHandle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginTop: 2,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Colors.light.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteLinkSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  inviteLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
  },
  inviteLinkButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.primary,
    marginLeft: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.secondaryText,
  },
  addButton: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
});

