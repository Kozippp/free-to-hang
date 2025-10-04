import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  Platform,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
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

  // Debug logging
  console.log('🟢 AddMoreFriendsModal render:', {
    visible,
    availableFriends: availableFriends.length,
    alreadyInvited: alreadyInvited.length,
  });

  // Filter out friends who are already invited
  const alreadyInvitedIds = new Set(alreadyInvited.map(f => f.id));
  const uninvitedFriends = availableFriends.filter(f => !alreadyInvitedIds.has(f.id));

  console.log('🟡 Uninvited friends:', uninvitedFriends.length);

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
    onClose();
  };

  const renderFriendItem = ({ item }: { item: Friend }) => {
    const isSelected = selectedFriendIds.includes(item.id);
    const isAvailable = item.status === 'available';

    return (
      <TouchableOpacity
        style={styles.friendItem}
        onPress={() => toggleFriend(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.friendInfo}>
          <View style={styles.friendAvatarContainer}>
            <Image
              source={{ uri: item.avatar }}
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
            <Text style={styles.friendName}>{item.name}</Text>
            {item.username && (
              <Text style={styles.friendHandle}>@{item.username}</Text>
            )}
          </View>
        </View>
        <View
          style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
          ]}
        >
          {isSelected && <Check size={16} color="white" />}
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Add More Friends</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>

          {uninvitedFriends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                All your friends are already invited!
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Select friends to invite to this plan
              </Text>

              <FlatList
                data={uninvitedFriends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.id}
                style={styles.friendsList}
                contentContainerStyle={styles.friendsListContent}
                showsVerticalScrollIndicator={true}
              />

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    selectedFriendIds.length === 0 && styles.addButtonDisabled,
                  ]}
                  onPress={handleAddFriends}
                  disabled={selectedFriendIds.length === 0}
                >
                  <Text style={styles.addButtonText}>
                    Add {selectedFriendIds.length > 0 ? `(${selectedFriendIds.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
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
    zIndex: 9999,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 10000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  friendsList: {
    flex: 1,
  },
  friendsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.light.buttonBackground,
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
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
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
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  friendHandle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  addButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
});

