import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Animated, Image } from 'react-native';
import { CheckCircle, HelpCircle, Eye, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ParticipantStatus, Participant } from '@/store/plansStore';
import ConditionalFriendsModal from './ConditionalFriendsModal';

interface PlanUserStatusProps {
  currentStatus: ParticipantStatus;
  onStatusChange: (status: ParticipantStatus, conditionalFriends?: string[]) => void;
  participants: Participant[];
  currentUserId: string;
}

export default function PlanUserStatus({ 
  currentStatus, 
  onStatusChange, 
  participants, 
  currentUserId 
}: PlanUserStatusProps) {
  const [statusAnimation] = useState(new Animated.Value(1));
  const [showConditionalModal, setShowConditionalModal] = useState(false);

  const handleStatusChange = (newStatus: ParticipantStatus) => {
    // Show warning only when going FROM 'going' TO maybe/conditional
    // because only when you're "going" you can actually vote and have votes to lose
    if (currentStatus === 'going' && (newStatus === 'maybe' || newStatus === 'conditional')) {
      Alert.alert(
        'Change Status',
        'Changing your status will remove all your votes. Are you sure?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Change',
            onPress: () => {
              if (newStatus === 'conditional') {
                setShowConditionalModal(true);
              } else {
                animateAndChangeStatus(newStatus);
              }
            }
          }
        ]
      );
    } else if (newStatus === 'declined') {
      Alert.alert(
        'Decline Plan',
        'If you decline, you will be removed from this plan and won\'t be able to see it anymore. This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => animateAndChangeStatus(newStatus)
          }
        ]
      );
    } else if (newStatus === 'conditional') {
      // Show conditional friends modal for "If..." button
      setShowConditionalModal(true);
    } else {
      // For all other status changes (maybe->going, maybe->if, if->going, if->maybe), just change directly
      animateAndChangeStatus(newStatus);
    }
  };

  const animateAndChangeStatus = (newStatus: ParticipantStatus, conditionalFriends?: string[]) => {
    // Simple, smooth, and satisfying animation
    Animated.timing(statusAnimation, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true
    }).start(() => {
      // Change status immediately after the press feedback
      onStatusChange(newStatus, conditionalFriends);

      // Smooth bounce back
      Animated.spring(statusAnimation, {
        toValue: 1,
        tension: 400,
        friction: 10,
        useNativeDriver: true
      }).start();
    });
  };

  const handleConditionalConfirm = (selectedFriendIds: string[]) => {
    // ALWAYS set as conditional - even with empty friends array
    // This is the foolproof logic: "If..." button always means conditional status
    animateAndChangeStatus('conditional', selectedFriendIds);
  };

  const currentUser = participants.find(p => p.id === currentUserId);

  const getStatusStyle = (status: ParticipantStatus) => {
    switch (status) {
      case 'going':
        return {
          backgroundColor: currentStatus === 'going' ? '#4CAF50' : '#E8F5E8',
          borderColor: '#4CAF50',
          iconColor: currentStatus === 'going' ? 'white' : '#4CAF50',
          textColor: currentStatus === 'going' ? 'white' : '#4CAF50'
        };
      case 'maybe':
        return {
          backgroundColor: currentStatus === 'maybe' ? '#FF9800' : '#FFF3E0',
          borderColor: '#FF9800',
          iconColor: currentStatus === 'maybe' ? 'white' : '#FF9800',
          textColor: currentStatus === 'maybe' ? 'white' : '#FF9800'
        };
      case 'conditional':
        return {
          backgroundColor: currentStatus === 'conditional' ? '#2196F3' : '#E3F2FD',
          borderColor: '#2196F3',
          iconColor: currentStatus === 'conditional' ? 'white' : '#2196F3',
          textColor: currentStatus === 'conditional' ? 'white' : '#2196F3'
        };
      case 'declined':
        return {
          backgroundColor: currentStatus === 'declined' ? '#F44336' : '#FFEBEE',
          borderColor: '#F44336',
          iconColor: currentStatus === 'declined' ? 'white' : '#F44336',
          textColor: currentStatus === 'declined' ? 'white' : '#F44336'
        };
      default:
        return {
          backgroundColor: Colors.light.buttonBackground,
          borderColor: Colors.light.border,
          iconColor: Colors.light.text,
          textColor: Colors.light.text
        };
    }
  };

  return (
    <>
      <Animated.View style={[styles.container, { transform: [{ scale: statusAnimation }] }]}>
        <Text style={styles.title}>Your Status</Text>
        
        <View style={styles.statusButtons}>
          <TouchableOpacity
            style={[
              styles.statusButton,
              {
                backgroundColor: getStatusStyle('going').backgroundColor,
                borderColor: getStatusStyle('going').borderColor,
                borderWidth: 2,
              }
            ]}
            onPress={() => handleStatusChange('going')}
            activeOpacity={0.8}
          >
            <CheckCircle size={20} color={getStatusStyle('going').iconColor} />
            <Text style={[
              styles.statusText,
              { color: getStatusStyle('going').textColor, fontWeight: currentStatus === 'going' ? '600' : '500' }
            ]}>
              Going
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusButton,
              {
                backgroundColor: getStatusStyle('maybe').backgroundColor,
                borderColor: getStatusStyle('maybe').borderColor,
                borderWidth: 2,
              }
            ]}
            onPress={() => handleStatusChange('maybe')}
            activeOpacity={0.8}
          >
            <HelpCircle size={20} color={getStatusStyle('maybe').iconColor} />
            <Text style={[
              styles.statusText,
              { color: getStatusStyle('maybe').textColor, fontWeight: currentStatus === 'maybe' ? '600' : '500' }
            ]}>
              Maybe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusButton,
              {
                backgroundColor: getStatusStyle('conditional').backgroundColor,
                borderColor: getStatusStyle('conditional').borderColor,
                borderWidth: 2,
              }
            ]}
            onPress={() => handleStatusChange('conditional')}
            activeOpacity={0.8}
          >
            <Eye size={20} color={getStatusStyle('conditional').iconColor} />
            <Text style={[
              styles.statusText,
              { color: getStatusStyle('conditional').textColor, fontWeight: currentStatus === 'conditional' ? '600' : '500' }
            ]}>
              If...
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusButton,
              {
                backgroundColor: getStatusStyle('declined').backgroundColor,
                borderColor: getStatusStyle('declined').borderColor,
                borderWidth: 2,
              }
            ]}
            onPress={() => handleStatusChange('declined')}
            activeOpacity={0.8}
          >
            <X size={20} color={getStatusStyle('declined').iconColor} />
            <Text style={[
              styles.statusText,
              { color: getStatusStyle('declined').textColor, fontWeight: currentStatus === 'declined' ? '600' : '500' }
            ]}>
              Can't go
            </Text>
          </TouchableOpacity>
        </View>

        {/* Show conditional terms clearly if user has conditional status */}
        {currentStatus === 'conditional' && (() => {
          if (currentUser?.conditionalFriends && currentUser.conditionalFriends.length > 0) {
            const dependentFriends = currentUser.conditionalFriends
              .map(id => participants.find(p => p.id === id))
              .filter(Boolean);
            
            return (
              <View style={styles.conditionalTermsContainer}>
                <Text style={styles.conditionalTermsTitle}>Your status will be set as "Going" if these people come:</Text>
                <View style={styles.conditionalFriendsList}>
                  {dependentFriends.map((friend) => (
                    <View key={friend!.id} style={styles.conditionalFriendItem}>
                      <Image source={{ uri: friend!.avatar }} style={styles.conditionalAvatar} />
                      <Text style={styles.conditionalFriendName}>{friend!.name}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.conditionalTermsSubtext}>
                  Until then your friends see you as "Maybe".
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {/* Enhanced disclaimer based on current status - show only one */}
        {(currentStatus === 'maybe' || 
          (currentStatus === 'conditional' && (!currentUser?.conditionalFriends || currentUser.conditionalFriends.length === 0))) && (
          <View style={styles.disclaimerContainer}>
            <Text style={styles.disclaimerText}>
              {currentStatus === 'maybe' 
                ? 'As "Maybe", you can view but not vote or edit this plan until you respond "Going".'
                : 'As "If", you can view but not vote or edit this plan until you respond "Going".'
              }
            </Text>
          </View>
        )}
      </Animated.View>

      <ConditionalFriendsModal
        visible={showConditionalModal}
        onClose={() => setShowConditionalModal(false)}
        onConfirm={handleConditionalConfirm}
        participants={participants}
        currentUserId={currentUserId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 60,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statusText: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  disclaimerContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: `${Colors.light.warning}15`,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.warning,
  },
  disclaimerText: {
    fontSize: 13,
    color: Colors.light.warning,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  conditionalTermsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  conditionalTermsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
  },
  conditionalFriendsList: {
    marginBottom: 8,
  },
  conditionalFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  conditionalAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  conditionalFriendName: {
    fontSize: 14,
    color: Colors.light.text,
  },
  conditionalTermsSubtext: {
    fontSize: 13,
    color: Colors.light.text,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});