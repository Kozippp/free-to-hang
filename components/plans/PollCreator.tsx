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

interface PollCreatorProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (question: string, options: string[]) => void;
  pollType: 'when' | 'where' | 'custom';
}

export default function PollCreator({
  visible,
  onClose,
  onSubmit,
  pollType
}: PollCreatorProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  useEffect(() => {
    if (visible) {
      // Set default question for when/where polls
      if (pollType === 'when') {
        setQuestion('What time works best?');
      } else if (pollType === 'where') {
        setQuestion('Where should we meet?');
      } else {
        setQuestion('');
      }
      setOptions(['', '']);
    }
  }, [visible, pollType]);

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (text: string, index: number) => {
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
    const validOptions = options.filter(option => option.trim() !== '').length >= 2;
    return question.trim() && validOptions;
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
          
          <Text style={styles.title}>Poll</Text>
          
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
                autoFocus={pollType === 'custom'}
                editable={pollType === 'custom'}
              />
            </View>
            
            {/* Options */}
            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>OPTIONS</Text>
              
              {options.map((option, index) => (
                <View key={index} style={styles.optionRow}>
                  <TextInput
                    style={styles.optionInput}
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
                    autoFocus={pollType !== 'custom' && index === 0}
                    returnKeyType={index === options.length - 1 ? 'done' : 'next'}
                    blurOnSubmit={index === options.length - 1}
                  />
                  
                  {options.length > 2 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveOption(index)}
                      style={styles.removeButton}
                    >
                      <X size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
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
              Create Poll
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
  optionInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: '#000',
    marginRight: 8,
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
});