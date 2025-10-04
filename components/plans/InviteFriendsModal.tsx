import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert
} from 'react-native';
import { Check, Search, UserPlus, Link } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan } from '@/store/plansStore';
import { useAuth } from '@/contexts/AuthContext';
import useFriendsStore from '@/store/friendsStore';
interface InviteFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (friendIds: string[]) => void;
  onCreateInvitationPoll: (friendIds: string[], friendNames: string[]) => void;
  plan: Plan;
}

interface FriendUser {
  id: string;
  name: string;
  username?: string;
  avatar: string;
}

export default function InviteFriendsModal({
  visible,
  onClose,
  onInvite,
  onCreateInvitationPoll,
  plan
}: InviteFriendsModalProps) {
  const { user } = useAuth();
  const { friends, isLoadingFriends, loadFriends } = useFriendsStore();
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Get IDs of users already in the plan
  const existingUserIds = plan.participants.map(p => p.id);

  // Map friends data to FriendUser format for display
  const allFriends: FriendUser[] = friends.map(friend => ({
    id: friend.friend_id,
    name: friend.friend_name,
    username: friend.friend_username,
    avatar: friend.friend_avatar_url
  }));

  // Filter out users already in the plan
  const availableFriends = allFriends.filter(friend =>
    !existingUserIds.includes(friend.id)
  );

  // Filter friends based on search query
  const filteredFriends = availableFriends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.username && friend.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Clear selections when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setSelectedFriends([]);
      setSearchQuery('');
    }
  }, [visible]);

  // Load friends data when modal opens
  useEffect(() => {
    if (visible) {
      loadFriends();
    }
  }, [visible, loadFriends]);
  
  const toggleFriendSelection = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };
  
  const handleInvite = () => {
    const selectedFriendNames = selectedFriends.map(id => 
      availableFriends.find(f => f.id === id)?.name || ''
    ).filter(Boolean);
    
    onCreateInvitationPoll(selectedFriends, selectedFriendNames);
    setSelectedFriends([]);
    setSearchQuery('');
  };
  
  const handleClose = () => {
    onClose();
    setSelectedFriends([]);
    setSearchQuery('');
  };
  
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
            <Text style={styles.modalTitle}>Invite Friends</Text>
          </View>
          
          
          <View style={styles.searchContainer}>
            <Search size={20} color={Colors.light.secondaryText} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <ScrollView style={styles.friendsList}>
            {isLoadingFriends ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : (
              <>
                {filteredFriends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={[
                      styles.friendItem,
                      selectedFriends.includes(friend.id) && styles.selectedFriendItem
                    ]}
                    onPress={() => toggleFriendSelection(friend.id)}
                  >
                    <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.name}</Text>
                      {friend.username && (
                        <Text style={styles.friendStatus}>
                          @{friend.username}
                        </Text>
                      )}
                    </View>

                    {selectedFriends.includes(friend.id) ? (
                      <View style={styles.checkmark}>
                        <Check size={16} color="white" />
                      </View>
                    ) : (
                      <View style={styles.addButton}>
                        <UserPlus size={16} color={Colors.light.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                {filteredFriends.length === 0 && !isLoadingFriends && (
                  <Text style={styles.noResultsText}>
                    No friends found
                  </Text>
                )}
              </>
            )}
          </ScrollView>
          
          {/* Invite by link section */}
          <View style={styles.inviteLinkSection}>
            <TouchableOpacity 
              style={styles.inviteLinkButton}
              onPress={() => {
                Alert.alert(
                  'Invite by Link',
                  'This feature will be available soon! People will be able to join through a link once they create an account.',
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
                styles.inviteButton,
                selectedFriends.length === 0 && styles.disabledButton
              ]}
              onPress={handleInvite}
              disabled={selectedFriends.length === 0}
            >
              <Text style={styles.inviteButtonText}>
                Invite {selectedFriends.length > 0 ? `(${selectedFriends.length})` : ''}
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    margin: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
  },
  friendsList: {
    maxHeight: 600,
    paddingHorizontal: 16,
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
    borderRadius: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
    marginBottom: 1,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 4,
  },
  friendStatus: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Colors.light.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.secondaryText,
  },
  inviteButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.5,
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  inviteLinkSection: {
    padding: 16,
  },
  inviteLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.secondaryText,
    marginBottom: 12,
  },
  inviteLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
  },
  inviteLinkButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.primary,
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
});