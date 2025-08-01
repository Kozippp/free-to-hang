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
  isRealTimeUpdate?: boolean; // New prop to indicate if this is a real-time update
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
  isRealTimeUpdate = false
}: PollDisplayProps) {
  const [animatedValues] = useState(() => {
    const values: Record<string, Animated.Value> = {};
    options.forEach(option => {
      values[option.id] = new Animated.Value(0);
    });
    return values;
  });

  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    options.forEach(option => {
      counts[option.id] = option.voters.length;
    });
    return counts;
  });

  // Use ref to prevent unnecessary re-renders during animations
  const isAnimatingRef = useRef(false);

  // Update vote counts when options change (for real-time updates)
  React.useEffect(() => {
    const newCounts: Record<string, number> = {};
    let hasChanges = false;
    
    options.forEach(option => {
      const oldCount = voteCounts[option.id] || 0;
      const newCount = option.voters.length;
      
      // If vote count increased, trigger +1 animation
      if (newCount > oldCount && isRealTimeUpdate) {
        hasChanges = true;
        isAnimatingRef.current = true;
        
        // Trigger a quick pulse animation for the increased vote
        Animated.sequence([
          Animated.timing(animatedValues[option.id], {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValues[option.id], {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          })
        ]).start(() => {
          isAnimatingRef.current = false;
        });
      }
      
      newCounts[option.id] = newCount;
    });
    
    // Only update if there are actual changes and we're not in the middle of an animation
    const currentCountsString = JSON.stringify(voteCounts);
    const newCountsString = JSON.stringify(newCounts);
    
    if ((hasChanges || currentCountsString !== newCountsString) && !isAnimatingRef.current) {
      setVoteCounts(newCounts);
    }
  }, [options, isRealTimeUpdate, animatedValues]); // Removed voteCounts from dependencies

  // Ensure all options have animation values
  React.useEffect(() => {
    options.forEach(option => {
      if (!animatedValues[option.id]) {
        animatedValues[option.id] = new Animated.Value(0);
      }
    });
  }, [options, animatedValues]);

  // Real-time update animation - only animate options that actually changed
  React.useEffect(() => {
    if (isRealTimeUpdate && !isAnimatingRef.current) {
      // Only animate options that have vote count changes
      const animations = options.map(option => {
        const oldCount = voteCounts[option.id] || 0;
        const newCount = option.voters.length;
        
        if (newCount > oldCount && animatedValues[option.id]) {
          return Animated.sequence([
            Animated.timing(animatedValues[option.id], {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(animatedValues[option.id], {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            })
          ]);
        }
        return null;
      }).filter(Boolean);
      
      if (animations.length > 0) {
        Animated.parallel(animations).start();
      }
    }
  }, [isRealTimeUpdate, options, animatedValues]); // Removed voteCounts to prevent infinite loop

  const handleVote = (optionId: string) => {
    if (!canVote) {
      Alert.alert(
        'Cannot Vote',
        'You need to respond "Going" to the plan to vote in polls and suggest changes.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // Animate only the clicked option
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

  const getPercentage = (voters: PollOption['voters']) => {
    return totalVoters > 0 ? Math.round((voters.length / totalVoters) * 100) : 0;
  };

  // Sort options by vote count (descending)
  const sortedOptions = [...options].sort((a, b) => b.voters.length - a.voters.length);
  
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

  return (
    <View style={styles.container}>
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
          const percentage = getPercentage(option.voters);
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
                      <View style={styles.percentageContainer}>
                        <Text style={[
                          styles.percentageText,
                          isSelected && styles.selectedPercentageText,
                          isWinningOption && styles.winningPercentageText
                        ]}>
                          {percentage}%
                        </Text>
                        {isRealTimeUpdate && option.voters.length > (voteCounts[option.id] || 0) && (
                          <Animated.View
                            style={[
                              styles.newVoteIndicator,
                              {
                                opacity: animatedValues[option.id]?.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 1],
                                }) || 0,
                                transform: [
                                  {
                                    scale: animatedValues[option.id]?.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [0.8, 1.2],
                                    }) || 1,
                                  },
                                ],
                              }
                            ]}
                          >
                            <Text style={styles.newVoteText}>+1</Text>
                          </Animated.View>
                        )}
                      </View>
                      
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
  percentageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  newVoteIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newVoteText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
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