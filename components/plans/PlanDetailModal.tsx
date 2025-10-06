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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);
  
  const handleClose = () => {
    Animated.timing(fadeAnim, {
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
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.fullScreenContainer}>
        {/* Header with back button and title */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={28} color={Colors.light.text} strokeWidth={2} />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text 
              style={styles.headerTitle} 
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {plan.title}
            </Text>
          </View>
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
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
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
});