import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Edit2, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PlanDescriptionProps {
  description: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onChange: (text: string) => void;
  canEdit: boolean;
}

export default function PlanDescription({ 
  description, 
  isEditing, 
  onEdit, 
  onSave, 
  onChange,
  canEdit
}: PlanDescriptionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What are we doing?</Text>
      
      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={onChange}
            placeholder="Add a description of the plan"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
            onBlur={onSave}
          />
        </View>
      ) : (
        <View style={styles.descriptionContainer}>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : (
            <Text style={styles.emptyDescription}>
              {canEdit 
                ? "Add a description of what you're planning to do" 
                : "No description yet"}
            </Text>
          )}
          
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
    marginBottom: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  description: {
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 22,
    flex: 1,
  },
  emptyDescription: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
    flex: 1,
  },
  editButton: {
    padding: 8,
    marginLeft: 8,
  },
  editContainer: {
    flexDirection: 'column',
  },
  descriptionInput: {
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    marginBottom: 8,
  },
  saveButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
});