import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  Modal, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView
} from 'react-native';
import { activities } from '@/constants/mockData';
import Colors from '@/constants/colors';
import { X } from 'lucide-react-native';

interface ActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (activity: string) => void;
  initialActivity?: string;
}

export default function ActivityModal({ 
  visible, 
  onClose, 
  onSubmit,
  initialActivity = ''
}: ActivityModalProps) {
  const [activity, setActivity] = useState(initialActivity);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  const handleSubmit = () => {
    // If there are selected activities, use those; otherwise use the text input
    const finalActivity = selectedActivities.length > 0 
      ? selectedActivities.join(', ')
      : activity;
      
    onSubmit(finalActivity);
    onClose();
    
    // Reset state
    setActivity('');
    setSelectedActivities([]);
  };

  const handleActivitySelect = (activityName: string) => {
    // Toggle selection with a maximum of 3 activities
    if (selectedActivities.includes(activityName)) {
      setSelectedActivities(selectedActivities.filter(a => a !== activityName));
      setActivity(selectedActivities.filter(a => a !== activityName).join(', '));
    } else if (selectedActivities.length < 3) {
      const newSelected = [...selectedActivities, activityName];
      setSelectedActivities(newSelected);
      setActivity(newSelected.join(', '));
    }
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
            
            <TextInput
              style={styles.input}
              value={activity}
              onChangeText={setActivity}
              placeholder="E.g., Coffee, Movie night..."
              placeholderTextColor={Colors.light.secondaryText}
              autoFocus={false} // Don't auto-focus the keyboard
            />
            
            <Text style={styles.suggestionsTitle}>Quick suggestions</Text>
            
            <ScrollView 
              horizontal={true} 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activitiesScrollContainer}
            >
              {activities.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.activityButton,
                    selectedActivities.includes(item.name) && styles.selectedActivity
                  ]}
                  onPress={() => handleActivitySelect(item.name)}
                >
                  <Text 
                    style={[
                      styles.activityText,
                      selectedActivities.includes(item.name) && styles.selectedActivityText
                    ]}
                  >
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: Colors.light.cardBackground,
    color: Colors.light.text,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
    marginBottom: 12,
  },
  activitiesScrollContainer: {
    paddingBottom: 20,
  },
  activityButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.buttonBackground,
    marginRight: 8,
  },
  selectedActivity: {
    backgroundColor: Colors.light.primary,
  },
  activityText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  selectedActivityText: {
    color: 'white',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#4CAF50', // Green color
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});