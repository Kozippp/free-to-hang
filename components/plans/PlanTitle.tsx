import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Edit2, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PlanTitleProps {
  title: string;
  description: string;
  isEditingTitle: boolean;
  isEditingDescription: boolean;
  onEditTitle: () => void;
  onEditDescription: () => void;
  onSaveTitle: () => void;
  onSaveDescription: () => void;
  onChangeTitle: (text: string) => void;
  onChangeDescription: (text: string) => void;
  canEdit: boolean;
}

export default function PlanTitle({ 
  title, 
  description,
  isEditingTitle, 
  isEditingDescription,
  onEditTitle, 
  onEditDescription,
  onSaveTitle, 
  onSaveDescription,
  onChangeTitle,
  onChangeDescription,
  canEdit
}: PlanTitleProps) {
  return (
    <View style={styles.section}>
      {/* Title */}
      {isEditingTitle ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={onChangeTitle}
            placeholder="Enter plan title"
            autoFocus
            onBlur={onSaveTitle}
            onSubmitEditing={onSaveTitle}
          />
        </View>
      ) : (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {canEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEditTitle}>
              <Edit2 size={16} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Description */}
      {isEditingDescription ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={onChangeDescription}
            placeholder="Add a description of the plan"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
            onBlur={onSaveDescription}
          />
        </View>
      ) : (
        <View style={styles.descriptionContainer}>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : (
            <Text style={styles.emptyDescription}>
              {canEdit 
                ? "Add a description of the plan." 
                : "No description yet"}
            </Text>
          )}
          
          {canEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEditDescription}>
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    marginBottom: 12,
  },
  titleInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    padding: 0,
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
  descriptionInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
  },
});