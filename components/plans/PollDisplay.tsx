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
import { Check, Crown, Edit2, Users } from 'lucide-react-native';
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
}

export default function PollDisplay({
  question,
  options,
  onVote,
  userVotes,
  totalVotes,
  canVote,
  onEdit,
  totalGoingParticipants = 0
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
              { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index }
            ]}
          >
            <Image 
              source={{ uri: voter.avatar }} 
              style={styles.avatarImage} 
            />
          </View>
        ))}
        
        {remainingCount > 0 && (
          <View style={[styles.voterAvatar, styles.moreVoters, { marginLeft: -8 }]}>
            <Text style={styles.moreVotersText}>+{remainingCount}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with question and stats */}
      <View style={styles.headerContainer}>
        <Text style={styles.question}>{question}</Text>
        {canVote && onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Edit2 size={16} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        )}
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
      
      {/* Vertical options list */}
      <View style={styles.optionsContainer}>
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
                    
                    {/* Percentage */}
                    <Text style={[
                      styles.percentageText,
                      isSelected && styles.selectedPercentageText,
                      isWinningOption && styles.winningPercentageText
                    ]}>
                      {percentage}%
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View 
                    style={[
                      styles.progressBar,
                      isSelected && styles.selectedProgressBar,
                      isWinningOption && styles.winningProgressBar,
                      { width: `${Math.max(percentage, 2)}%` }
                    ]} 
                  />
                </View>
                
                {/* Voters avatars */}
                <VotersAvatars voters={option.voters} />
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
  editButton: {
    padding: 6,
    marginLeft: 8,
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
    paddingVertical: 14,
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
    gap: 10,
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
    minWidth: 35,
    textAlign: 'right',
  },
  selectedPercentageText: {
    color: Colors.light.primary,
  },
  winningPercentageText: {
    color: '#B8860B',
  },
  progressContainer: {
    height: 3,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#D1D5DB',
    borderRadius: 1.5,
  },
  selectedProgressBar: {
    backgroundColor: Colors.light.primary,
  },
  winningProgressBar: {
    backgroundColor: '#FFD700',
  },
  votersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  voterAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
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
    fontSize: 8,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
});