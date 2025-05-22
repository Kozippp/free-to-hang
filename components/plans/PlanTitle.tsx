import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Edit2, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PlanTitleProps {
  title: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onChange: (text: string) => void;
  canEdit: boolean;
}

export default function PlanTitle({ 
  title, 
  isEditing, 
  onEdit, 
  onSave, 
  onChange,
  canEdit
}: PlanTitleProps) {
  return (
    <View style={styles.section}>
      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={onChange}
            placeholder="Enter plan title"
            autoFocus
            onBlur={onSave}
            onSubmitEditing={onSave}
          />
        </View>
      ) : (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {canEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Edit2 size={16} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          )}
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    padding: 0,
  },
  saveButton: {
    padding: 8,
  },
});