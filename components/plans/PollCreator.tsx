import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import { X, Plus, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PollOption {
  id: string;
  text: string;
}

interface PollCreatorProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (question: string, options: string[]) => void;
  initialQuestion?: string;
  fixedQuestion?: boolean;
}

export default function PollCreator({
  visible,
  onClose,
  onSubmit,
  initialQuestion = '',
  fixedQuestion = false
}: PollCreatorProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [options, setOptions] = useState<string[]>(['']);
  const [focusedInput, setFocusedInput] = useState<number | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 1) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    const validOptions = options.filter(option => option.trim() !== '');
    if (question.trim() && validOptions.length >= 2) {
      onSubmit(question.trim(), validOptions);
    }
  };

  const handleFocus = (index: number) => {
    setFocusedInput(index);
  };

  const handleBlur = () => {
    setFocusedInput(null);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Poll</Text>
              <View style={{ width: 60 }} />
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.questionContainer}>
                <Text style={styles.sectionLabel}>Poll question</Text>
                <TextInput
                  style={styles.questionInput}
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Ask a question..."
                  placeholderTextColor={Colors.light.secondaryText}
                />
              </View>
              
              <View style={styles.optionsContainer}>
                <Text style={styles.sectionLabel}>OPTIONS</Text>
                
                {options.map((option, index) => (
                  <View key={index} style={styles.optionRow}>
                    <TextInput
                      ref={ref => {
                        inputRefs.current[index] = ref;
                      }}
                      style={[
                        styles.optionInput,
                        focusedInput === index && styles.focusedInput
                      ]}
                      value={option}
                      onChangeText={(text) => handleOptionChange(text, index)}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={Colors.light.secondaryText}
                      onFocus={() => handleFocus(index)}
                      onBlur={handleBlur}
                    />
                    
                    {options.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveOption(index)}
                      >
                        <X size={20} color={Colors.light.secondaryText} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
            
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddOption}
            >
              <Plus size={20} color={Colors.light.primary} />
              <Text style={styles.addButtonText}>Add option</Text>
            </TouchableOpacity>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!question.trim() || options.filter(o => o.trim()).length < 2) && styles.disabledButton
                ]}
                onPress={handleSubmit}
                disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
              >
                <Text style={[styles.buttonText, { color: 'white' }]}>Create Poll</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  modalContainer: {
    backgroundColor: '#1E1E1E', // Dark background like Instagram
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#3897F0', // Instagram blue
    fontWeight: '500',
  },
  modalContent: {
    padding: 20,
    maxHeight: '70%',
  },
  questionContainer: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#8E8E8E', // Instagram gray
    marginBottom: 8,
    fontWeight: '500',
  },
  questionInput: {
    fontSize: 16,
    color: 'white',
    backgroundColor: '#262626', // Instagram dark input
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionInput: {
    flex: 1,
    fontSize: 16,
    color: 'white',
    backgroundColor: '#262626', // Instagram dark input
    borderRadius: 8,
    padding: 12,
  },
  focusedInput: {
    borderColor: Colors.light.primary,
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  submitButton: {
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
  buttonText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
});