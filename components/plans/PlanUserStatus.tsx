import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Animated } from 'react-native';
import { CheckCircle, HelpCircle, Eye, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { ParticipantStatus, Participant } from '@/store/plansStore';
import ConditionalFriendsModal from './ConditionalFriendsModal';
import CachedAvatar from '@/components/CachedAvatar';

interface PlanUserStatusProps {
  currentStatus: ParticipantStatus;
  onStatusChange: (status: ParticipantStatus, conditionalFriends?: string[]) => void;
  participants: Participant[];
  currentUserId: string;
}

interface AnimatedStatusButtonProps {
  status: ParticipantStatus;
  currentStatus: ParticipantStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  onPress: () => void;
}

const AnimatedStatusButton = ({ 
  status, 
  currentStatus, 
  label, 
  icon, 
  color,
  backgroundColor,
  borderColor,
  textColor,
  onPress 
}: AnimatedStatusButtonProps) => {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true
      })
    ]).start();

    onPress();
  };

  const isSelected = currentStatus === status;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          styles.statusButton,
          {
            backgroundColor,
            borderColor,
            borderWidth: 2,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {icon}
        <Text style={[
          styles.statusText,
          { color: textColor, fontWeight: isSelected ? '600' : '500' }
        ]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function PlanUserStatus({ 
  currentStatus, 
  onStatusChange, 
  participants, 
  currentUserId 
}: PlanUserStatusProps) {
  const [showConditionalModal, setShowConditionalModal] = useState(false);
  /** Bridges API/refetch delays so chosen friends stay visible under "If" */
  const [localConditionalFriendIds, setLocalConditionalFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (currentStatus !== 'conditional') {
      setLocalConditionalFriendIds([]);
    }
  }, [currentStatus]);

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
                onStatusChange(newStatus);
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
            onPress: () => onStatusChange(newStatus)
          }
        ]
      );
    } else if (newStatus === 'conditional') {
      // Show conditional friends modal for "If..." button
      setShowConditionalModal(true);
    } else {
      // For all other status changes (maybe->going, maybe->if, if->going, if->maybe), just change directly
      onStatusChange(newStatus);
    }
  };

  const handleConditionalConfirm = (selectedFriendIds: string[]) => {
    setLocalConditionalFriendIds(selectedFriendIds);
    // ALWAYS set as conditional - even with empty friends array
    onStatusChange('conditional', selectedFriendIds);
  };

  const currentUser = participants.find(p => p.id === currentUserId);

  const effectiveConditionalFriendIds = useMemo(() => {
    const fromParticipant = currentUser?.conditionalFriends?.length
      ? currentUser.conditionalFriends
      : [];
    if (fromParticipant.length > 0) return fromParticipant;
    return localConditionalFriendIds;
  }, [currentUser?.conditionalFriends, localConditionalFriendIds]);

  const conditionalDependentFriends = useMemo(
    () =>
      effectiveConditionalFriendIds
        .map((id) => participants.find((p) => p.id === id))
        .filter(Boolean) as Participant[],
    [effectiveConditionalFriendIds, participants]
  );

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
          backgroundColor: currentStatus === 'maybe' ? '#FFC107' : '#FFF8E1',
          borderColor: '#FFC107',
          iconColor: currentStatus === 'maybe' ? 'white' : '#FFC107',
          textColor: currentStatus === 'maybe' ? 'white' : '#FFC107'
        };
      case 'conditional':
        return {
          backgroundColor: currentStatus === 'conditional' ? '#FFC107' : '#FFF8E1',
          borderColor: '#FFC107',
          iconColor: currentStatus === 'conditional' ? 'white' : '#FFC107',
          textColor: currentStatus === 'conditional' ? 'white' : '#FFC107'
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

  const goingStyle = getStatusStyle('going');
  const maybeStyle = getStatusStyle('maybe');
  const conditionalStyle = getStatusStyle('conditional');
  const declinedStyle = getStatusStyle('declined');

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Your Status</Text>
        
        <View style={styles.statusButtons}>
          <AnimatedStatusButton
            status="going"
            currentStatus={currentStatus}
            label="Going"
            icon={<CheckCircle size={20} color={goingStyle.iconColor} />}
            color={goingStyle.iconColor}
            backgroundColor={goingStyle.backgroundColor}
            borderColor={goingStyle.borderColor}
            textColor={goingStyle.textColor}
            onPress={() => handleStatusChange('going')}
          />

          <AnimatedStatusButton
            status="maybe"
            currentStatus={currentStatus}
            label="Maybe"
            icon={<HelpCircle size={20} color={maybeStyle.iconColor} />}
            color={maybeStyle.iconColor}
            backgroundColor={maybeStyle.backgroundColor}
            borderColor={maybeStyle.borderColor}
            textColor={maybeStyle.textColor}
            onPress={() => handleStatusChange('maybe')}
          />

          <AnimatedStatusButton
            status="conditional"
            currentStatus={currentStatus}
            label="If..."
            icon={<Eye size={20} color={conditionalStyle.iconColor} />}
            color={conditionalStyle.iconColor}
            backgroundColor={conditionalStyle.backgroundColor}
            borderColor={conditionalStyle.borderColor}
            textColor={conditionalStyle.textColor}
            onPress={() => handleStatusChange('conditional')}
          />

          <AnimatedStatusButton
            status="declined"
            currentStatus={currentStatus}
            label="Can't go"
            icon={<X size={20} color={declinedStyle.iconColor} />}
            color={declinedStyle.iconColor}
            backgroundColor={declinedStyle.backgroundColor}
            borderColor={declinedStyle.borderColor}
            textColor={declinedStyle.textColor}
            onPress={() => handleStatusChange('declined')}
          />
        </View>

        {currentStatus === 'maybe' && (
          <View style={styles.disclaimerContainer}>
            <Text style={styles.disclaimerText}>
              {"You can't vote or edit this plan until you respond \"Going\"."}
            </Text>
          </View>
        )}

        {currentStatus === 'conditional' && (
          <View style={styles.disclaimerContainer}>
            {conditionalDependentFriends.length > 0 && (
              <>
                <Text style={styles.conditionalTermsTitle}>
                  {"Your status will be set to \"Going\" if these people come:"}
                </Text>
                <View style={styles.conditionalFriendsList}>
                  {conditionalDependentFriends.map((friend) => (
                    <View key={friend.id} style={styles.conditionalFriendItem}>
                      <CachedAvatar userId={friend.id} uri={friend.avatar} style={styles.conditionalAvatar} />
                      <Text style={styles.conditionalFriendName}>{friend.name}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.conditionalTermsSubtext}>
                  {"Until then your friends see you as \"Maybe\"."}
                </Text>
              </>
            )}
            <Text
              style={[
                styles.disclaimerText,
                conditionalDependentFriends.length > 0 && styles.conditionalDisclaimerAfterList,
              ]}
            >
              {"As \"If\", you can view but not vote or edit this plan until you respond \"Going\"."}
            </Text>
          </View>
        )}
      </View>

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
    color: 'black',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  conditionalTermsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
  },
  conditionalDisclaimerAfterList: {
    marginTop: 10,
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
    marginBottom: 4,
  },
});