import React from 'react';
import { StyleSheet, View, Text, Switch, TouchableOpacity, Alert } from 'react-native';
import { Users } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PlanVisibilityToggleProps {
  isVisible: boolean;
  acceptingMode: string;
  onToggle: () => void;
  onChangeMode: (mode: string) => void;
  canVote: boolean;
}

export default function PlanVisibilityToggle({ 
  isVisible, 
  acceptingMode, 
  onToggle,
  onChangeMode,
  canVote
}: PlanVisibilityToggleProps) {
  
  const handleToggle = () => {
    if (!canVote) {
      Alert.alert(
        'Cannot Change Visibility',
        'You need to respond "Going" to the plan to change visibility settings.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    onToggle();
  };

  const handleModeChange = (mode: string) => {
    if (!canVote) {
      Alert.alert(
        'Cannot Change Mode',
        'You need to respond "Going" to the plan to change who can join.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    onChangeMode(mode);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Users size={20} color={Colors.light.text} style={styles.headerIcon} />
        <Text style={styles.sectionTitle}>Free to Hang Toggle</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.toggleContainer}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleTitle}>
            Show this plan in Free to Hang
          </Text>
          <Text style={styles.toggleDescription}>
            Make this plan visible to all participants' friends
          </Text>
        </View>
        
        <Switch
          value={isVisible}
          onValueChange={handleToggle}
          trackColor={{ false: '#D1D5DB', true: `${Colors.light.primary}80` }}
          thumbColor={isVisible ? Colors.light.primary : '#F3F4F6'}
          pointerEvents="none"
        />
      </TouchableOpacity>
      
      {isVisible && (
        <View style={styles.modeContainer}>
          <Text style={styles.modeTitle}>Who can join?</Text>
          
          <View style={styles.modeOptions}>
            <TouchableOpacity
              style={[
                styles.modeOption,
                acceptingMode === 'accepting' && styles.selectedModeOption
              ]}
              onPress={() => handleModeChange('accepting')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.modeOptionText,
                acceptingMode === 'accepting' && styles.selectedModeOptionText
              ]}>
                Accepting Only
              </Text>
              <Text style={styles.modeDescription}>
                Join requests require approval
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modeOption,
                acceptingMode === 'public' && styles.selectedModeOption
              ]}
              onPress={() => handleModeChange('public')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.modeOptionText,
                acceptingMode === 'public' && styles.selectedModeOptionText
              ]}>
                Public
              </Text>
              <Text style={styles.modeDescription}>
                Anyone can join freely
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  modeContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 16,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 8,
  },
  modeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  modeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.buttonBackground,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedModeOption: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}10`,
  },
  modeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 4,
  },
  selectedModeOptionText: {
    color: Colors.light.primary,
  },
  modeDescription: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
});