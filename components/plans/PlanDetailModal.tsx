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
  Keyboard
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan, ParticipantStatus } from '@/store/plansStore';
import PlanDetailView from './PlanDetailView';
import CompletedPlanDetailView from './CompletedPlanDetailView';

interface PlanDetailModalProps {
  visible: boolean;
  plan: Plan | null;
  onClose: () => void;
  onRespond: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => Promise<void>;
  isCompleted?: boolean;
  onAttendanceUpdate?: (planId: string, userId: string, attended: boolean) => void;
}

export default function PlanDetailModal({
  visible,
  plan,
  onClose,
  onRespond,
  isCompleted,
  onAttendanceUpdate
}: PlanDetailModalProps) {
  const { width } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(width)).current;
  const [headerTitle, setHeaderTitle] = useState(plan?.title ?? '');
  const [canEditHeaderTitle, setCanEditHeaderTitle] = useState(false);
  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false);
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
      setHeaderTitle(plan.title);
      setIsEditingHeaderTitle(false);
    }
  }, [plan?.id, plan?.title]);

  React.useEffect(() => {
    if (isEditingHeaderTitle) {
      headerInputRef.current?.focus();
    }
  }, [isEditingHeaderTitle]);

  const handleHeaderLongPress = () => {
    if (!canEditHeaderTitle || isEditingHeaderTitle) {
      return;
    }
    setIsEditingHeaderTitle(true);
  };

  const handleHeaderTitleChange = (text: string) => {
    setHeaderTitle(text);
  };

  const handleHeaderTitleSave = () => {
    setIsEditingHeaderTitle(false);
  };

  const handleDismissHeaderEditing = () => {
    if (!isEditingHeaderTitle) return;
    headerInputRef.current?.blur();
    Keyboard.dismiss();
    handleHeaderTitleSave();
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
              activeOpacity={canEditHeaderTitle ? 0.7 : 1}
            >
              {isEditingHeaderTitle ? (
                <TextInput
                  ref={headerInputRef}
                  style={styles.headerTitleInput}
                  value={headerTitle}
                  onChangeText={handleHeaderTitleChange}
                  placeholder="Enter plan title"
                  autoFocus
                  onBlur={handleHeaderTitleSave}
                  onSubmitEditing={handleHeaderTitleSave}
                  returnKeyType="done"
                  blurOnSubmit
                />
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
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});