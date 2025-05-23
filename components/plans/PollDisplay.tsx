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
import { Check, Crown } from 'lucide-react-native';
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

  // Calculate percentages and sort options by votes (highest first)
  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  // Sort options by vote count (descending)
  const sortedOptions = [...options].sort((a, b) => b.votes - a.votes);
  
  // Find the winning option(s) - at least 50% of total participants
  const maxVotes = Math.max(...options.map(option => option.votes));
  const totalParticipants = Math.max(totalVotes, 1); // Avoid division by zero
  const isWinning = (votes: number) => votes === maxVotes && votes > 0 && (votes / totalParticipants) >= 0.5;

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{question}</Text>
      
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
                isTopChoice && !isWinningOption && styles.topOption,
                {
                  transform: [
                    {
                      scale: animatedValues[option.id]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.95],
                      }) || 1,
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleVote(option.id)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
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
                      isTopChoice && !isWinningOption && styles.topOptionText
                    ]}>
                      {option.text}
                    </Text>
                  </View>
                  
                  <View style={styles.optionRight}>
                    {isSelected && (
                      <View style={styles.checkContainer}>
                        <Check size={16} color="white" />
                      </View>
                    )}
                    
                    <View style={styles.voteInfo}>
                      <Text style={[
                        styles.voteCount,
                        isSelected && styles.selectedVoteCount,
                        isWinningOption && styles.winningVoteCount
                      ]}>
                        {option.votes}
                      </Text>
                      {percentage > 0 && (
                        <Text style={[
                          styles.percentage,
                          isSelected && styles.selectedPercentage,
                          isWinningOption && styles.winningPercentage
                        ]}>
                          {percentage}%
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                
                {/* Progress bar */}
                {percentage > 0 && (
                  <View style={styles.progressContainer}>
                    <View 
                      style={[
                        styles.progressBar,
                        isSelected && styles.selectedProgressBar,
                        isWinningOption && styles.winningProgressBar,
                        isTopChoice && !isWinningOption && styles.topProgressBar,
                        { width: `${percentage}%` }
                      ]} 
                    />
                  </View>
                )}
                
                {/* Voters avatars */}
                {option.voters.length > 0 && (
                  <View style={styles.votersContainer}>
                    <View style={styles.avatarsRow}>
                      {option.voters.slice(0, 4).map((voter, voterIndex) => (
                        <View 
                          key={voter.id} 
                          style={[
                            styles.voterAvatar,
                            { marginLeft: voterIndex > 0 ? -8 : 0, zIndex: 4 - voterIndex }
                          ]}
                        >
                          <Image 
                            source={{ uri: voter.avatar }} 
                            style={styles.avatarImage} 
                          />
                        </View>
                      ))}
                      
                      {option.voters.length > 4 && (
                        <View style={[styles.voterAvatar, styles.moreVoters, { marginLeft: -8 }]}>
                          <Text style={styles.moreVotersText}>+{option.voters.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      
      {totalVotes > 0 && (
        <View style={styles.footer}>
          <Text style={styles.totalVotes}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  question: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  optionContainer: {
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selectedOption: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}08`,
  },
  winningOption: {
    borderColor: '#FFD700',
    backgroundColor: '#FFF9E6',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  topOption: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}05`,
  },
  optionButton: {
    padding: 0,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  crownContainer: {
    marginRight: 8,
  },
  optionText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
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
  topOptionText: {
    fontWeight: '600',
    color: Colors.light.primary,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteInfo: {
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
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  selectedPercentage: {
    color: Colors.light.primary,
  },
  winningPercentage: {
    color: '#B8860B',
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.light.secondaryText,
    borderRadius: 2,
  },
  selectedProgressBar: {
    backgroundColor: Colors.light.primary,
  },
  winningProgressBar: {
    backgroundColor: '#FFD700',
  },
  topProgressBar: {
    backgroundColor: Colors.light.primary,
  },
  votersContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  moreVoters: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreVotersText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
  },
  totalVotes: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
});