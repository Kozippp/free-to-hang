import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Animated
} from 'react-native';
import { X, Plus, Clock, MapPin, HelpCircle } from 'lucide-react-native';
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
  const [customQuestion, setCustomQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [focusedInput, setFocusedInput] = useState<number | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset form when opening
      setCustomQuestion('');
      setOptions(['', '']);
      setFocusedInput(null);
      
      // Animate in
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const getTitle = () => {
    switch (pollType) {
      case 'when': return 'When should we meet?';
      case 'where': return 'Where should we meet?';
      case 'custom': return 'Create a poll';
      default: return 'Create a poll';
    }
  };

  const getIcon = () => {
    switch (pollType) {
      case 'when': return <Clock size={24} color={Colors.light.primary} />;
      case 'where': return <MapPin size={24} color={Colors.light.primary} />;
      case 'custom': return <HelpCircle size={24} color={Colors.light.primary} />;
      default: return <HelpCircle size={24} color={Colors.light.primary} />;
    }
  };

  const getPlaceholder = (index: number) => {
    switch (pollType) {
      case 'when': 
        return index === 0 ? 'e.g. Today 7pm' : index === 1 ? 'e.g. Tomorrow 6pm' : `Option ${index + 1}`;
      case 'where': 
        return index === 0 ? 'e.g. Central Park' : index === 1 ? 'e.g. Coffee shop downtown' : `Option ${index + 1}`;
      case 'custom': 
        return `Option ${index + 1}`;
      default: 
        return `Option ${index + 1}`;
    }
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
    // Focus the new input after a short delay
    setTimeout(() => {
      const newIndex = options.length;
      inputRefs.current[newIndex]?.focus();
    }, 100);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
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
    
    if (pollType === 'custom') {
      if (customQuestion.trim() && validOptions.length >= 2) {
        onSubmit(customQuestion.trim(), validOptions);
        onClose();
      }
    } else {
      if (validOptions.length >= 2) {
        const question = pollType === 'when' ? 'When should we meet?' : 'Where should we meet?';
        onSubmit(question, validOptions);
        onClose();
      }
    }
  };

  const canSubmit = () => {
    const validOptions = options.filter(option => option.trim() !== '').length >= 2;
    if (pollType === 'custom') {
      return customQuestion.trim() && validOptions;
    }
    return validOptions;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                  {
                    scale: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
                opacity: slideAnim,
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={Colors.light.secondaryText} />
              </TouchableOpacity>
              
              <View style={styles.titleContainer}>
                {getIcon()}
                <Text style={styles.title}>{getTitle()}</Text>
              </View>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Custom question input for custom polls only */}
              {pollType === 'custom' && (
                <View style={styles.questionSection}>
                  <Text style={styles.sectionLabel}>Question</Text>
                  <TextInput
                    style={styles.questionInput}
                    value={customQuestion}
                    onChangeText={setCustomQuestion}
                    placeholder="What do you want to ask?"
                    placeholderTextColor={Colors.light.secondaryText}
                    autoFocus={true}
                  />
                </View>
              )}
              
              {/* Options */}
              <View style={styles.optionsSection}>
                <Text style={styles.sectionLabel}>
                  {pollType === 'when' ? 'Time options' : pollType === 'where' ? 'Location options' : 'Options'}
                </Text>
                
                {options.map((option, index) => (
                  <View key={index} style={styles.optionContainer}>
                    <View style={styles.optionNumber}>
                      <Text style={styles.optionNumberText}>{index + 1}</Text>
                    </View>
                    
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
                      placeholder={getPlaceholder(index)}
                      placeholderTextColor={Colors.light.secondaryText}
                      onFocus={() => setFocusedInput(index)}
                      onBlur={() => setFocusedInput(null)}
                      autoFocus={pollType !== 'custom' && index === 0}
                    />
                    
                    {options.length > 2 && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveOption(index)}
                      >
                        <X size={18} color={Colors.light.secondaryText} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                
                <TouchableOpacity
                  style={styles.addOptionButton}
                  onPress={handleAddOption}
                >
                  <Plus size={20} color={Colors.light.primary} />
                  <Text style={styles.addOptionText}>Add another option</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  !canSubmit() && styles.disabledButton
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit()}
              >
                <Text style={[
                  styles.createButtonText,
                  !canSubmit() && styles.disabledButtonText
                ]}>
                  Create Poll
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 40, // Compensate for close button
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionSection: {
    marginTop: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 12,
    fontWeight: '600',
  },
  questionInput: {
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionsSection: {
    marginTop: 20,
    flex: 1,
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionNumberText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '700',
  },
  optionInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focusedInput: {
    borderColor: Colors.light.primary,
    backgroundColor: 'white',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
    backgroundColor: `${Colors.light.primary}05`,
  },
  addOptionText: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  createButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButtonText: {
    color: Colors.light.secondaryText,
  },
});