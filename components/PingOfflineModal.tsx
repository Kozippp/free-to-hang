import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  FlatList,
  TouchableWithoutFeedback,
  Animated,
  Platform
} from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { offlineFriends } from '@/constants/mockData';

interface OfflineFriend {
  id: string;
  name: string;
  avatar: string;
  status: 'offline';
  lastSeen: string;
}

interface PingOfflineModalProps {
  visible: boolean;
  onClose: () => void;
  onPingFriend: (friendId: string) => void;
  pingedFriends: string[];
}

export default function PingOfflineModal({
  visible,
  onClose,
  onPingFriend,
  pingedFriends
}: PingOfflineModalProps) {
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  const renderFriendItem = ({ item }: { item: OfflineFriend }) => {
    const isPinged = pingedFriends.includes(item.id);
    
    return (
      <View style={styles.friendItem}>
        <View style={styles.friendInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.statusDot} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.lastSeen}>Last seen {item.lastSeen}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.pingButton,
            isPinged && styles.pingedButton
          ]}
          onPress={() => onPingFriend(item.id)}
          disabled={isPinged}
        >
          <Text style={[
            styles.pingButtonText,
            isPinged && styles.pingedButtonText
          ]}>
            {isPinged ? 'Pinged' : 'Ping'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.modalContainer,
                { opacity: fadeAnim }
              ]}
            >
              <View style={styles.header}>
                <Text style={styles.title}>Ping Offline Friends</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color={Colors.light.secondaryText} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.description}>
                Let your friends know you want to hang out with them
              </Text>
              
              {offlineFriends.length > 0 ? (
                <FlatList
                  data={offlineFriends as OfflineFriend[]}
                  renderItem={renderFriendItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={Platform.OS === 'web'}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No offline friends found</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.doneButton}
                onPress={onClose}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 20,
  },
  listContent: {
    paddingVertical: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.offlineGray,
    borderWidth: 2,
    borderColor: Colors.light.modalBackground,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  lastSeen: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  pingButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
  },
  pingedButton: {
    backgroundColor: Colors.light.buttonBackground,
  },
  pingButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pingedButtonText: {
    color: Colors.light.secondaryText,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  doneButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});