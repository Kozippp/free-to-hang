import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Users, CheckCircle, HelpCircle, Clock, Eye, EyeOff, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan } from '@/store/plansStore';

interface InvitationCardProps {
  plan: Plan;
  onPress: (plan: Plan) => void;
}

export default function InvitationCard({ plan, onPress }: InvitationCardProps) {
  const [currentTime, setCurrentTime] = React.useState(Date.now());

  // Update timer every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Get participants by status
  const acceptedParticipants = plan.participants.filter(p => 
    p.status === 'accepted' || p.status === 'maybe' || p.status === 'conditional'
  );
  
  // Get total participants excluding current user
  const totalParticipants = plan.participants.length - 1; // -1 for current user
  
  // Determine if this is an anonymous plan
  const isAnonymous = plan.type === 'anonymous';
  
  // Calculate response rate
  const responseRate = acceptedParticipants.length / totalParticipants;
  
  // Check for active invitation polls (not expired)
  const invitationPolls = plan.polls?.filter(poll => 
    poll.type === 'invitation' && 
    poll.expiresAt && 
    poll.expiresAt > currentTime
  ) || [];
  
  const hasActiveVoting = invitationPolls.length > 0;
  
  // Get time left for the first active poll
  const getTimeLeft = () => {
    if (invitationPolls.length === 0) return 0;
    const firstPoll = invitationPolls[0];
    return Math.max(0, (firstPoll.expiresAt || 0) - currentTime);
  };
  
  const formatTimeLeft = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };
  
  // Get creator's first name only
  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0];
  };
  
  // Get current user's status
  const currentUser = plan.participants.find(p => p.id === 'current');
  const currentUserStatus = currentUser?.status || 'pending';
  
  // Check if this plan was created by the current user
  const isCreatedByCurrentUser = plan.creator?.id === 'current';
  
  // Get status badge for the current user
  const getUserStatusBadge = () => {
    if (currentUserStatus === 'accepted') {
      return (
        <View style={[styles.statusBadge, styles.goingBadge]}>
          <CheckCircle size={12} color="white" style={styles.statusBadgeIcon} />
          <Text style={styles.statusBadgeText}>Going</Text>
        </View>
      );
    } else if (currentUserStatus === 'maybe') {
      return (
        <View style={[styles.statusBadge, styles.maybeBadge]}>
          <HelpCircle size={12} color="white" style={styles.statusBadgeIcon} />
          <Text style={styles.statusBadgeText}>Maybe</Text>
        </View>
      );
    } else if (currentUserStatus === 'conditional') {
      return (
        <View style={[styles.statusBadge, styles.conditionalBadge]}>
          <Clock size={12} color="white" style={styles.statusBadgeIcon} />
          <Text style={styles.statusBadgeText}>If</Text>
        </View>
      );
    }
    return null;
  };
  
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(plan)}
      activeOpacity={0.7}
    >
      {/* User status badge */}
      {currentUserStatus !== 'pending' && getUserStatusBadge()}
      
      <View style={styles.header}>
        <Text style={[
          styles.invitedBy,
          isCreatedByCurrentUser ? styles.createdByYouText : 
          isAnonymous ? styles.anonymousText : styles.invitedText
        ]}>
          {isCreatedByCurrentUser 
            ? "You suggested" 
            : isAnonymous 
              ? "Anonymous invitation to" 
              : `${getFirstName(plan.creator?.name || '')} invited you to`}
        </Text>
        <Text style={styles.title}>{plan.title}</Text>
      </View>
      
      {/* Active voting banner */}
      {hasActiveVoting && (
        <View style={styles.votingBanner}>
          <View style={styles.votingInfo}>
            <Clock size={14} color={Colors.light.warning} />
            <Text style={styles.votingText}>
              Vote to invite {invitationPolls.length} {invitationPolls.length === 1 ? 'person' : 'people'}
            </Text>
          </View>
          <Text style={styles.votingTimer}>
            {formatTimeLeft(getTimeLeft())}
          </Text>
        </View>
      )}
      
      <View style={styles.footer}>
        <View style={styles.participantsInfo}>
          <Users size={16} color={Colors.light.secondaryText} style={styles.icon} />
          <Text style={styles.participantsText}>
            {responseRate >= 0.5 
              ? `${acceptedParticipants.length} ${acceptedParticipants.length === 1 ? 'person' : 'people'} interested` 
              : `${totalParticipants} invited`}
          </Text>
        </View>
        
        <View style={styles.avatarsContainer}>
          {acceptedParticipants.slice(0, 3).map((participant, index) => (
            <View 
              key={participant.id} 
              style={[
                styles.avatarWrapper,
                { zIndex: 3 - index, marginLeft: index > 0 ? -12 : 0 }
              ]}
            >
              <Image source={{ uri: participant.avatar }} style={styles.avatar} />
              {/* Status indicator on avatar */}
              <View style={[
                styles.avatarStatus,
                participant.status === 'accepted' && styles.acceptedStatus,
                participant.status === 'maybe' && styles.maybeStatus,
                participant.status === 'conditional' && styles.conditionalStatus
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
              </View>
            </View>
          ))}
          
          {acceptedParticipants.length > 3 && (
            <View style={[styles.avatarWrapper, styles.moreAvatars, { marginLeft: -12 }]}>
              <Text style={styles.moreAvatarsText}>+{acceptedParticipants.length - 3}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  header: {
    marginBottom: 12,
  },
  invitedBy: {
    fontSize: 14,
    marginBottom: 4,
  },
  invitedText: {
    color: '#FFC107',
  },
  anonymousText: {
    color: Colors.light.secondary,
  },
  createdByYouText: {
    color: Colors.light.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  participantsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 42, // Increased size
    height: 42, // Increased size
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.light.background,
    position: 'relative',
  },
  avatar: {
    width: 38, // Increased size
    height: 38, // Increased size
    borderRadius: 19,
  },
  avatarStatus: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  acceptedStatus: {
    backgroundColor: Colors.light.onlineGreen,
  },
  maybeStatus: {
    backgroundColor: '#FFC107',
  },
  conditionalStatus: {
    backgroundColor: Colors.light.primary,
  },
  questionMark: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  moreAvatars: {
    backgroundColor: Colors.light.buttonBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAvatarsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeIcon: {
    marginRight: 4,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  goingBadge: {
    backgroundColor: Colors.light.onlineGreen,
  },
  maybeBadge: {
    backgroundColor: '#FFC107',
  },
  conditionalBadge: {
    backgroundColor: Colors.light.primary,
  },
  votingBanner: {
    backgroundColor: `${Colors.light.warning}15`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.warning,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  votingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  votingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.warning,
    marginLeft: 8,
  },
  votingTimer: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.warning,
    backgroundColor: `${Colors.light.warning}25`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});