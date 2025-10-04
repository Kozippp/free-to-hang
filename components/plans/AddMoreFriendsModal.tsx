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
} from 'react-native';
import { Check, Search, UserPlus, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import useHangStore from '@/store/hangStore';

interface AddMoreFriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddMoreFriendsModal({
  visible,
  onClose,
}: AddMoreFriendsModalProps) {
  const { 
    friends, 
    offlineFriends, 
    selectedFriends, 
    selectFriend,
    unselectFriend,
    isSelectedFriend 
  } = useHangStore();
  
  const [searchQuery, setSearchQuery] = useState('');

  // Combine online and offline friends
  const allFriends = [...friends, ...offlineFriends];

  // Filter friends based on search query
  const filteredFriends = allFriends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.username && friend.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Clear search when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
    }
  }, [visible]);

  const toggleFriendSelection = (friendId: string) => {
    if (isSelectedFriend(friendId)) {
      unselectFriend(friendId);
    } else {
      selectFriend(friendId);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
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
            <Text style={styles.modalTitle}>Add Friends to Plan</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
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
          
          <ScrollView 
            style={styles.friendsList} 
            contentContainerStyle={[
              styles.friendsListContent,
              filteredFriends.length === 0 ? styles.centerEmpty : null
            ]}
          >
            {filteredFriends.map((friend) => {
              const isSelected = isSelectedFriend(friend.id);
              const isFreeToHang = friend.status === 'available';
              
              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[
                    styles.friendItem,
                    isSelected && styles.selectedFriendItem
                  ]}
                  onPress={() => toggleFriendSelection(friend.id)}
                >
                  <View style={styles.friendAvatarContainer}>
                    <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                    <View style={[
                      styles.statusIndicator,
                      isFreeToHang ? styles.statusOnline : styles.statusOffline
                    ]} />
                  </View>
                  
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <View style={styles.friendStatusRow}>
                      {friend.username && (
                        <Text style={styles.friendUsername}>
                          @{friend.username}
                        </Text>
                      )}
                      {isFreeToHang && friend.activity && (
                        <Text style={styles.friendActivity} numberOfLines={1}>
                          {friend.activity}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isSelected ? (
                    <View style={styles.checkmark}>
                      <Check size={16} color="white" />
                    </View>
                  ) : (
                    <View style={styles.addButton}>
                      <UserPlus size={16} color={Colors.light.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {filteredFriends.length === 0 && (
              <Text style={styles.noResultsText}>
                No friends found
              </Text>
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleClose}
            >
              <Text style={styles.doneButtonText}>
                Done {selectedFriends.length > 0 ? `(${selectedFriends.length} selected)` : ''}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
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
    marginHorizontal: 16,
    marginBottom: 16,
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
    maxHeight: 520,
    minHeight: 260,
  },
  friendsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 220,
  },
  centerEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  friendAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: Colors.light.secondaryText,
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
  friendStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  friendUsername: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  friendActivity: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '500',
    flex: 1,
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
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  doneButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
});

