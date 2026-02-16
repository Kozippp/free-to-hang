import React, { useState, useRef } from 'react';
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
  votingInProgress?: Record<string, boolean>; // Track loading per option (key: `${pollId}-${optionId}`)
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
  readOnly = false,
  votingInProgress = {}
}: PollDisplayProps) {
  // Initialize localOptions sorted by votes on mount
  const [localOptions, setLocalOptions] = useState<PollOption[]>(() => {
    return [...options].sort((a, b) => b.votes - a.votes);
  });
  
  // Reset local state if pollId changes (effectively a new poll instance)
  React.useEffect(() => {
    setLocalOptions([...options].sort((a, b) => b.votes - a.votes));
    setLocalUserVotes(userVotes);
    setLocalTotalVotes(totalVotes);
  }, [pollId]); // Only run when poll identity changes, ignore other prop updates to maintain snapshot

  // We explicitly IGNORE updates to 'options', 'userVotes', 'totalVotes' props 
  // while the component is mounted to prevent re-sorting and vote count changes
  // as per user requirement: "control panelis olles ta häälte arvu ei muuda"

  const [localUserVotes, setLocalUserVotes] = useState<string[]>(userVotes);
  const [localTotalVotes, setLocalTotalVotes] = useState<number>(totalVotes);

  const [animatedValues] = useState(() => {
    const values: Record<string, Animated.Value> = {};
    options.forEach(option => {
      values[option.id] = new Animated.Value(0);
    });
    return values;
  });




  // Ensure all options have animation values
  React.useEffect(() => {
    localOptions.forEach(option => {
      if (!animatedValues[option.id]) {
        animatedValues[option.id] = new Animated.Value(0);
      }
    });
  }, [localOptions]); // Removed animatedValues to prevent infinite loops

  const handleVote = (optionId: string) => {
    if (readOnly) {
      return;
    }

    // Check if this specific option is currently being voted on
    const voteKey = `${pollId}-${optionId}`;
    if (votingInProgress[voteKey]) {
      console.log('⏳ Vote already in progress for:', voteKey);
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

    // Optimistic UI update - toggle vote immediately
    setLocalUserVotes(currentVotes => {
      const hasVoted = currentVotes.includes(optionId);
      
      // Update localOptions manually since we ignore props
      setLocalOptions(prevOptions => {
        return prevOptions.map(opt => {
          if (opt.id === optionId) {
            const newCount = hasVoted ? opt.votes - 1 : opt.votes + 1;
            return {
              ...opt,
              votes: Math.max(0, newCount)
            };
          }
          return opt;
        });
      });
      
    // Update localTotalVotes (unique voters)
    setLocalTotalVotes(prev => {
      if (hasVoted) {
        // Removing a vote: if this was my only vote, decrement unique voters
        return currentVotes.length === 1 ? prev - 1 : prev;
      } else {
        // Adding a vote: if this is my first vote, increment unique voters
        return currentVotes.length === 0 ? prev + 1 : prev;
      }
    });

      if (hasVoted) {
        // Remove vote
        return currentVotes.filter(id => id !== optionId);
      } else {
        // Add vote
        return [...currentVotes, optionId];
      }
    });

    // Animate the selection only if animation value exists
    // Single bounce animation on click
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

  const totalVoters = localTotalVotes;

  // No re-sorting on render to keep positions stable
  const sortedOptions = localOptions;

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
          const voteKey = `${pollId}-${option.id}`;
          const isVoting = votingInProgress[voteKey];
          
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
                disabled={readOnly || isVoting}
              >
                {/* Loading indicator or Check mark for selected - top left corner */}
                {isVoting ? (
                  <View style={styles.loadingTopLeft}>
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                  </View>
                ) : isSelected ? (
                  <View style={styles.checkmarkTopLeft}>
                    <Check size={12} color="white" />
                  </View>
                ) : null}
                
                <View style={styles.optionContent}>
                  <View style={[
                    styles.optionLeft,
                    (isSelected || isVoting) && styles.selectedOptionLeft
                  ]}>
                    {/* Option text */}
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                      isVoting && styles.votingOptionText,
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
  loadingTopLeft: {
    position: 'absolute',
    top: '50%',
    left: 12, // Position on the left side, accounting for optionContent padding
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    transform: [
      { translateY: -10 }, // Center vertically (half of height)
    ],
  },
  votingOptionText: {
    color: Colors.light.secondaryText,
    opacity: 0.7,
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