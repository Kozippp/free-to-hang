import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Animated } from 'react-native';
import { CheckCircle, HelpCircle, Eye } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ParticipantStatus } from '@/store/plansStore';

interface PlanUserStatusProps {
  currentStatus: ParticipantStatus;
  onStatusChange: (status: ParticipantStatus) => void;
}

export default function PlanUserStatus({ currentStatus, onStatusChange }: PlanUserStatusProps) {
  const [statusAnimation] = useState(new Animated.Value(1));

  const handleStatusChange = (newStatus: ParticipantStatus) => {
    if (currentStatus === 'accepted' && newStatus !== 'accepted') {
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
            onPress: () => animateAndChangeStatus(newStatus)
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
    } else {
      animateAndChangeStatus(newStatus);
    }
  };

  const animateAndChangeStatus = (newStatus: ParticipantStatus) => {
    Animated.sequence([
      Animated.timing(statusAnimation, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(statusAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start(() => {
      onStatusChange(newStatus);
    });
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: statusAnimation }] }]}>
      <Text style={styles.title}>Your Status</Text>
      
      <View style={styles.statusButtons}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            currentStatus === 'accepted' && styles.selectedStatus
          ]}
          onPress={() => handleStatusChange('accepted')}
        >
          <CheckCircle size={20} color={currentStatus === 'accepted' ? Colors.light.primary : Colors.light.text} />
          <Text style={[
            styles.statusText,
            currentStatus === 'accepted' && styles.selectedStatusText
          ]}>
            Yes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            currentStatus === 'maybe' && styles.selectedStatus
          ]}
          onPress={() => handleStatusChange('maybe')}
        >
          <HelpCircle size={20} color={currentStatus === 'maybe' ? Colors.light.primary : Colors.light.text} />
          <Text style={[
            styles.statusText,
            currentStatus === 'maybe' && styles.selectedStatusText
          ]}>
            Maybe
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            currentStatus === 'conditional' && styles.selectedStatus
          ]}
          onPress={() => handleStatusChange('conditional')}
        >
          <Eye size={20} color={currentStatus === 'conditional' ? Colors.light.primary : Colors.light.text} />
          <Text style={[
            styles.statusText,
            currentStatus === 'conditional' && styles.selectedStatusText
          ]}>
            If...
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            currentStatus === 'declined' && styles.selectedStatus
          ]}
          onPress={() => handleStatusChange('declined')}
        >
          <Text style={[
            styles.statusText,
            currentStatus === 'declined' && styles.selectedStatusText
          ]}>
            No
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.buttonBackground,
  },
  selectedStatus: {
    backgroundColor: `${Colors.light.primary}20`,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 14,
    color: Colors.light.text,
  },
  selectedStatusText: {
    color: Colors.light.primary,
    fontWeight: '500',
  },
});