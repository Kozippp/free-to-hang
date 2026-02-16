import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  ActivityIndicator
} from 'react-native';
import { Check, Edit2, Users, Trash2 } from 'lucide-react-native';
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
  pollId: string; // Add pollId for identification
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
  isLoading?: boolean; // New prop to show loading state on the poll
  loadingText?: string; // Custom loading text
  readOnly?: boolean; // When true, renders poll results without interactions
}

export default function PollDisplay({
  pollId,
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
  isRealTimeUpdate = false,
  isLoading = false,
  loadingText = "Updating poll...",
  readOnly = false
}: PollDisplayProps) {
  // Local state to manage poll data independently
  const [localOptions, setLocalOptions] = useState<PollOption[]>(options);
  const [localUserVotes, setLocalUserVotes] = useState<string[]>(userVotes);
  const [localTotalVotes, setLocalTotalVotes] = useState<number>(totalVotes);

  const [animatedValues] = useState(() => {
    const values: Record<string, Animated.Value> = {};
    options.forEach(option => {
      values[option.id] = new Animated.Value(0);
    });
    return values;
  });

  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  // Sync local state with props when they change
  React.useEffect(() => {
    setLocalOptions(options);
    setLocalUserVotes(userVotes);
    setLocalTotalVotes(totalVotes);
  }, [options, userVotes, totalVotes]);

  // Initialize vote counts on first render
  React.useEffect(() => {
    const initialCounts: Record<string, number> = {};
    options.forEach(option => {
      initialCounts[option.id] = option.votes;
    });
    setVoteCounts(initialCounts);
  }, []); // Empty dependency array - only run once on mount

  // Update vote counts when options change (for real-time updates)
  React.useEffect(() => {
    const newCounts: Record<string, number> = {};
    localOptions.forEach(option => {
      const oldCount = voteCounts[option.id] || 0;
      const newCount = option.votes;

      // If vote count increased, trigger +1 animation
      if (newCount > oldCount && isRealTimeUpdate && animatedValues[option.id]) {
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
        ]).start();
      }

      newCounts[option.id] = newCount;
    });
    setVoteCounts(newCounts);
  }, [localOptions, isRealTimeUpdate]); // Removed voteCounts and animatedValues to prevent infinite loops

  // Ensure all options have animation values
  React.useEffect(() => {
    localOptions.forEach(option => {
      if (!animatedValues[option.id]) {
        animatedValues[option.id] = new Animated.Value(0);
      }
    });
  }, [localOptions]); // Removed animatedValues to prevent infinite loops

  // Real-time update animation
  React.useEffect(() => {
    if (isRealTimeUpdate) {
      // Animate all options with a subtle pulse
      const animations = localOptions.map(option =>
        Animated.sequence([
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
        ])
      );

      Animated.parallel(animations).start();
    }
  }, [isRealTimeUpdate, localOptions]); // Removed animatedValues to prevent infinite loops

  const handleVote = (optionId: string) => {
    if (readOnly) {
      return;
    }

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
    localOptions.forEach(option => {
      option.voters.forEach(voter => {
        uniqueVoters.add(voter.id);
      });
    });
    return uniqueVoters.size;
  };

  const totalVoters = getTotalVoters();

  // Sort options by vote count (descending) - most popular first
  const sortedOptions = React.useMemo(() => {
    return [...localOptions].sort((a, b) => b.votes - a.votes);
  }, [localOptions]);

  // Render voters avatars
  const VotersAvatars = ({ voters }: { voters: PollOption['voters'] }) => {
    const displayVoters = voters.slice(0, 5);
    const remainingCount = voters.length - 5;

    return (
      <View style={styles.votersContainer}>
        {voters.length === 0 ? (
          // Show placeholder to maintain consistent height
          <View style={styles.emptyVotersPlaceholder} />
        ) : (
          <>
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
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Loading Overlay */}
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.pollLoadingOverlay]}>
          <View style={styles.pollLoadingContent}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.pollLoadingText}>{loadingText}</Text>
          </View>
        </View>
      )}

      {/* Header with question and stats - only show if not hidden */}
      {!hideQuestion && (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.question}>{question}</Text>
            <View style={styles.headerActions}>
              {canVote && onEdit && !readOnly && (
                <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                  <Edit2 size={16} color={Colors.light.secondaryText} />
                </TouchableOpacity>
              )}
              {canVote && onDelete && !readOnly && (
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
                {totalVoters} {totalVoters === 1 ? 'person' : 'people'} voted
              </Text>
            </View>
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
                {totalVoters} {totalVoters === 1 ? 'person' : 'people'} voted
              </Text>
            </View>
          </View>
          {canVote && onEdit && !readOnly && (
            <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
              <Edit2 size={16} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Vertical options list */}
      <View style={[styles.optionsContainer, hideQuestion && styles.compactOptionsContainer]}>
        {sortedOptions.map((option, index) => {
          const isSelected = localUserVotes.includes(option.id);
          
          return (
            <Animated.View
              key={option.id}
              style={[
                styles.optionRow,
                isSelected && styles.selectedOptionRow,
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
                activeOpacity={readOnly ? 1 : 0.8}
                disabled={readOnly}
              >
                {/* Check mark for selected - top left corner */}
                {isSelected && (
                  <View style={styles.checkmarkTopLeft}>
                    <Check size={12} color="white" />
                  </View>
                )}
                
                <View style={styles.optionContent}>
                  <View style={[
                    styles.optionLeft,
                    isSelected && styles.selectedOptionLeft
                  ]}>
                    {/* Option text */}
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                    ]}>
                      {option.text}
                    </Text>
                  </View>
                  
                  <View style={styles.optionRight}>
                    {/* Vote count and voters in row */}
                    <View style={styles.rightRow}>
                      <View style={styles.voteCountContainer}>
                        <Text style={[
                          styles.voteCountText,
                          isSelected && styles.selectedVoteCountText,
                        ]}>
                          {option.votes}
                        </Text>
                        {isRealTimeUpdate && option.votes > (voteCounts[option.id] || 0) && (
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

                      {/* Voters avatars next to vote count */}
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
  selectedOptionLeft: {
    paddingLeft: 28, // Push text to the right to avoid overlap with checkbox
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'left',
  },
  selectedVoteCountText: {
    color: Colors.light.primary,
  },
  votersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28, // Ensure consistent height
  },
  emptyVotersPlaceholder: {
    width: 0,
    height: 28,
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
  voteCountContainer: {
    position: 'relative',
    alignItems: 'center',
    minWidth: 24,
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
    top: '50%',
    left: 12, // Position on the left side, accounting for optionContent padding
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    transform: [
      { translateY: -10 }, // Center vertically (half of height)
    ],
  },
  compactStatsContainer: {
    flex: 1,
  },
  pollLoadingOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 10,
  },
  pollLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  pollLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
});