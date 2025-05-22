import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
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
  onChangeVote: () => void;
  userVotes: string[];
  totalVotes: number;
  canVote: boolean;
}

export default function PollDisplay({
  question,
  options,
  onChangeVote,
  userVotes,
  totalVotes,
  canVote
}: PollDisplayProps) {
  
  const handleVoteAttempt = () => {
    if (!canVote) {
      Alert.alert(
        'Cannot Vote',
        'You need to respond "Yes" to the plan to vote in polls and suggest changes.',
        [
          { text: 'OK', style: 'default' }
        ]
      );
      return;
    }
    onChangeVote();
  };
  // Calculate percentages
  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  // Find the winning option(s)
  const maxVotes = Math.max(...options.map(option => option.votes));
  const winningOptions = options.filter(option => option.votes === maxVotes && maxVotes > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{question}</Text>
      
      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const percentage = getPercentage(option.votes);
          const isSelected = userVotes.includes(option.id);
          const isWinning = winningOptions.some(opt => opt.id === option.id) && maxVotes > 0;
          
          return (
            <View key={option.id} style={styles.optionContainer}>
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionText,
                  isSelected && styles.selectedOptionText
                ]}>
                  {option.text}
                </Text>
                
                <View style={styles.optionRight}>
                  {isSelected && (
                    <View style={styles.selectedIndicator}>
                      <View style={styles.selectedDot} />
                    </View>
                  )}
                  
                  <Text style={styles.percentageText}>{percentage}%</Text>
                </View>
              </View>
              
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar,
                    isSelected && styles.selectedProgressBar,
                    isWinning && styles.winningProgressBar,
                    { width: `${percentage}%` }
                  ]} 
                />
              </View>
              
              {option.voters.length > 0 && (
                <View style={styles.votersContainer}>
                  {option.voters.slice(0, 3).map((voter, index) => (
                    <View 
                      key={voter.id} 
                      style={[
                        styles.voterAvatar,
                        { marginLeft: index > 0 ? -8 : 0 }
                      ]}
                    >
                      <Image 
                        source={{ uri: voter.avatar }} 
                        style={styles.avatarImage} 
                      />
                    </View>
                  ))}
                  
                  {option.voters.length > 3 && (
                    <View style={[styles.voterAvatar, styles.moreVoters, { marginLeft: -8 }]}>
                      <Text style={styles.moreVotersText}>+{option.voters.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.totalVotes}>{totalVotes} votes</Text>
        
        <TouchableOpacity 
          style={[
            styles.changeVoteButton,
            !canVote && styles.disabledButton
          ]}
          onPress={handleVoteAttempt}
        >
          <Text style={[
            styles.changeVoteText,
            !canVote && styles.disabledButtonText
          ]}>
            {canVote ? 'Change vote' : 'Vote'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  optionsContainer: {
    marginBottom: 8,
  },
  optionContainer: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.buttonBackground,
    overflow: 'hidden',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    zIndex: 1,
  },
  optionText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  selectedOptionText: {
    fontWeight: '500',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedIndicator: {
    marginRight: 8,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  percentageText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: '500',
    minWidth: 36,
    textAlign: 'right',
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: '100%',
    backgroundColor: `${Colors.light.primary}15`,
  },
  selectedProgressBar: {
    backgroundColor: `${Colors.light.primary}25`,
  },
  winningProgressBar: {
    backgroundColor: `${Colors.light.primary}35`,
  },
  votersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  voterAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.buttonBackground,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  moreVoters: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreVotersText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  totalVotes: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  changeVoteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changeVoteText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledButtonText: {
    color: Colors.light.secondaryText,
  },
});