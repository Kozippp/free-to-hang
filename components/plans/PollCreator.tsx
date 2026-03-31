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
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Poll } from '@/store/plansStore';
import { getProtectedPollOptionIndices } from '@/utils/pollProtection';

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

  /** Matches server poll-edit: top 2 by vote count are locked; if all counts tie, none locked. */
  const protectedIndices = existingPoll
    ? getProtectedPollOptionIndices(existingPoll)
    : new Set<number>();
  const hasProtectedOptions = protectedIndices.size > 0;

  const getDuplicateOptionsFromList = (list: string[]) => {
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    list.forEach((option) => {
      const lowerOption = option.trim().toLowerCase();
      if (seen.has(lowerOption)) {
        duplicates.add(lowerOption);
      } else {
        seen.add(lowerOption);
      }
    });
    return duplicates;
  };

  // Check for duplicate options (create flow uses non-empty rows only)
  const getDuplicateOptions = () => {
    const validOptions = options.filter((option) => option.trim() !== '');
    return getDuplicateOptionsFromList(validOptions);
  };

  const duplicateOptions = existingPoll
    ? getDuplicateOptionsFromList(
        Array.from({ length: existingPoll.options.length }, (_, i) =>
          (options[i] ?? '').trim(),
        ),
      )
    : getDuplicateOptions();
  const hasDuplicates = duplicateOptions.size > 0;

  const handleProtectedOptionTap = () => {
    Alert.alert(
      'Cannot Edit Option',
      'This is one of the two leading choices by votes and cannot be changed. If all options are tied, every option stays editable.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      if (protectedIndices.has(index)) {
        handleProtectedOptionTap();
        return;
      }

      if (
        existingPoll &&
        index < existingPoll.options.length &&
        existingPoll.options[index].votes.length > 0
      ) {
        Alert.alert(
          'Cannot Remove Option',
          'Remove options that have no votes, or edit only non-leading options.',
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
    if (protectedIndices.has(index) && options[index] !== text) {
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
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    if (existingPoll) {
      const n = existingPoll.options.length;
      const rowTexts = Array.from({ length: n }, (_, i) => (options[i] ?? '').trim());
      if (rowTexts.some((t) => !t)) {
        Alert.alert(
          'Error',
          'Each existing option must have text. Use the remove control only for options with no votes.',
        );
        return;
      }
      const dup = getDuplicateOptionsFromList(rowTexts);
      if (dup.size > 0) {
        Alert.alert('Error', 'Please remove duplicate options');
        return;
      }
      if (rowTexts.length < 2) {
        Alert.alert('Error', 'Please add at least 2 options');
        return;
      }
      onSubmit(question.trim(), rowTexts);
      onClose();
      return;
    }

    const validOptions = options.filter((option) => option.trim() !== '');

    if (validOptions.length < 2) {
      Alert.alert('Error', 'Please add at least 2 options');
      return;
    }

    onSubmit(question.trim(), validOptions);
    onClose();
  };

  const canSubmit = () => {
    if (!question.trim() || hasDuplicates) {
      return false;
    }

    if (existingPoll) {
      const n = existingPoll.options.length;
      const rowTexts = Array.from({ length: n }, (_, i) => (options[i] ?? '').trim());
      if (rowTexts.some((t) => !t)) {
        return false;
      }
      return getDuplicateOptionsFromList(rowTexts).size === 0;
    }

    const validOptions = options.filter((option) => option.trim() !== '');
    return validOptions.length >= 2;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
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
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
                const isProtected = protectedIndices.has(index);
                const isDuplicate = option.trim() !== '' && duplicateOptions.has(option.trim().toLowerCase());
                
                return (
                  <View key={`option-${index}`} style={styles.optionRow}>
                    <View
                      style={[
                        styles.optionInputContainer,
                        isDuplicate && styles.duplicateOptionContainer,
                        isProtected && styles.protectedOptionContainer
                      ]}
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
                        editable={!isProtected}
                      />
                      
                      {isProtected && (
                        <View style={styles.protectedIndicator}>
                          <Text style={styles.protectedText}>🔒</Text>
                        </View>
                      )}
                    </View>
                    
                    {options.length > 2 &&
                      !isProtected &&
                      !(
                        existingPoll &&
                        index < existingPoll.options.length &&
                        existingPoll.options[index].votes.length > 0
                      ) && (
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
              
              {/* Create Poll button inline with options */}
              <TouchableOpacity
                onPress={handleSubmit}
                style={[styles.inlineCreateButton, !canSubmit() && styles.disabledCreateButton]}
                disabled={!canSubmit()}
              >
                <Text style={[styles.createButtonText, !canSubmit() && styles.disabledCreateButtonText]}>
                  {existingPoll ? 'Update Poll' : 'Create Poll'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    position: 'relative',
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
    zIndex: 1,
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
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 20,
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
  protectedOptionContainer: {
    backgroundColor: 'transparent',
  },
  keyboardAvoidingView: {
    flex: 1,
    position: 'relative',
  },
  inlineCreateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
});