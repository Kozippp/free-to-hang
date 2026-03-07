import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  TextInput,
  Pressable,
  Keyboard,
  Alert,
  ActivityIndicator
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { MAX_PLAN_TITLE_LENGTH } from '@/constants/limits';
import usePlansStore, { Plan, ParticipantStatus } from '@/store/plansStore';
import PlanDetailView from './PlanDetailView';
import CompletedPlanDetailView from './CompletedPlanDetailView';
import { useAuth } from '@/contexts/AuthContext';
import { plansService } from '@/lib/plans-service';

interface PlanDetailModalProps {
  visible: boolean;
  plan: Plan | null;
  onClose: () => void;
  onRespond: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => Promise<void>;
  isCompleted?: boolean;
  onAttendanceUpdate?: (planId: string, userId: string, attended: boolean) => void;
  initialTab?: string;
  isInitialLoading?: boolean;
}

export default function PlanDetailModal({
  visible,
  plan,
  onClose,
  onRespond,
  isCompleted,
  onAttendanceUpdate,
  initialTab,
  isInitialLoading
}: PlanDetailModalProps) {
  const { width } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(width)).current;
  const loadPlan = usePlansStore(state => state.loadPlan);
  const { user: authUser } = useAuth();
  const [headerTitle, setHeaderTitle] = useState(
    plan?.title?.slice(0, MAX_PLAN_TITLE_LENGTH) ?? ''
  );
  const [canEditHeaderTitle, setCanEditHeaderTitle] = useState(false);
  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false);
  const [isSavingHeaderTitle, setIsSavingHeaderTitle] = useState(false);
  const headerInputRef = useRef<TextInput | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  
  React.useEffect(() => {
    if (visible) {
      // Slide in from right to left
      slideAnim.setValue(width);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 50,
      }).start();
    }
  }, [visible]);
  
  const handleClose = () => {
    // Slide out from left to right
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  
  React.useEffect(() => {
    if (plan) {
      setHeaderTitle(plan.title?.slice(0, MAX_PLAN_TITLE_LENGTH) ?? '');
      setIsEditingHeaderTitle(false);
    }
  }, [plan?.id, plan?.title]);

  React.useEffect(() => {
    if (isEditingHeaderTitle) {
      headerInputRef.current?.focus();
    }
  }, [isEditingHeaderTitle]);

  const handleHeaderLongPress = () => {
    if (!canEditHeaderTitle || isEditingHeaderTitle || isSavingHeaderTitle) {
      return;
    }
    setIsEditingHeaderTitle(true);
  };

  const handleHeaderTitleChange = (text: string) => {
    if (isSavingHeaderTitle) {
      return;
    }
    setHeaderTitle(text.slice(0, MAX_PLAN_TITLE_LENGTH));
  };

  const handleHeaderTitleSave = async () => {
    if (!plan || isSavingHeaderTitle) {
      setIsEditingHeaderTitle(false);
      return;
    }

    const trimmedTitle = headerTitle.trim();

    if (!trimmedTitle) {
      Alert.alert('Title required', 'Please enter a plan title.');
      setHeaderTitle(plan.title?.slice(0, MAX_PLAN_TITLE_LENGTH) ?? '');
      setIsEditingHeaderTitle(false);
      return;
    }

    if (trimmedTitle === (plan.title || '').trim()) {
      setHeaderTitle(trimmedTitle.slice(0, MAX_PLAN_TITLE_LENGTH));
      setIsEditingHeaderTitle(false);
      return;
    }

    try {
      setIsSavingHeaderTitle(true);
      Keyboard.dismiss();
      await plansService.updatePlan(plan.id, { title: trimmedTitle });
      await loadPlan(plan.id, authUser?.id);
      setHeaderTitle(trimmedTitle.slice(0, MAX_PLAN_TITLE_LENGTH));
    } catch (error) {
      console.error('❌ Error updating plan title:', error);
      const message = error instanceof Error
        ? error.message
        : 'Failed to update the plan title. Please try again.';
      Alert.alert('Title update failed', message);
      setHeaderTitle(plan.title?.slice(0, MAX_PLAN_TITLE_LENGTH) ?? '');
    } finally {
      setIsSavingHeaderTitle(false);
      setIsEditingHeaderTitle(false);
    }
  };

  const handleDismissHeaderEditing = () => {
    if (!isEditingHeaderTitle) return;
    headerInputRef.current?.blur();
    Keyboard.dismiss();
  };

  if (!plan) return null;
  
  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={[
          styles.fullScreenContainer,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          {isEditingHeaderTitle && (
            <Pressable 
              style={[styles.editDismissOverlay, { top: headerHeight }]}
              onPress={handleDismissHeaderEditing}
            />
          )}
          {/* Header with back button and title */}
          <View 
            style={styles.header}
            onLayout={(event) => {
              setHeaderHeight(event.nativeEvent.layout.height);
            }}
          >
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={28} color={Colors.light.text} strokeWidth={2} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.titleContainer}
              onLongPress={handleHeaderLongPress}
              delayLongPress={1000}
              activeOpacity={canEditHeaderTitle && !isSavingHeaderTitle ? 0.7 : 1}
            >
              {isEditingHeaderTitle ? (
                <View style={styles.headerInputContainer}>
                  <TextInput
                    ref={headerInputRef}
                    style={styles.headerTitleInput}
                    value={headerTitle}
                    onChangeText={handleHeaderTitleChange}
                    placeholder="Enter plan title"
                    placeholderTextColor={Colors.light.secondaryText}
                    autoFocus
                    onBlur={handleHeaderTitleSave}
                    onSubmitEditing={handleHeaderTitleSave}
                    returnKeyType="done"
                    blurOnSubmit
                    maxLength={MAX_PLAN_TITLE_LENGTH}
                    multiline={false}
                    numberOfLines={1}
                    editable={!isSavingHeaderTitle}
                    selectionColor={Colors.light.primary}
                  />
                  {isSavingHeaderTitle ? (
                    <ActivityIndicator
                      size="small"
                      color={Colors.light.primary}
                      style={styles.headerSavingIndicator}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.headerCharCount,
                        headerTitle.length >= MAX_PLAN_TITLE_LENGTH && styles.headerCharCountLimit
                      ]}
                    >
                      {headerTitle.length}/{MAX_PLAN_TITLE_LENGTH}
                    </Text>
                  )}
                </View>
              ) : (
                <Text 
                  style={styles.headerTitle} 
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {headerTitle || 'Untitled plan'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          {isCompleted ? (
            <CompletedPlanDetailView 
              plan={plan} 
              onClose={handleClose} 
              onAttendanceUpdate={onAttendanceUpdate} 
            />
          ) : (
            <PlanDetailView 
              plan={plan} 
              onClose={handleClose} 
              onRespond={onRespond} 
              editedTitle={headerTitle}
              onEditPermissionChange={setCanEditHeaderTitle}
              initialTab={initialTab}
              isInitialLoading={isInitialLoading}
            />
          )}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  editDismissOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
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
    paddingVertical: 8,
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