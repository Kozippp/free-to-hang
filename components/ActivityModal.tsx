import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  Modal, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Dimensions
} from 'react-native';
import { activities } from '@/constants/mockData';
import Colors from '@/constants/colors';
import { MAX_ACTIVITY_LENGTH } from '@/constants/limits';
import { X, Clock } from 'lucide-react-native';

interface ActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (activity: string, duration: number | null) => void;
  initialActivity?: string;
}

const DURATION_OPTIONS = [
  { label: 'Forever', value: null },
  { label: 'Till tonight', value: 'tonight' }, // Special handling
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
  { label: '12 hours', value: 720 },
];

export default function ActivityModal({ 
  visible, 
  onClose, 
  onSubmit,
  initialActivity = ''
}: ActivityModalProps) {
  const [activity, setActivity] = useState(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
  const [inputHeight, setInputHeight] = useState(60);
  const [selectedDuration, setSelectedDuration] = useState<number | 'tonight' | null>(null);

  // Sync activity when modal opens (e.g. when editing existing status)
  useEffect(() => {
    if (visible) {
      setActivity(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
    }
  }, [visible, initialActivity]);

  const handleActivityChange = (text: string) => {
    setActivity(text.slice(0, MAX_ACTIVITY_LENGTH));
  };

  const calculateDuration = (value: number | 'tonight' | null): number | null => {
    if (value === null) return null;
    if (typeof value === 'number') return value;
    
    if (value === 'tonight') {
      const now = new Date();
      // Set to 4 AM next day (end of "night")
      const endOfNight = new Date();
      endOfNight.setDate(now.getDate() + 1);
      endOfNight.setHours(4, 0, 0, 0);
      
      const diffMs = endOfNight.getTime() - now.getTime();
      return Math.round(diffMs / (1000 * 60));
    }
    
    return null;
  };

  const handleSubmit = () => {
    // Always use the text input content - quick suggestions just append to it
    const finalActivity = activity.trim().slice(0, MAX_ACTIVITY_LENGTH);
    const durationMinutes = calculateDuration(selectedDuration);
      
    onSubmit(finalActivity, durationMinutes);
    onClose();
    
    // Reset state
    setActivity('');
    setInputHeight(60);
    setSelectedDuration(null);
  };

  const handleActivitySelect = (activityName: string) => {
    // Append ", activityName" to the text input (or just "activityName" if empty)
    setActivity((prev) => {
      const trimmed = prev.trim();
      const toAdd = trimmed ? `, ${activityName}` : activityName;
      const newText = trimmed + toAdd;
      return newText.slice(0, MAX_ACTIVITY_LENGTH);
    });
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>What do you feel like doing?</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputWithCounter,
                  { height: Math.min(140, Math.max(60, inputHeight)) }
                ]}
                value={activity}
                onChangeText={handleActivityChange}
                placeholder="E.g., Coffee, Movie night..."
                placeholderTextColor={Colors.light.secondaryText}
                autoFocus={false}
                maxLength={MAX_ACTIVITY_LENGTH}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onContentSizeChange={(event) => 
                  setInputHeight(event.nativeEvent.contentSize.height)
                }
              />
              <Text
                style={[
                  styles.charCount,
                  activity.length >= MAX_ACTIVITY_LENGTH && styles.charCountLimit
                ]}
                pointerEvents="none"
              >
                {activity.length}/{MAX_ACTIVITY_LENGTH}
              </Text>
            </View>
            
            <Text style={styles.sectionTitle}>Duration</Text>
            <ScrollView 
              horizontal={true} 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScrollContainer}
            >
              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.chip,
                    selectedDuration === option.value && styles.selectedChip
                  ]}
                  onPress={() => setSelectedDuration(option.value as any)}
                >
                  <Text 
                    style={[
                      styles.chipText,
                      selectedDuration === option.value && styles.selectedChipText
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Quick suggestions</Text>
            
            <ScrollView 
              horizontal={true} 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScrollContainer}
            >
              {activities.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.chip}
                  onPress={() => handleActivitySelect(item.name)}
                >
                  <Text style={styles.chipText}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>I'm ready to hang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: Colors.light.background,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    padding: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: Colors.light.cardBackground,
    color: Colors.light.text,
    minHeight: 60,
  },
  inputContainer: {
    position: 'relative',
  },
  inputWithCounter: {
    paddingRight: 60,
    paddingBottom: 24,
  },
  charCount: {
    position: 'absolute',
    right: 12,
    bottom: 32, // Adjusted to be inside the input area visually
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  charCountLimit: {
    color: Colors.light.secondary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
    marginBottom: 12,
    marginTop: 4,
  },
  chipsScrollContainer: {
    paddingBottom: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.buttonBackground,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedChip: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  selectedChipText: {
    color: 'white',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
