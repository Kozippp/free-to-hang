import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Users, CheckCircle, HelpCircle, Clock, Eye, EyeOff, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan } from '@/store/plansStore';
import useUnseenStore from '@/store/unseenStore';
import { useAuth } from '@/contexts/AuthContext';
import CachedAvatar from '@/components/CachedAvatar';

interface InvitationCardProps {
  plan: Plan;
  onPress: (plan: Plan) => void;
}

export default function InvitationCard({ plan, onPress }: InvitationCardProps) {
  const [currentTime, setCurrentTime] = React.useState(Date.now());
  const { plans: unseenPlans } = useUnseenStore();
  const { user } = useAuth();
  const currentUserId = user?.id;
  
  const unseenTotal = unseenPlans[plan.id]?.total ?? 0;

  // Update timer every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // All participants except current user
  const otherParticipants = plan.participants.filter(p => p.id !== currentUserId);

  
  // Sort participants: going > maybe > conditional > pending
  const sortedParticipants = [...otherParticipants].sort((a, b) => {
    const statusScore = { going: 4, conditional: 3, maybe: 2, pending: 1, declined: 0 };
    return (statusScore[b.status as keyof typeof statusScore] || 0) - (statusScore[a.status as keyof typeof statusScore] || 0);
  });
  
  // Exclude declined
  const displayParticipants = sortedParticipants.filter(p => p.status !== 'declined');
  
  const acceptedParticipants = otherParticipants.filter(p => 
    p.status === 'going' || p.status === 'maybe' || p.status === 'conditional'
  );
  const goingParticipants = otherParticipants.filter(p => p.status === 'going');
  
  // Get total participants excluding current user
  const totalParticipants = otherParticipants.length;
  
  // Determine if this is an anonymous plan
  const isAnonymous = plan.type === 'anonymous';
  
  // Create FOMO text
  let fomoText = '';
  if (goingParticipants.length > 0) {
    fomoText = `${goingParticipants.length} going`;
    if (totalParticipants - goingParticipants.length > 0) {
      fomoText += `, ${totalParticipants - goingParticipants.length} invited`;
    }
  } else if (acceptedParticipants.length > 0) {
    fomoText = `${acceptedParticipants.length} interested, ${totalParticipants - acceptedParticipants.length} invited`;
  } else {
    fomoText = `${totalParticipants} invited`;
  }
  
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
  const currentUser = plan.participants.find(p => p.id === currentUserId);
  const currentUserStatus = currentUser?.status || 'pending';
  
  // Check if this plan was created by the current user
  const isCreatedByCurrentUser = plan.creator?.id === currentUserId || plan.creator?.id === 'current';
  
  // Get status badge for the current user
  const getUserStatusBadge = () => {
    if (currentUserStatus === 'pending') {
      return (
        <View style={[styles.statusBadge, styles.pendingBadge]}>
          <Clock size={12} color="white" style={styles.statusBadgeIcon} />
          <Text style={styles.statusBadgeText}>Invited</Text>
        </View>
      );
    } else if (currentUserStatus === 'going') {
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
          <Eye size={12} color="white" style={styles.statusBadgeIcon} />
          <Text style={styles.statusBadgeText}>If</Text>
        </View>
      );
    }
    return null;
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.card,
        !plan.isRead && styles.unreadCard,
        isAnonymous && !plan.isRead && styles.unreadAnonymousCard,
        !isAnonymous && !plan.isRead && styles.unreadRegularCard
      ]}
      onPress={() => onPress(plan)}
      activeOpacity={0.7}
    >
      {/* Unseen updates counter badge */}
      {unseenTotal > 0 && (
        <View style={styles.updateBadge}>
          <Text style={styles.updateBadgeText}>
            {unseenTotal > 99 ? '99+' : unseenTotal}
          </Text>
        </View>
      )}
      
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[
            styles.invitedBy,
            !plan.isRead && styles.unreadText,
            // Anonymous overrides all – even for creator
            isAnonymous ? styles.anonymousText : (isCreatedByCurrentUser ? styles.createdByYouText : styles.invitedText)
          ]}>
            {isAnonymous
              ? 'Anonymous invitation to'
              : (isCreatedByCurrentUser
                  ? 'You created this plan'
                  : `${getFirstName(plan.creator?.name || 'Someone')} invited you to`)}
          </Text>
          {getUserStatusBadge()}
        </View>
        <Text style={[styles.title, !plan.isRead && styles.unreadText]}>{plan.title}</Text>
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
            {fomoText}
          </Text>
        </View>
        
        <View style={styles.avatarsContainer}>
          {displayParticipants.slice(0, 3).map((participant, index) => (
            <View 
              key={participant.id} 
              style={[
                styles.avatarWrapper,
                { zIndex: 3 - index, marginLeft: index > 0 ? -12 : 0 },
              ]}
            >
              <CachedAvatar
                userId={participant.id}
                uri={participant.avatar}
                style={styles.avatar}
              />
              {/* Status indicator on avatar */}
              {participant.status !== 'pending' && (
                <View style={[
                  styles.avatarStatus,
                  participant.status === 'going' && styles.acceptedStatus,
                  participant.status === 'maybe' && styles.maybeStatus,
                  participant.status === 'conditional' && styles.conditionalStatus
                ]}>
                  {participant.status === 'going' && (
                    <Check size={10} color="white" />
                  )}
                  {participant.status === 'maybe' && (
                    <Text style={styles.questionMark}>?</Text>
                  )}
                  {participant.status === 'conditional' && (
                    <Eye size={10} color="white" />
                  )}
                </View>
              )}
            </View>
          ))}
          
          {displayParticipants.length > 3 && (
            <View style={[styles.avatarWrapper, styles.moreAvatars, { marginLeft: -12 }]}>
              <Text style={styles.moreAvatarsText}>+{displayParticipants.length - 3}</Text>
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
    borderRadius: 16, // More rounded corners for modern look
    padding: 16,
    marginBottom: 16, // Increased margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8E8E8', // Lighter default border
  },
  unreadCard: {
    borderWidth: 2,
    backgroundColor: `${Colors.light.primary}05`, // Very light tint of primary color
    shadowOpacity: 0.15, // stronger shadow
    shadowRadius: 10,
    elevation: 5,
  },
  unreadRegularCard: {
    borderColor: Colors.light.primary, // Make the primary color outline pop for new invitations
  },
  unreadAnonymousCard: {
    borderColor: Colors.light.secondary, // Red border for anonymous unread invitations
  },
  unreadText: {
    fontWeight: '700', // Make text bold for unread items
  },
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  invitedBy: {
    fontSize: 13, // Slightly smaller, cleaner
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  invitedText: {
    color: '#8E8E93', // More subtle than yellow
  },
  anonymousText: {
    color: Colors.light.secondary,
  },
  createdByYouText: {
    color: Colors.light.primary,
  },
  title: {
    fontSize: 20, // Slightly larger title
    fontWeight: '700', // Bolder title
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
    flex: 1,
  },
  icon: {
    marginRight: 6,
  },
  participantsText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.secondaryText,
    flexWrap: 'wrap',
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatarWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: Colors.light.background,
    position: 'relative',
    backgroundColor: Colors.light.background,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarStatus: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.background,
  },
  acceptedStatus: {
    backgroundColor: Colors.light.onlineGreen,
  },
  maybeStatus: {
    backgroundColor: '#FFC107',
  },
  conditionalStatus: {
    backgroundColor: '#FFC107',
  },
  questionMark: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  moreAvatars: {
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAvatarsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  statusBadge: {
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
    fontSize: 11,
    fontWeight: '700',
  },
  goingBadge: {
    backgroundColor: Colors.light.onlineGreen,
  },
  maybeBadge: {
    backgroundColor: '#FFC107',
  },
  conditionalBadge: {
    backgroundColor: '#FFC107',
  },
  pendingBadge: {
    backgroundColor: Colors.light.primary, // Highlight pending for FOMO
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
  updateBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    zIndex: 10,
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  updateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
});