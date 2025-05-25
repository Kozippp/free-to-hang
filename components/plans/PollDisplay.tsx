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
  onDelete
}: PollDisplayProps) {
  const [animatedValues] = useState(
    options.reduce((acc, option) => {
      acc[option.id] = new Animated.Value(0);
      return acc;
    }, {} as Record<string, Animated.Value>)
  );

  const handleVote = (optionId: string) => {
    if (!canVote) {
      Alert.alert(
        'Cannot Vote',
        'You need to respond "Going" to the plan to vote in polls and suggest changes.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // Animate the selection
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
  
  // Find the winning option(s) - only if majority of going people have voted
  const majorityHasVoted = totalVoters >= Math.ceil(goingParticipants * 0.5);
  const maxVotes = Math.max(...options.map(option => option.votes));
  const isWinning = (votes: number) => majorityHasVoted && votes === maxVotes && votes > 0;

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
          </View>
        </>
      )}
      
      {/* Vertical options list */}
      <View style={[styles.optionsContainer, hideQuestion && styles.compactOptionsContainer]}>
        {sortedOptions.map((option, index) => {
          const percentage = getPercentage(option.votes);
          const isSelected = userVotes.includes(option.id);
          const isWinningOption = isWinning(option.votes);
          
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
                    {/* Check mark for selected */}
                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Check size={12} color="white" />
                      </View>
                    )}
                    
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

      {/* Edit button for hidden question polls */}
      {hideQuestion && canVote && onEdit && (
        <TouchableOpacity onPress={onEdit} style={styles.floatingEditButton}>
          <Edit2 size={16} color={Colors.light.secondaryText} />
        </TouchableOpacity>
      )}
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
  floatingEditButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 6,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});