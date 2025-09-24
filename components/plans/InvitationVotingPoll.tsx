import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Clock, Check, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { InvitationPoll } from '@/lib/plans-service';

interface InvitationVotingPollProps {
  poll: InvitationPoll;
  onVote: (pollId: string, vote: 'allow' | 'deny') => void;
  canVote: boolean;
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
  canVote
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

  const acceptBadgeStyle = [
    styles.voteCountBadge,
    acceptSelected ? styles.voteCountBadgeSelected : styles.voteCountBadgeAccept,
    isDisabled && styles.voteCountBadgeDisabled
  ] as const;

  const denyBadgeStyle = [
    styles.voteCountBadge,
    denySelected ? styles.voteCountBadgeSelected : styles.voteCountBadgeDeny,
    isDisabled && styles.voteCountBadgeDisabled
  ] as const;

  const acceptCountTextStyle = [
    styles.voteCountText,
    acceptSelected ? styles.voteCountTextSelected : styles.voteCountTextAccept,
    isDisabled && styles.voteCountTextDisabled
  ] as const;

  const denyCountTextStyle = [
    styles.voteCountText,
    denySelected ? styles.voteCountTextSelected : styles.voteCountTextDeny,
    isDisabled && styles.voteCountTextDisabled
  ] as const;

  return (
    <View style={styles.voteBlock}>
      {/* User info and voting in one row */}
      <View style={styles.voteRow}>
        {/* User info */}
        <View style={styles.userInfo}>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
          <Text style={styles.userName}>{user.name}</Text>
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
              <View style={acceptBadgeStyle}>
                <Text style={acceptCountTextStyle}>{allowVotes}</Text>
              </View>
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
              <View style={denyBadgeStyle}>
                <Text style={denyCountTextStyle}>{denyVotes}</Text>
              </View>
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
  canVote
}: InvitationVotingPollProps) {
  const [timeLeft, setTimeLeft] = useState(0);

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

  const handleVote = (accept: boolean) => {
    if (isExpired || !canVote) return;

    const vote = accept ? 'allow' : 'deny';
    onVote(poll.id, vote);
  };

  return (
    <View style={styles.container}>
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
      />
    </View>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 50,
    justifyContent: 'center',
  },
  acceptButton: {
    borderColor: '#4CAF50',
    backgroundColor: 'transparent',
  },
  denyButton: {
    borderColor: '#F44336',
    backgroundColor: 'transparent',
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
    borderWidth: 2,
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scaleX: 1.05 }, { scaleY: 1.05 }],
    marginHorizontal: -2, // kompenseerime scale'i poolt lisatud ruumi
  },
  selectedDenyButton: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
    borderWidth: 2,
    shadowColor: '#F44336',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scaleX: 1.05 }, { scaleY: 1.05 }],
    marginHorizontal: -2, // kompenseerime scale'i poolt lisatud ruumi
  },
  disabledButton: {
    opacity: 0.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.buttonBackground,
  },
  voteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voteCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  voteCountBadgeAccept: {
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
  },
  voteCountBadgeDeny: {
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
  },
  voteCountBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  voteCountBadgeDisabled: {
    backgroundColor: Colors.light.buttonBackground,
  },
  voteCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  voteCountTextAccept: {
    color: '#4CAF50',
  },
  voteCountTextDeny: {
    color: '#F44336',
  },
  voteCountTextSelected: {
    color: 'white',
  },
  voteCountTextDisabled: {
    color: Colors.light.secondaryText,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
}); 