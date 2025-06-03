import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, FlatList } from 'react-native';
import { UserPlus, X, Check, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Participant } from '@/store/plansStore';

interface PlanParticipantsProps {
  acceptedParticipants: Participant[];
  maybeParticipants: Participant[];
  pendingParticipants: Participant[];
  onInvite: () => void;
  canInvite: boolean;
}

export default function PlanParticipants({ 
  acceptedParticipants, 
  maybeParticipants, 
  pendingParticipants,
  onInvite,
  canInvite
}: PlanParticipantsProps) {
  const renderParticipant = (participant: Participant) => {
    return (
      <View key={participant.id} style={styles.participantRow}>
        <View style={styles.participantInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: participant.avatar }} style={styles.avatar} />
            <View style={[
              styles.statusIndicator,
              participant.status === 'accepted' && styles.acceptedIndicator,
              participant.status === 'maybe' && styles.maybeIndicator,
              participant.status === 'conditional' && styles.conditionalIndicator,
              participant.status === 'pending' && styles.pendingIndicator,
            ]}>
              {participant.status === 'accepted' && (
                <Check size={10} color="white" />
              )}
              {participant.status === 'maybe' && (
                <Text style={styles.questionMark}>?</Text>
              )}
              {participant.status === 'conditional' && (
                <Clock size={10} color="white" />
              )}
              {participant.status === 'pending' && (
                <View style={styles.eyeIcon}>
                  <View style={styles.eyePupil} />
                </View>
              )}
            </View>
          </View>
          <Text style={styles.participantName}>
            {participant.name}{participant.id === 'current' ? ' (you)' : ''}
          </Text>
        </View>
        
        {canInvite && participant.id !== 'current' && (
          <TouchableOpacity style={styles.removeButton}>
            <X size={16} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Who's In</Text>
      
      <View style={styles.participantsContainer}>
        {acceptedParticipants.length > 0 && (
          <View style={styles.participantGroup}>
            <Text style={styles.groupTitle}>Going ({acceptedParticipants.length})</Text>
            {acceptedParticipants.map(renderParticipant)}
          </View>
        )}
        
        {maybeParticipants.length > 0 && (
          <View style={styles.participantGroup}>
            <Text style={styles.groupTitle}>Maybe ({maybeParticipants.length})</Text>
            {maybeParticipants.map(renderParticipant)}
          </View>
        )}
        
        {pendingParticipants.length > 0 && (
          <View style={styles.participantGroup}>
            <Text style={styles.groupTitle}>Not Responded ({pendingParticipants.length})</Text>
            {pendingParticipants.map(renderParticipant)}
          </View>
        )}
      </View>
      
      {canInvite && (
        <TouchableOpacity 
          style={styles.inviteButton}
          onPress={onInvite}
        >
          <UserPlus size={16} color={Colors.light.primary} style={styles.inviteIcon} />
          <Text style={styles.inviteText}>Invite more people</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  participantsContainer: {
    marginBottom: 16,
  },
  participantGroup: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  participantInfo: {
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
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  acceptedIndicator: {
    backgroundColor: Colors.light.onlineGreen,
  },
  maybeIndicator: {
    backgroundColor: '#FFC107',
  },
  conditionalIndicator: {
    backgroundColor: Colors.light.primary,
  },
  pendingIndicator: {
    backgroundColor: Colors.light.offlineGray,
  },
  questionMark: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  eyeIcon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyePupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.offlineGray,
  },
  participantName: {
    fontSize: 14,
    color: Colors.light.text,
  },
  removeButton: {
    padding: 8,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.light.primary}15`,
    paddingVertical: 12,
    borderRadius: 8,
  },
  inviteIcon: {
    marginRight: 8,
  },
  inviteText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
});