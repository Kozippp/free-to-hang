import React, { useRef } from 'react';
import {
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  SafeAreaView
} from 'react-native';
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
  initialTab?: string;
}

export default function PlanDetailModal({
  visible,
  plan,
  onClose,
  onRespond,
  isCompleted,
  onAttendanceUpdate,
  initialTab
}: PlanDetailModalProps) {
  const { width } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(width)).current;
  
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
  
  const handleClose = (skipAnimation = false) => {
    if (skipAnimation) {
      onClose();
      return;
    }
    
    // Slide out from left to right
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  
  if (!plan) return null;
  
  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={() => handleClose()}
    >
      <Animated.View 
        style={[
          styles.fullScreenContainer,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          {isCompleted ? (
            <CompletedPlanDetailView 
              plan={plan} 
              onClose={() => handleClose()} 
              onAttendanceUpdate={onAttendanceUpdate} 
            />
          ) : (
            <PlanDetailView 
              plan={plan} 
              onClose={handleClose} 
              onRespond={onRespond}
              initialTab={initialTab}
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
    // Transparent background so we can see through to the underlying screen
    backgroundColor: 'transparent', 
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
