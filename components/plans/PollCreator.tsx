import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Poll } from '@/store/plansStore';

interface PollCreatorProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (question: string, options: string[]) => void;
  pollType: 'when' | 'where' | 'custom';
  existingPoll?: Poll | null;
}

export default function PollCreator({
  visible,
  onClose,
  onSubmit,
  pollType,
  existingPoll
}: PollCreatorProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  useEffect(() => {
    if (visible) {
      if (existingPoll) {
        // Editing existing poll
        setQuestion(existingPoll.question);
        const existingOptions = existingPoll.options.map(opt => opt.text);
        // Only add empty option if we have less than 4 options
        if (existingOptions.length < 4) {
          setOptions([...existingOptions, '']);
        } else {
          setOptions(existingOptions);
        }
      } else {
        // Creating new poll
        if (pollType === 'when') {
          setQuestion('What time works best?');
        } else if (pollType === 'where') {
          setQuestion('Where should we meet?');
        } else {
          setQuestion('');
        }
        setOptions(['', '']);
      }
    }
  }, [visible, pollType, existingPoll]);

  // Get the protected options (locked from editing)
  const getProtectedOptions = () => {
    if (!existingPoll) return new Set();
    
    // Calculate total voters for this poll
    const uniqueVoters = new Set<string>();
    existingPoll.options.forEach(option => {
      option.votes.forEach(vote => {
        uniqueVoters.add(vote);
      });
    });
    const totalVoters = uniqueVoters.size;
    
    // Don't lock any options if less than 45% of people have voted
    // Assuming we get totalParticipants from somewhere - for now use a reasonable estimate
    const estimatedParticipants = Math.max(totalVoters * 2, 4); // Conservative estimate
    const participationRate = totalVoters / estimatedParticipants;
    
    if (participationRate < 0.45) {
      return new Set();
    }
    
    const sortedOptions = [...existingPoll.options]
      .sort((a, b) => b.votes.length - a.votes.length);
    
    if (sortedOptions.length < 2) return new Set();
    
    const topVotes = sortedOptions[0].votes.length;
    const secondVotes = sortedOptions[1].votes.length;
    
    // If we have at least 3 options, check if top 2 both have more votes than others
    if (sortedOptions.length >= 3) {
      const thirdVotes = sortedOptions[2].votes.length;
      
      // Lock top 2 if they both have more votes than the third
      if (topVotes > thirdVotes && secondVotes > thirdVotes) {
        return new Set([sortedOptions[0].text, sortedOptions[1].text]);
      }
      
      // Lock only top if it clearly leads
      if (topVotes > secondVotes && topVotes > thirdVotes) {
        return new Set([sortedOptions[0].text]);
      }
    } else {
      // With only 2 options, lock the top one if it has more votes
      if (topVotes > secondVotes) {
        return new Set([sortedOptions[0].text]);
      }
    }
    
    return new Set();
  };

  const protectedOptions = getProtectedOptions();
  const hasProtectedOptions = protectedOptions.size > 0;

  // Check for duplicate options
  const getDuplicateOptions = () => {
    const validOptions = options.filter(option => option.trim() !== '');
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    
    validOptions.forEach(option => {
      const lowerOption = option.trim().toLowerCase();
      if (seen.has(lowerOption)) {
        duplicates.add(lowerOption);
      } else {
        seen.add(lowerOption);
      }
    });
    
    return duplicates;
  };

  const duplicateOptions = getDuplicateOptions();
  const hasDuplicates = duplicateOptions.size > 0;

  const handleProtectedOptionTap = () => {
    Alert.alert(
      'Cannot Edit Option',
      'This option has received significant votes and cannot be edited to protect the group\'s preference.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const optionToRemove = options[index];
      
      // Don't allow removing protected options
      if (protectedOptions.has(optionToRemove)) {
        Alert.alert(
          'Cannot Remove Option',
          'This option has received significant votes and cannot be removed to protect the group\'s preference.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      const newOptions = options.filter((_, i) => i !== index);
      
      // If we removed an option and don't have an empty option at the end,
      // and we have less than 4 options, add an empty one
      const hasEmptyAtEnd = newOptions[newOptions.length - 1] === '';
      if (!hasEmptyAtEnd && newOptions.length < 4) {
        newOptions.push('');
      }
      
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const currentOption = options[index];
    
    // Don't allow editing protected options
    if (protectedOptions.has(currentOption) && currentOption !== text) {
      handleProtectedOptionTap();
      return;
    }
    
    const newOptions = [...options];
    newOptions[index] = text;
    
    // Auto-create new option if user is typing in the last field and it's not empty
    // and we haven't reached the max limit of 4 options
    if (index === options.length - 1 && text.trim() !== '' && options.length < 4) {
      newOptions.push('');
    }
    
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    const validOptions = options.filter(option => option.trim() !== '');
    
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }
    
    if (validOptions.length < 2) {
      Alert.alert('Error', 'Please add at least 2 options');
      return;
    }
    
    onSubmit(question.trim(), validOptions);
    onClose();
  };

  const canSubmit = () => {
    const validOptions = options.filter(option => option.trim() !== '');
    
    if (!question.trim() || validOptions.length < 2 || hasDuplicates) {
      return false;
    }
    
    return true;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>{existingPoll ? 'Edit Poll' : 'Poll'}</Text>
          
          <TouchableOpacity 
            onPress={handleSubmit}
            style={[styles.doneButton, !canSubmit() && styles.disabledButton]}
            disabled={!canSubmit()}
          >
            <Text style={[styles.doneText, !canSubmit() && styles.disabledText]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
        
        <KeyboardAvoidingView 
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="none"
          >
            {/* Question Input */}
            <View style={styles.questionSection}>
              <Text style={styles.sectionTitle}>Poll question</Text>
              <TextInput
                style={styles.questionInput}
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask a question..."
                placeholderTextColor="#999"
                multiline
                maxLength={100}
                autoFocus={pollType === 'custom' && !existingPoll}
                editable={pollType === 'custom'}
              />
            </View>
            
            {/* Options */}
            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>OPTIONS</Text>
              
              {hasDuplicates && (
                <Text style={styles.duplicateError}>
                  Please remove duplicate options
                </Text>
              )}
              
              {options.map((option, index) => {
                const isProtected = protectedOptions.has(option);
                const isDuplicate = option.trim() !== '' && duplicateOptions.has(option.trim().toLowerCase());
                
                return (
                  <View key={`option-${index}-${option.slice(0, 10)}`} style={styles.optionRow}>
                    <TouchableOpacity
                      style={[
                        styles.optionInputContainer,
                        isDuplicate && styles.duplicateOptionContainer
                      ]}
                      onPress={isProtected ? handleProtectedOptionTap : undefined}
                      disabled={!isProtected}
                      activeOpacity={isProtected ? 0.7 : 1}
                    >
                      <TextInput
                        style={[
                          styles.optionInput,
                          isProtected && styles.protectedOptionInput,
                          isDuplicate && styles.duplicateOptionInput
                        ]}
                        value={option}
                        onChangeText={(text) => handleOptionChange(text, index)}
                        placeholder={
                          pollType === 'when' 
                            ? (index === 0 ? 'e.g. 7:00 PM' : index === 1 ? 'e.g. 8:00 PM' : 'Another time...')
                            : pollType === 'where'
                            ? (index === 0 ? 'e.g. Central Park' : index === 1 ? 'e.g. Coffee shop' : 'Another place...')
                            : `Option ${index + 1}`
                        }
                        placeholderTextColor="#999"
                        autoFocus={false}
                        returnKeyType={index === options.length - 1 ? 'done' : 'next'}
                        blurOnSubmit={index === options.length - 1}
                        editable={!isProtected}
                        pointerEvents={isProtected ? 'none' : 'auto'}
                        keyboardType="default"
                        enablesReturnKeyAutomatically={false}
                        clearButtonMode="never"
                      />
                      
                      {isProtected && (
                        <View style={styles.protectedIndicator}>
                          <Text style={styles.protectedText}>🔒</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    
                    {options.length > 2 && !isProtected && (
                      <TouchableOpacity
                        onPress={() => handleRemoveOption(index)}
                        style={styles.removeButton}
                      >
                        <X size={20} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
            
            {/* Extra padding for better keyboard handling */}
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Bottom Action */}
        <View style={styles.bottomSection}>
          <TouchableOpacity 
            onPress={handleSubmit}
            style={[styles.createButton, !canSubmit() && styles.disabledCreateButton]}
            disabled={!canSubmit()}
          >
            <Text style={[styles.createButtonText, !canSubmit() && styles.disabledCreateButtonText]}>
              {existingPoll ? 'Update Poll' : 'Create Poll'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 17,
    color: '#007AFF',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  doneButton: {
    padding: 8,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  disabledButton: {
    opacity: 0.3,
  },
  disabledText: {
    color: '#999',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 80, // Extra space for keyboard
  },
  questionSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: '#000',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  optionsSection: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInputContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  removeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 22,
  },
  bottomPadding: {
    height: 100, // Extra space for keyboard
  },
  bottomSection: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#F2F2F7',
    borderTopWidth: 0.5,
    borderTopColor: '#C6C6C8',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  disabledCreateButton: {
    backgroundColor: '#E5E5EA',
  },
  disabledCreateButtonText: {
    color: '#8E8E93',
  },
  protectedOptionInput: {
    backgroundColor: 'transparent',
  },
  protectedIndicator: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 10,
    marginLeft: 8,
  },
  protectedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
  protectionWarning: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FF3B30',
    marginBottom: 8,
  },
  duplicateError: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FF3B30',
    marginBottom: 8,
  },
  duplicateOptionContainer: {
    backgroundColor: '#FFE5E5',
  },
  duplicateOptionInput: {
    backgroundColor: 'transparent',
  },
});