import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { X, Clock, Calendar, Infinity } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface GhostSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDuration: (duration: '1_day' | '3_days' | 'forever') => void;
}

export default function GhostSelectionModal({ 
  visible, 
  onClose, 
  onSelectDuration 
}: GhostSelectionModalProps) {
  const handleSelection = (duration: '1_day' | '3_days' | 'forever') => {
    onSelectDuration(duration);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.modal}
          activeOpacity={1}
          onPress={() => {}} // Prevent closing when clicking inside modal
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color={Colors.light.secondaryText} />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>Ghost Friend</Text>
          <Text style={styles.subtitle}>
            They won't see your availability status and you won't see theirs
          </Text>

          {/* Duration Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.option}
              onPress={() => handleSelection('1_day')}
            >
              <View style={styles.optionIcon}>
                <Clock size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Ghost for 1 day</Text>
                <Text style={styles.optionSubtitle}>Hide availability for 24 hours</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.option}
              onPress={() => handleSelection('3_days')}
            >
              <View style={styles.optionIcon}>
                <Calendar size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Ghost for 3 days</Text>
                <Text style={styles.optionSubtitle}>Hide availability for 72 hours</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.option}
              onPress={() => handleSelection('forever')}
            >
              <View style={styles.optionIcon}>
                <Infinity size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Ghost forever</Text>
                <Text style={styles.optionSubtitle}>Hide until manually removed</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    minWidth: 320,
    maxWidth: 360,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    lineHeight: 18,
  },
}); 