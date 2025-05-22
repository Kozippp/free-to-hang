import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import { Clock, CheckCircle, XCircle, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Poll } from '@/store/plansStore';

interface InvitationVotingPollProps {
  poll: Poll;
  onVote: (pollId: string, optionId: string) => void;
  userVoted: boolean;
  invitedUsers: {
    id: string;
    name: string;
    avatar: string;
  }[];
}

export default function InvitationVotingPoll({
  poll,
  onVote,
  userVoted,
  invitedUsers
}: InvitationVotingPollProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!poll.expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, poll.expiresAt! - now);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [poll.expiresAt]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isExpired = timeLeft === 0;
  const allowOption = poll.options.find(opt => opt.text === 'Allow');
  const denyOption = poll.options.find(opt => opt.text === 'Deny');
  
  const allowVotes = allowOption?.votes.length || 0;
  const denyVotes = denyOption?.votes.length || 0;
  const totalVotes = allowVotes + denyVotes;

  const handleVote = (optionId: string) => {
    if (isExpired || userVoted) return;
    
    Alert.alert(
      'Anonymous Vote',
      'Your vote will be anonymous. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Vote', 
          onPress: () => onVote(poll.id, optionId)
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Users size={18} color={Colors.light.primary} />
        <Text style={styles.title}>Invitation Vote</Text>
        {!isExpired && (
          <View style={styles.timer}>
            <Clock size={14} color={Colors.light.warning} />
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.question}>{poll.question}</Text>

      {/* Invited users */}
      <View style={styles.invitedUsersContainer}>
        {invitedUsers.map((user, index) => (
          <View key={user.id} style={[styles.userAvatar, { marginLeft: index > 0 ? -8 : 0 }]}>
            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          </View>
        ))}
        {invitedUsers.length > 3 && (
          <View style={[styles.userAvatar, styles.moreUsers, { marginLeft: -8 }]}>
            <Text style={styles.moreUsersText}>+{invitedUsers.length - 3}</Text>
          </View>
        )}
      </View>

      {/* Voting options */}
      <View style={styles.votingContainer}>
        <TouchableOpacity
          style={[
            styles.voteButton,
            styles.allowButton,
            userVoted && styles.disabledButton
          ]}
          onPress={() => allowOption && handleVote(allowOption.id)}
          disabled={isExpired || userVoted}
        >
          <CheckCircle size={20} color={isExpired || userVoted ? Colors.light.secondaryText : '#4CAF50'} />
          <Text style={[
            styles.voteButtonText,
            { color: isExpired || userVoted ? Colors.light.secondaryText : '#4CAF50' }
          ]}>
            Allow ({allowVotes})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.voteButton,
            styles.denyButton,
            userVoted && styles.disabledButton
          ]}
          onPress={() => denyOption && handleVote(denyOption.id)}
          disabled={isExpired || userVoted}
        >
          <XCircle size={20} color={isExpired || userVoted ? Colors.light.secondaryText : '#F44336'} />
          <Text style={[
            styles.voteButtonText,
            { color: isExpired || userVoted ? Colors.light.secondaryText : '#F44336' }
          ]}>
            Deny ({denyVotes})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={styles.statusContainer}>
        {isExpired && (
          <Text style={styles.statusText}>
            Vote ended • {allowVotes > denyVotes ? 'Invitation approved' : 'Invitation denied'}
          </Text>
        )}
        {userVoted && !isExpired && (
          <Text style={styles.statusText}>You have voted • {totalVotes} votes cast</Text>
        )}
        {!userVoted && !isExpired && (
          <Text style={styles.statusText}>Anonymous voting • {totalVotes} votes cast</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: `${Colors.light.primary}08`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 8,
    flex: 1,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.light.warning}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.warning,
    marginLeft: 4,
  },
  question: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 12,
  },
  invitedUsersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.light.background,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  moreUsers: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreUsersText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  votingContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
  },
  allowButton: {
    borderColor: '#4CAF50',
  },
  denyButton: {
    borderColor: '#F44336',
  },
  disabledButton: {
    opacity: 0.5,
    borderColor: Colors.light.border,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
  },
}); 