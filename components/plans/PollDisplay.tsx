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
import { Check, Crown, Users } from 'lucide-react-native';
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
}

export default function PollDisplay({
  question,
  options,
  onVote,
  userVotes,
  totalVotes,
  canVote
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
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues[optionId], {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();

    onVote(optionId);
  };

  // Calculate statistics
  const getTotalParticipants = () => {
    // Count unique voters across all options
    const uniqueVoters = new Set<string>();
    options.forEach(option => {
      option.voters.forEach(voter => {
        uniqueVoters.add(voter.id);
      });
    });
    return Math.max(uniqueVoters.size, 1); // Avoid division by zero
  };

  const totalParticipants = getTotalParticipants();

  const getPercentage = (votes: number) => {
    return Math.round((votes / totalParticipants) * 100);
  };

  // Sort options by vote count (descending)
  const sortedOptions = [...options].sort((a, b) => b.votes - a.votes);
  
  // Find the winning option(s) - highest vote count
  const maxVotes = Math.max(...options.map(option => option.votes));
  const isWinning = (votes: number) => votes === maxVotes && votes > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{question}</Text>
      
      {/* Statistics header */}
      <View style={styles.statsHeader}>
        <View style={styles.statsItem}>
          <Users size={16} color={Colors.light.secondaryText} />
          <Text style={styles.statsText}>
            {totalParticipants} {totalParticipants === 1 ? 'person' : 'people'} voted
          </Text>
        </View>
        {userVotes.length > 0 && (
          <Text style={styles.userVotesText}>
            You voted for {userVotes.length} option{userVotes.length > 1 ? 's' : ''}
          </Text>
        )}
      </View>
      
      <View style={styles.optionsContainer}>
        {sortedOptions.map((option, index) => {
          const percentage = getPercentage(option.votes);
          const isSelected = userVotes.includes(option.id);
          const isWinningOption = isWinning(option.votes);
          const isTopChoice = index === 0 && option.votes > 0;
          
          return (
            <Animated.View
              key={option.id}
              style={[
                styles.optionContainer,
                isSelected && styles.selectedOption,
                isWinningOption && styles.winningOption,
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
                <View style={styles.optionHeader}>
                  <View style={styles.optionLeft}>
                    {isWinningOption && (
                      <View style={styles.crownContainer}>
                        <Crown size={16} color="#FFD700" fill="#FFD700" />
                      </View>
                    )}
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                      isWinningOption && styles.winningOptionText,
                    ]}>
                      {option.text}
                    </Text>
                  </View>
                  
                  <View style={styles.optionRight}>
                    {isSelected && (
                      <View style={styles.checkContainer}>
                        <Check size={14} color="white" />
                      </View>
                    )}
                    
                    <View style={styles.voteStats}>
                      <Text style={[
                        styles.voteCount,
                        isSelected && styles.selectedVoteCount,
                        isWinningOption && styles.winningVoteCount
                      ]}>
                        {option.votes}
                      </Text>
                      <Text style={[
                        styles.percentage,
                        isSelected && styles.selectedPercentage,
                        isWinningOption && styles.winningPercentage
                      ]}>
                        {percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View 
                    style={[
                      styles.progressBar,
                      isSelected && styles.selectedProgressBar,
                      isWinningOption && styles.winningProgressBar,
                      { width: `${Math.max(percentage, 2)}%` } // Minimum 2% for visibility
                    ]} 
                  />
                </View>
                
                {/* Voters avatars */}
                {option.voters.length > 0 && (
                  <View style={styles.votersContainer}>
                    <View style={styles.avatarsRow}>
                      {option.voters.slice(0, 5).map((voter, voterIndex) => (
                        <View 
                          key={voter.id} 
                          style={[
                            styles.voterAvatar,
                            { marginLeft: voterIndex > 0 ? -6 : 0, zIndex: 5 - voterIndex }
                          ]}
                        >
                          <Image 
                            source={{ uri: voter.avatar }} 
                            style={styles.avatarImage} 
                          />
                        </View>
                      ))}
                      
                      {option.voters.length > 5 && (
                        <View style={[styles.voterAvatar, styles.moreVoters, { marginLeft: -6 }]}>
                          <Text style={styles.moreVotersText}>+{option.voters.length - 5}</Text>
                        </View>
                      )}
                    </View>
                    
                    {option.voters.length > 0 && (
                      <Text style={styles.votersLabel}>
                        {option.voters.slice(0, 2).map(v => v.name.split(' ')[0]).join(', ')}
                        {option.voters.length > 2 && ` and ${option.voters.length - 2} more`}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      
      {/* Voting instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          Tap options that work for you • You can select multiple options
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    padding: 16,
    paddingBottom: 8,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  userVotesText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  optionsContainer: {
    gap: 8,
    paddingHorizontal: 16,
  },
  optionContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  selectedOption: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}08`,
    elevation: 3,
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  winningOption: {
    borderColor: '#FFD700',
    backgroundColor: '#FFF9E6',
    elevation: 4,
  },
  optionButton: {
    padding: 0,
  },
  optionHeader: {
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
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
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
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteStats: {
    alignItems: 'center',
    minWidth: 40,
  },
  voteCount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  selectedVoteCount: {
    color: Colors.light.primary,
  },
  winningVoteCount: {
    color: '#B8860B',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  selectedPercentage: {
    color: Colors.light.primary,
  },
  winningPercentage: {
    color: '#B8860B',
  },
  progressContainer: {
    height: 4,
    backgroundColor: Colors.light.border,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.light.secondaryText,
  },
  selectedProgressBar: {
    backgroundColor: Colors.light.primary,
  },
  winningProgressBar: {
    backgroundColor: '#FFD700',
  },
  votersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voterAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.background,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  moreVoters: {
    backgroundColor: Colors.light.buttonBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreVotersText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  votersLabel: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  instructions: {
    padding: 16,
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});