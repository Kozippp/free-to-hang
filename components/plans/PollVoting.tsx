import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Platform
} from 'react-native';
import { Check } from 'lucide-react-native';
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

interface PollVotingProps {
  visible: boolean;
  onClose: () => void;
  question: string;
  options: PollOption[];
  onVote: (selectedOptionIds: string[]) => void;
  userVotes: string[];
  currentUserId: string;
}

export default function PollVoting({
  visible,
  onClose,
  question,
  options,
  onVote,
  userVotes,
  currentUserId
}: PollVotingProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(userVotes);

  const toggleOption = (optionId: string) => {
    if (selectedOptions.includes(optionId)) {
      setSelectedOptions(selectedOptions.filter(id => id !== optionId));
    } else {
      setSelectedOptions([...selectedOptions, optionId]);
    }
  };

  const handleSubmit = () => {
    onVote(selectedOptions);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.question}>{question}</Text>
          
          <ScrollView style={styles.optionsContainer}>
            {options.map((option) => {
              const isSelected = selectedOptions.includes(option.id);
              
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    isSelected && styles.selectedOption
                  ]}
                  onPress={() => toggleOption(option.id)}
                >
                  <View style={styles.checkboxContainer}>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkedBox
                    ]}>
                      {isSelected && (
                        <Check size={16} color="white" />
                      )}
                    </View>
                  </View>
                  
                  <Text style={styles.optionText}>{option.text}</Text>
                  
                  {option.voters.length > 0 && (
                    <View style={styles.votersContainer}>
                      {option.voters.slice(0, 3).map((voter, index) => (
                        <View 
                          key={voter.id} 
                          style={[
                            styles.voterAvatar,
                            { marginLeft: index > 0 ? -10 : 0 }
                          ]}
                        >
                          <Image 
                            source={{ uri: voter.avatar }} 
                            style={styles.avatarImage} 
                          />
                        </View>
                      ))}
                      
                      {option.voters.length > 3 && (
                        <View style={[styles.voterAvatar, styles.moreVoters, { marginLeft: -10 }]}>
                          <Text style={styles.moreVotersText}>+{option.voters.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                selectedOptions.length === 0 && styles.disabledButton
              ]}
              onPress={handleSubmit}
              disabled={selectedOptions.length === 0}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#1E1E1E', // Dark background like Instagram
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    maxHeight: 400,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626', // Instagram dark input
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  selectedOption: {
    backgroundColor: '#0F3460', // Darker blue when selected
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#3897F0', // Instagram blue
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#3897F0', // Instagram blue
  },
  optionText: {
    fontSize: 16,
    color: 'white',
    flex: 1,
  },
  votersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#262626', // Same as background
    overflow: 'hidden',
  },
  avatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  moreVoters: {
    backgroundColor: '#3897F0', // Instagram blue
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreVotersText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#262626', // Instagram dark input
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#3897F0', // Instagram blue
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});