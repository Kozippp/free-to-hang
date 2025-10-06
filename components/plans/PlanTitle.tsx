import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';

export interface PlanTitleProps {
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
  hideTitle?: boolean;
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
  canEdit,
  hideTitle = false
}: PlanTitleProps) {
  return (
    <View style={styles.section}>
      {/* Title - only show if not hidden */}
      {!hideTitle && (
        <>
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
            <TouchableOpacity 
              style={styles.titleContainer}
              onPress={canEdit ? onEditTitle : undefined}
              activeOpacity={canEdit ? 0.7 : 1}
            >
              <Text style={styles.title}>{title}</Text>
            </TouchableOpacity>
          )}
        </>
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
        <TouchableOpacity 
          style={styles.descriptionContainer}
          onPress={canEdit ? onEditDescription : undefined}
          activeOpacity={canEdit ? 0.7 : 1}
        >
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : (
            <Text style={styles.emptyDescription}>
              {canEdit 
                ? "There is no description" 
                : "No description yet"}
            </Text>
          )}
        </TouchableOpacity>
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
