import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
  Animated
} from 'react-native';
import { X, Check, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Participant } from '@/store/plansStore';

interface ConditionalFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedFriendIds: string[]) => void;
  participants: Participant[];
  currentUserId: string;
}

export default function ConditionalFriendsModal({
  visible,
  onClose,
  onConfirm,
  participants,
  currentUserId
}: ConditionalFriendsModalProps) {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      // Load existing conditional friends or start with empty array
      const currentUser = participants.find(p => p.id === currentUserId);
      const existingConditionalFriends = currentUser?.conditionalFriends || [];

      setSelectedFriends(existingConditionalFriends);

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

  // Get other participants (exclude current user)
  const otherParticipants = participants.filter(p => p.id !== currentUserId);

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedFriends);
    onClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'going': return '#4CAF50';
      case 'maybe': return '#FF9800';
      case 'conditional': return '#2196F3';
      case 'declined': return '#F44336';
      default: return Colors.light.secondaryText;
    }
  };

  const getStatusText = (participant: Participant) => {
    switch (participant.status) {
      case 'going': return 'Going';
      case 'maybe': return 'Maybe';
      case 'conditional': 
        if (participant.conditionalFriends && participant.conditionalFriends.length > 0) {
          const dependsOn = participant.conditionalFriends
            .map(id => participants.find(p => p.id === id)?.name)
            .filter(Boolean)
            .join(', ');
          return `If ${dependsOn}`;
        }
        return 'If...';
      case 'declined': return 'Declined';
      default: return 'Pending';
    }
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
                <Users size={24} color={Colors.light.primary} />
                <Text style={styles.title}>Conditional Attendance</Text>
              </View>
              
              <Text style={styles.subtitle}>
                Select friends whose attendance you depend on. You'll only be marked as "Going" if they come too.
              </Text>
              
              <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
                {otherParticipants.map((participant) => {
                  const isSelected = selectedFriends.includes(participant.id);
                  const statusColor = getStatusColor(participant.status);
                  
                  return (
                    <TouchableOpacity
                      key={participant.id}
                      style={[
                        styles.friendItem,
                        isSelected && styles.selectedFriendItem
                      ]}
                      onPress={() => toggleFriend(participant.id)}
                    >
                      <View style={styles.friendInfo}>
                        <Image source={{ uri: participant.avatar }} style={styles.avatar} />
                        <View style={styles.friendDetails}>
                          <Text style={styles.friendName}>{participant.name}</Text>
                          <Text style={[styles.friendStatus, { color: statusColor }]}>
                            {getStatusText(participant)}
                          </Text>
                        </View>
                      </View>
                      
                      {isSelected && (
                        <View style={styles.checkIcon}>
                          <Check size={20} color={Colors.light.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>
                    {selectedFriends.length === 0 
                      ? 'Just maybe' 
                      : `Depend on ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}`
                    }
                  </Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 20,
    lineHeight: 20,
  },
  friendsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: Colors.light.buttonBackground,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFriendItem: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}10`,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
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
  friendStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.light.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.buttonBackground,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 