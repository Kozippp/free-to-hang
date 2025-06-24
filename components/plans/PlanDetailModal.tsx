import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  PanResponder,
  Dimensions,
  Platform,
  SafeAreaView
} from 'react-native';
import { X } from 'lucide-react-native';
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
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { height } = Dimensions.get('window');
  
  // Setup pan responder for swipe-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Respond to downward swipes anywhere in the header area
        return gestureState.dy > 10 && 
               Math.abs(gestureState.dx) < Math.abs(gestureState.dy) && 
               gestureState.y0 < 100;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Only allow downward movement
          slideAnim.setValue(1 - (gestureState.dy / height));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // If swiped down far enough, close the modal
          handleClose();
        } else {
          // Otherwise, snap back to open position
          Animated.spring(slideAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;
  
  React.useEffect(() => {
    if (visible) {
      // Ensure the modal opens fully
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);
  
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  
  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  
  if (!plan) return null;
  
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY }] }
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
            
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
            
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
              />
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  modalContainer: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%', // Increased to 90% of screen height
    minHeight: '70%', // Minimum height to ensure it opens properly on all devices
  },
  safeArea: {
    flex: 1,
  },
  handleContainer: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
});