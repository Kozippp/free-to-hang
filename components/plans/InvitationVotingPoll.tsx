import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { Clock, Check, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { InvitationPoll } from '@/lib/plans-service';

interface InvitationVotingPollProps {
  poll: InvitationPoll;
  onVote: (pollId: string, vote: 'allow' | 'deny') => void;
  canVote: boolean;
  onExpired?: (pollId: string) => void;
}

interface IndividualVoteBlockProps {
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  timeLeft: number;
  onVote: (accept: boolean) => void;
  userVoted: boolean;
  allowVotes: number;
  denyVotes: number;
  isExpired: boolean;
  userVoteChoice: 'accept' | 'deny' | null;
  canVote: boolean;
  showExpiredAnimation: boolean;
}

function IndividualVoteBlock({
  user,
  timeLeft,
  onVote,
  userVoted,
  allowVotes,
  denyVotes,
  isExpired,
  userVoteChoice,
  canVote,
  showExpiredAnimation
}: IndividualVoteBlockProps) {
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isDisabled = isExpired || !canVote;
  const acceptSelected = userVoteChoice === 'accept';
  const denySelected = userVoteChoice === 'deny';

  const acceptIconColor = acceptSelected
    ? 'white'
    : isDisabled
      ? Colors.light.secondaryText
      : '#4CAF50';

  const denyIconColor = denySelected
    ? 'white'
    : isDisabled
      ? Colors.light.secondaryText
      : '#F44336';

  const acceptCountTextStyle = [
    styles.countText,
    acceptSelected ? styles.countTextSelected : styles.countTextAccept,
    isDisabled && styles.countTextDisabled
  ];

  const denyCountTextStyle = [
    styles.countText,
    denySelected ? styles.countTextSelected : styles.countTextDeny,
    isDisabled && styles.countTextDisabled
  ];

  return (
    <View style={styles.voteBlock}>
      {/* User info and voting in one row */}
      <View style={styles.voteRow}>
        {/* User info */}
        <View style={styles.userInfo}>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
          <Text style={[
            styles.userName,
            showExpiredAnimation && styles.userNameExpired
          ]}>{user.name}</Text>
        </View>

        {/* Timer */}
        {!isExpired && (
          <View style={styles.timer}>
            <Clock size={12} color={Colors.light.warning} />
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
          </View>
        )}

        {/* Vote buttons */}
        <View style={styles.voteButtons}>
          <TouchableOpacity
            style={[
              styles.voteButton,
              styles.acceptButton,
              userVoteChoice === 'accept' && [
                styles.selectedButton,
                { backgroundColor: '#4CAF50', borderColor: '#4CAF50', borderWidth: 2 }
              ],
              (isExpired || !canVote) && styles.disabledButton
            ]}
            onPress={() => {
              if (!canVote) {
                Alert.alert(
                  'Cannot Vote',
                  'You need to respond "Going" to the plan to vote on invitations.',
                  [{ text: 'OK' }]
                );
                return;
              }
              onVote(true);
            }}
            disabled={isExpired || !canVote}
          >
            <View style={styles.voteButtonContent}>
              <Check size={16} color={acceptIconColor} />
              <Text style={acceptCountTextStyle}>{String(allowVotes ?? 0)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.voteButton,
              styles.denyButton,
              userVoteChoice === 'deny' && [
                styles.selectedDenyButton,
                { backgroundColor: '#F44336', borderColor: '#F44336', borderWidth: 2 }
              ],
              (isExpired || !canVote) && styles.disabledButton
            ]}
            onPress={() => {
              if (!canVote) {
                Alert.alert(
                  'Cannot Vote',
                  'You need to respond "Going" to the plan to vote on invitations.',
                  [{ text: 'OK' }]
                );
                return;
              }
              onVote(false);
            }}
            disabled={isExpired || !canVote}
          >
            <View style={styles.voteButtonContent}>
              <X size={16} color={denyIconColor} />
              <Text style={denyCountTextStyle}>{String(denyVotes ?? 0)}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function InvitationVotingPoll({
  poll,
  onVote,
  canVote,
  onExpired
}: InvitationVotingPollProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [expiredNotified, setExpiredNotified] = useState(false);
  const [showExpiredAnimation, setShowExpiredAnimation] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!poll.expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, new Date(poll.expiresAt).getTime() - Date.now());
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [poll.expiresAt]);

  const isExpired = timeLeft === 0;

  // Handle poll expiration and animation
  useEffect(() => {
    if (isExpired && !expiredNotified) {
      setExpiredNotified(true);
      setShowExpiredAnimation(true);

      // Notify parent for real-time updates
      if (onExpired) {
        onExpired(poll.id);
      }

      // Start fade-out animation immediately when poll expires
      // This provides immediate feedback while database processing happens
      const animationTimeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 100); // Small delay to show final result briefly

      return () => clearTimeout(animationTimeout);
    }
  }, [isExpired, expiredNotified, onExpired, poll.id, fadeAnim, scaleAnim]);

  const handleVote = (accept: boolean) => {
    if (isExpired || !canVote) return;

    const vote = accept ? 'allow' : 'deny';
    onVote(poll.id, vote);
  };

  return (
    <Animated.View style={[
      styles.container,
      {
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }]
      }
    ]}>
      <IndividualVoteBlock
        user={poll.invitedUser}
        timeLeft={timeLeft}
        onVote={handleVote}
        userVoted={!!poll.currentUserVote}
        allowVotes={poll.allowVotes}
        denyVotes={poll.denyVotes}
        isExpired={isExpired}
        userVoteChoice={poll.currentUserVote === 'allow' ? 'accept' : poll.currentUserVote === 'deny' ? 'deny' : null}
        canVote={canVote}
        showExpiredAnimation={showExpiredAnimation}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  voteBlock: {
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: 0,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  userNameExpired: {
    color: '#4CAF50', // Green color for successful invitation
    fontWeight: '600',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.light.warning}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 12,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.warning,
    marginLeft: 2,
  },
  voteButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 50,
    justifyContent: 'center',
  },
  acceptButton: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
  },
  denyButton: {
    borderColor: '#F44336',
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  selectedDenyButton: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
    borderWidth: 2,
  },
  disabledButton: {
    opacity: 0.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.buttonBackground,
  },
  voteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
  },
  countTextAccept: {
    color: '#4CAF50',
  },
  countTextDeny: {
    color: '#F44336',
  },
  countTextSelected: {
    color: 'white',
  },
  countTextDisabled: {
    color: Colors.light.secondaryText,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
}); 