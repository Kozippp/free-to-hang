import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, FlatList, Alert } from 'react-native';
import { UserPlus, X, Check, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Participant, Poll } from '@/store/plansStore';
import InvitationVotingPoll from './InvitationVotingPoll';

interface PlanParticipantsProps {
  acceptedParticipants: Participant[];
  maybeParticipants: Participant[];
  pendingParticipants: Participant[];
  invitationPolls: Poll[];
  onInvite: () => void;
  onInvitationVote: (pollId: string, optionId: string) => void;
  canInvite: boolean;
  isInYesGang: boolean;
}

export default function PlanParticipants({ 
  acceptedParticipants, 
  maybeParticipants, 
  pendingParticipants,
  invitationPolls,
  onInvite,
  onInvitationVote,
  canInvite,
  isInYesGang
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

      {/* Invitations Section - Exact same as before */}
      {invitationPolls.length > 0 ? (
        <View style={styles.invitationsSection}>
          <View style={styles.headerRow}>
            <UserPlus size={20} color={Colors.light.text} style={styles.headerIcon} />
            <Text style={styles.sectionTitle}>Invitations</Text>
          </View>
          
          <Text style={[styles.invitationDescription, { marginTop: -8 }]}>
            Active vote to invite these people is happening. Cast your vote and majority decides.
          </Text>
          
          {/* Active invitation votes - using exact same component as before */}
          {invitationPolls.map((poll) => {
            const invitedUsers = poll.invitedUsers?.map(userId => {
              // Mock data for invited users - in real app this would come from user store
              return {
                id: userId,
                name: `User ${userId}`,
                avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face`
              };
            }) || [];

            const hasUserVoted = poll.options.some(option => 
              option.votes.includes('current')
            );

            return (
              <InvitationVotingPoll
                key={poll.id}
                poll={poll}
                onVote={(pollId, optionId) => {
                  // Only allow voting if user is "going"
                  if (isInYesGang) {
                    onInvitationVote(pollId, optionId);
                  }
                }}
                userVoted={hasUserVoted}
                invitedUsers={invitedUsers}
                canVote={isInYesGang}
              />
            );
          })}
          
          {/* Invite more people button at bottom */}
          <TouchableOpacity 
            style={[
              styles.inviteMoreButton,
              !isInYesGang && styles.disabledCreateButton
            ]}
            onPress={onInvite}
            disabled={!isInYesGang}
          >
            <UserPlus size={16} color={isInYesGang ? Colors.light.primary : Colors.light.secondaryText} />
            <Text style={[
              styles.inviteMoreButtonText,
              !isInYesGang && styles.disabledCreateButtonText
            ]}>
              Invite more people
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Simple invite button when no active votes */
        isInYesGang && (
          <TouchableOpacity 
            style={styles.simpleInviteButton}
            onPress={onInvite}
          >
            <UserPlus size={16} color={Colors.light.primary} />
            <Text style={styles.simpleInviteButtonText}>
              Invite more people
            </Text>
          </TouchableOpacity>
        )
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
  invitationsSection: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIcon: {
    marginRight: 8,
  },
  invitationDescription: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  inviteMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.light.primary}15`,
    paddingVertical: 12,
    borderRadius: 8,
  },
  inviteMoreButtonText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
    marginLeft: 8,
  },
  disabledCreateButton: {
    backgroundColor: Colors.light.buttonBackground,
  },
  disabledCreateButtonText: {
    color: Colors.light.secondaryText,
  },
  simpleInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  simpleInviteButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    marginLeft: 8,
  },
});