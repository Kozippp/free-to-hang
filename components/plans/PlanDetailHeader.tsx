import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  Keyboard,
  Platform
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { MAX_PLAN_TITLE_LENGTH } from '@/constants/limits';

interface PlanDetailHeaderProps {
  title: string;
  onBack: () => void;
  isEditing: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onTitleChange?: (text: string) => void;
  isSaving?: boolean;
  canEdit: boolean;
  onLayout?: (event: any) => void;
}

export default function PlanDetailHeader({
  title,
  onBack,
  isEditing,
  onEditStart,
  onEditEnd,
  onTitleChange,
  isSaving = false,
  canEdit,
  onLayout
}: PlanDetailHeaderProps) {
  const headerInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (isEditing) {
      // Small timeout to ensure layout is ready
      setTimeout(() => {
        headerInputRef.current?.focus();
      }, 50);
    }
  }, [isEditing]);

  return (
    <View 
      style={styles.header}
      onLayout={onLayout}
    >
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronLeft size={28} color={Colors.light.text} strokeWidth={2} />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.titleContainer}
        onLongPress={onEditStart}
        delayLongPress={1000}
        activeOpacity={canEdit && !isSaving ? 0.7 : 1}
        disabled={!canEdit || isEditing}
      >
        {isEditing ? (
          <View style={styles.headerInputContainer}>
            <TextInput
              ref={headerInputRef}
              style={styles.headerTitleInput}
              value={title}
              onChangeText={onTitleChange}
              placeholder="Enter plan title"
              placeholderTextColor={Colors.light.secondaryText}
              onBlur={onEditEnd}
              onSubmitEditing={onEditEnd}
              returnKeyType="done"
              blurOnSubmit
              maxLength={MAX_PLAN_TITLE_LENGTH}
              multiline={false}
              numberOfLines={1}
              editable={!isSaving}
              selectionColor={Colors.light.primary}
            />
            {isSaving ? (
              <ActivityIndicator
                size="small"
                color={Colors.light.primary}
                style={styles.headerSavingIndicator}
              />
            ) : (
              <Text
                style={[
                  styles.headerCharCount,
                  title.length >= MAX_PLAN_TITLE_LENGTH && styles.headerCharCountLimit
                ]}
              >
                {title.length}/{MAX_PLAN_TITLE_LENGTH}
              </Text>
            )}
          </View>
        ) : (
          <Text 
            style={styles.headerTitle} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title || 'Untitled plan'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    zIndex: 10,
  },
  backButton: {
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerTitleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 0,
  },
  headerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    backgroundColor: Colors.light.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  headerCharCount: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    marginLeft: 8,
  },
  headerCharCountLimit: {
    color: Colors.light.secondary,
    fontWeight: '600',
  },
  headerSavingIndicator: {
    marginLeft: 8,
  },
});
