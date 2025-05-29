import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Animated
} from 'react-native';
import { Check, Crown, Edit2, Users, Trash2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import useNotificationsStore from '@/store/notificationsStore';
import NotificationDot from '@/components/NotificationDot';

interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: {
    id: string;
    name: string;
    avatar: string;
  }[];
}

interface PollDisplayProps {
  question: string;
  options: PollOption[];
  onVote: (optionId: string) => void;
  userVotes: string[];
  totalVotes: number;
  canVote: boolean;
  onEdit?: () => void;
  totalGoingParticipants?: number; // Total number of people going to the plan
  hideQuestion?: boolean; // New prop to hide question for preset polls
  onDelete?: () => void; // New prop for deleting custom polls
  pollId?: string; // Poll ID for notifications
  planId?: string; // Plan ID for notifications
}

export default function PollDisplay({
  question,
  options,
  onVote,
  userVotes,
  totalVotes,
  canVote,
  onEdit,
  totalGoingParticipants = 0,
  hideQuestion = false,
  onDelete,
  pollId,
  planId
}: PollDisplayProps) {
  const { getNotificationCounts } = useNotificationsStore();
  const [animatedValues] = useState(() => {
    const values: Record<string, Animated.Value> = {};
    options.forEach(option => {
      values[option.id] = new Animated.Value(0);
    });
    return values;
  });

  // Ensure all options have animation values
  React.useEffect(() => {
    options.forEach(option => {
      if (!animatedValues[option.id]) {
        animatedValues[option.id] = new Animated.Value(0);
      }
    });
  }, [options, animatedValues]);

  const handleVote = (optionId: string) => {
    if (!canVote) {
      Alert.alert(
        'Cannot Vote',
        'You need to respond "Going" to the plan to vote in polls and suggest changes.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // Animate the selection only if animation value exists
    if (animatedValues[optionId]) {
      Animated.sequence([
        Animated.timing(animatedValues[optionId], {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues[optionId], {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }

    onVote(optionId);
  };

  // Calculate statistics
  const getTotalVoters = () => {
    const uniqueVoters = new Set<string>();
    options.forEach(option => {
      option.voters.forEach(voter => {
        uniqueVoters.add(voter.id);
      });
    });
    return uniqueVoters.size;
  };

  const totalVoters = getTotalVoters();
  const goingParticipants = Math.max(totalGoingParticipants, totalVoters);

  const getPercentage = (votes: number) => {
    return totalVoters > 0 ? Math.round((votes / totalVoters) * 100) : 0;
  };

  // Sort options by vote count (descending)
  const sortedOptions = [...options].sort((a, b) => b.votes - a.votes);
  
  // Dynamic threshold algorithm for determining winner
  const getWinnerThreshold = () => {
    const participantThreshold = 0.4 * goingParticipants;
    const voterThreshold = 0.7 * totalVoters;
    return Math.ceil(Math.min(participantThreshold, voterThreshold));
  };

  const winnerThreshold = getWinnerThreshold();
  const maxVotes = Math.max(...options.map(option => option.votes));
  const minParticipation = Math.min(3, goingParticipants);
  
  // Find all options with the maximum votes that meet ALL criteria
  const topOptions = options.filter(option => 
    option.votes === maxVotes && 
    option.votes >= winnerThreshold && 
    option.votes > 0 &&
    totalVoters >= minParticipation
  );
  
  // Randomly select one winner from top options to avoid confusion
  const selectedWinner = React.useMemo(() => {
    if (topOptions.length === 0) return null;
    if (topOptions.length === 1) return topOptions[0];
    
    // Use a stable random selection based on option IDs to ensure consistency
    const sortedTopOptions = [...topOptions].sort((a, b) => a.id.localeCompare(b.id));
    const randomIndex = Math.abs(sortedTopOptions[0].id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % sortedTopOptions.length;
    return sortedTopOptions[randomIndex];
  }, [topOptions]);
  
  // An option is winning if it's the selected winner
  const isWinning = (optionId: string) => {
    return selectedWinner?.id === optionId;
  };

  // Check if any option qualifies as winner
  const hasWinner = selectedWinner !== null;
  const isRandomlySelected = topOptions.length > 1;

  // Render voters avatars
  const VotersAvatars = ({ voters }: { voters: PollOption['voters'] }) => {
    const displayVoters = voters.slice(0, 3);
    const remainingCount = voters.length - 3;

    if (voters.length === 0) return null;

    return (
      <View style={styles.votersContainer}>
        {displayVoters.map((voter, index) => (
          <View 
            key={voter.id} 
            style={[
              styles.voterAvatar,
              { marginLeft: index > 0 ? -10 : 0, zIndex: 3 - index }
            ]}
          >
            <Image 
              source={{ uri: voter.avatar }} 
              style={styles.avatarImage} 
            />
          </View>
        ))}
        
        {remainingCount > 0 && (
          <View style={[styles.voterAvatar, styles.moreVoters, { marginLeft: -10 }]}>
            <Text style={styles.moreVotersText}>+{remainingCount}</Text>
          </View>
        )}
      </View>
    );
  };

  // Get notification count for this specific poll
  const getPollNotificationCount = () => {
    if (!pollId || !planId) return 0;
    const { notifications } = useNotificationsStore.getState();
    return notifications.filter(n => 
      !n.isRead && 
      n.planId === planId && 
      n.pollId === pollId
    ).length;
  };

  return (
    <View style={styles.container}>
      {/* Notification dot for this poll */}
      {pollId && planId && (
        <NotificationDot 
          count={getPollNotificationCount()}
          size="small"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10,
          }}
        />
      )}
      
      {/* Header with question and stats - only show if not hidden */}
      {!hideQuestion && (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.question}>{question}</Text>
            <View style={styles.headerActions}>
              {canVote && onEdit && (
                <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                  <Edit2 size={16} color={Colors.light.secondaryText} />
                </TouchableOpacity>
              )}
              {canVote && onDelete && (
                <TouchableOpacity 
                  onPress={() => {
                    Alert.alert(
                      'Delete Poll',
                      'Are you sure you want to delete this poll? This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: onDelete }
                      ]
                    );
                  }} 
                  style={styles.actionButton}
                >
                  <Trash2 size={16} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Voting stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statsItem}>
              <Users size={14} color={Colors.light.secondaryText} />
              <Text style={styles.statsText}>
                {totalVoters} out of {goingParticipants} voted
              </Text>
            </View>
            {!hasWinner && totalVoters > 0 && (
              <Text style={styles.awaitingText}>
                Awaiting more votes…
              </Text>
            )}
            {hasWinner && isRandomlySelected && (
              <Text style={styles.randomSelectionText}>
                Winner selected randomly from top voted options
              </Text>
            )}
          </View>
        </>
      )}
      
      {/* Stats and edit button for hidden question polls */}
      {hideQuestion && (
        <View style={styles.compactHeader}>
          <View style={styles.compactStatsContainer}>
            <View style={styles.statsItem}>
              <Users size={14} color={Colors.light.secondaryText} />
              <Text style={styles.statsText}>
                {totalVoters} out of {goingParticipants} voted
              </Text>
            </View>
            {!hasWinner && totalVoters > 0 && (
              <Text style={styles.awaitingText}>
                Awaiting more votes…
              </Text>
            )}
            {hasWinner && isRandomlySelected && (
              <Text style={styles.randomSelectionText}>
                Winner selected randomly from top voted options
              </Text>
            )}
          </View>
          {canVote && onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
              <Edit2 size={16} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Vertical options list */}
      <View style={[styles.optionsContainer, hideQuestion && styles.compactOptionsContainer]}>
        {sortedOptions.map((option, index) => {
          const percentage = getPercentage(option.votes);
          const isSelected = userVotes.includes(option.id);
          const isWinningOption = isWinning(option.id);
          
          return (
            <Animated.View
              key={option.id}
              style={[
                styles.optionRow,
                isSelected && styles.selectedOptionRow,
                isWinningOption && styles.winningOptionRow,
                {
                  transform: [
                    {
                      scale: animatedValues[option.id]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.98],
                      }) || 1,
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleVote(option.id)}
                activeOpacity={0.8}
              >
                {/* Check mark for selected - top left corner */}
                {isSelected && (
                  <View style={styles.checkmarkTopLeft}>
                    <Check size={12} color="white" />
                  </View>
                )}
                
                <View style={styles.optionContent}>
                  <View style={styles.optionLeft}>
                    {/* Crown for winner */}
                    {isWinningOption && (
                      <View style={styles.crownContainer}>
                        <Crown size={14} color="#FFD700" fill="#FFD700" />
                      </View>
                    )}
                    
                    {/* Option text */}
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                      isWinningOption && styles.winningOptionText,
                    ]}>
                      {option.text}
                    </Text>
                  </View>
                  
                  <View style={styles.optionRight}>
                    {/* Percentage and voters in column */}
                    <View style={styles.rightColumn}>
                      <Text style={[
                        styles.percentageText,
                        isSelected && styles.selectedPercentageText,
                        isWinningOption && styles.winningPercentageText
                      ]}>
                        {percentage}%
                      </Text>
                      
                      {/* Voters avatars under percentage */}
                      <VotersAvatars voters={option.voters} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    position: 'relative',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  statsContainer: {
    marginBottom: 16,
  },
  statsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsText: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  optionsContainer: {
    gap: 8,
  },
  compactOptionsContainer: {
    gap: 6,
  },
  optionRow: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedOptionRow: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}05`,
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  winningOptionRow: {
    borderColor: '#FFD700',
    backgroundColor: '#FFF9E6',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  optionButton: {
    padding: 0,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  crownContainer: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    flex: 1,
  },
  selectedOptionText: {
    fontWeight: '600',
    color: Colors.light.primary,
  },
  winningOptionText: {
    fontWeight: '700',
    color: '#B8860B',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightColumn: {
    alignItems: 'center',
    gap: 6,
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  selectedPercentageText: {
    color: Colors.light.primary,
  },
  winningPercentageText: {
    color: '#B8860B',
  },
  votersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'white',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  moreVoters: {
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreVotersText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkmarkTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  awaitingText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.secondaryText,
    marginTop: 4,
  },
  randomSelectionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.secondaryText,
    marginTop: 4,
  },
  compactStatsContainer: {
    flex: 1,
  },
});