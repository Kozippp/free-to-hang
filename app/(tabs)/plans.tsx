import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, SafeAreaView, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import TabBar from '@/components/plans/TabBar';
import InvitationCard from '@/components/plans/InvitationCard';
import CompletedPlanCard from '@/components/plans/CompletedPlanCard';
import PlanDetailModal from '@/components/plans/PlanDetailModal';
import CompletedPlanDetailView from '@/components/plans/CompletedPlanDetailView';
import PlanCreatedSuccessModal from '@/components/PlanCreatedSuccessModal';
import usePlansStore, { Plan, ParticipantStatus } from '@/store/plansStore';
import { testNotifications } from '@/utils/notifications';
import { useAuth } from '@/contexts/AuthContext';

export default function PlansScreen() {
  const [activeTab, setActiveTab] = useState('Invitations');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [isAnonymousPlan, setIsAnonymousPlan] = useState(false);
  const [highlightedPlanId, setHighlightedPlanId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { invitations, activePlans, completedPlans, loadPlans, markAsRead, respondToPlan, processCompletedPlans, addDemoCompletedPlan, updateAttendance, getSortedPlans, markUpdatesAsRead, startRealTimeUpdates, stopRealTimeUpdates } = usePlansStore();
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const tabs = ['Invitations', 'Plan', 'Completed'];
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(0)).current;
  const newPlanAnimation = useRef(new Animated.Value(0)).current;
  const tabSwitchAnimation = useRef(new Animated.Value(0)).current;
  const dropInAnimation = useRef(new Animated.Value(-100)).current;

  // Load plans from API when component mounts
  useEffect(() => {
    if (user?.id) {
      loadPlans(user.id);
      startRealTimeUpdates(user.id);
    }
    
    return () => {
      stopRealTimeUpdates();
    };
  }, [loadPlans, user?.id, startRealTimeUpdates, stopRealTimeUpdates]);

  // Check for new plan creation
  useEffect(() => {
    if (params.newPlan === 'true') {
      // Find the newest plan (highest timestamp)
      const allPlans = [...invitations, ...activePlans];
      const newestPlan = allPlans.reduce((newest, current) => {
        return new Date(current.createdAt) > new Date(newest.createdAt) ? current : newest;
      }, allPlans[0]);

      if (newestPlan) {
        // Set the tab based on plan type and creator
        const targetTab = newestPlan.type === 'anonymous' || newestPlan.creator?.id !== 'current' 
          ? 'Invitations' 
          : 'Plan';
        
        // Animate tab switch for visual feedback
        Animated.timing(tabSwitchAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          // Reset animation
          tabSwitchAnimation.setValue(0);
        });
        
        // Immediately switch to the correct tab
        setActiveTab(targetTab);
        setNewPlanTitle(newestPlan.title);
        setIsAnonymousPlan(newestPlan.type === 'anonymous');
        setHighlightedPlanId(newestPlan.id);
        
        // Start drop-in animation
        dropInAnimation.setValue(-100);
        Animated.spring(dropInAnimation, {
          toValue: 0,
          useNativeDriver: true,
          damping: 10,
          stiffness: 100,
          velocity: 8,
        }).start();
        
        // Show success modal with short delay for smooth transition
        setTimeout(() => {
          setShowSuccessModal(true);
        }, 300);
        
        // Start new plan highlight animation after modal appears
        setTimeout(() => {
          startNewPlanAnimation();
        }, 400);
        
        // Clear the URL parameter after handling
        setTimeout(() => {
          router.replace('/plans');
        }, 1000);
      }
    }
  }, [params.newPlan, invitations, activePlans, router, tabSwitchAnimation, dropInAnimation]);

  // Handle highlighting when coming from invitation response
  useEffect(() => {
    if (params.highlightPlan) {
      const planId = typeof params.highlightPlan === 'string' ? params.highlightPlan : params.highlightPlan[0];
      
      // Set active tab to Plan since user responded to invitation
      setActiveTab('Plan');
      
      // Set highlighted plan
      setHighlightedPlanId(planId);
      
      // Start highlighting animation
      setTimeout(() => {
        startNewPlanAnimation();
      }, 200);
      
      // Clear the parameter after handling
      setTimeout(() => {
        router.replace('/plans');
      }, 500);
    }
  }, [params.highlightPlan, router]);

  // Check for completed plans periodically
  useEffect(() => {
    // Initial check
    processCompletedPlans();
    
    // Set up periodic check every 30 seconds
    const interval = setInterval(() => {
      processCompletedPlans();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [processCompletedPlans]);

  const startNewPlanAnimation = () => {
    // Use only transform animations with native driver
    Animated.timing(newPlanAnimation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      // Fade out after highlighting
      Animated.timing(newPlanAnimation, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setHighlightedPlanId(null);
        dropInAnimation.setValue(0); // Reset drop animation
      });
    });
  };
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      const currentIndex = tabs.indexOf(activeTab);
      
      let nextIndex = currentIndex;
      
      // Determine direction and threshold
      if (translationX > screenWidth * 0.25 || velocityX > 500) {
        // Swipe right - go to previous tab
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (translationX < -screenWidth * 0.25 || velocityX < -500) {
        // Swipe left - go to next tab
        nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
      }
      
      // Animate back to original position
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 100,
      }).start();
      
      // Change tab if necessary
      if (nextIndex !== currentIndex) {
        setActiveTab(tabs[nextIndex]);
      }
    }
  };
  
  const handlePlanPress = (plan: Plan) => {
    setSelectedPlan(plan);
    setModalVisible(true);
    
    // Mark as read when opened
    if (!plan.isRead) {
      markAsRead(plan.id);
    }
    
    // Mark updates as read when plan is opened
    if (plan.hasUnreadUpdates) {
      markUpdatesAsRead(plan.id);
    }
  };
  
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedPlan(null);
  };
  
  const handleRespondToPlan = (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => {
    respondToPlan(planId, response, conditionalFriends);
  };
  
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {activeTab === 'Invitations' && 'No invitations'}
        {activeTab === 'Plan' && 'No active plans'}
        {activeTab === 'Completed' && 'No completed plans'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'Invitations' && 'When someone invites you to hang out, it will appear here.'}
        {activeTab === 'Plan' && 'Create a plan or accept an invitation to get started.'}
        {activeTab === 'Completed' && 'Completed plans will appear here.'}
      </Text>
      
      {/* Test notifications button */}
      {activeTab === 'Invitations' && (
        <TouchableOpacity 
          style={styles.testButton}
          onPress={testNotifications}
        >
          <Text style={styles.testButtonText}>Test Notifications</Text>
        </TouchableOpacity>
      )}
      
      {activeTab === 'Completed' && (
        <TouchableOpacity 
          style={styles.demoButton}
          onPress={addDemoCompletedPlan}
        >
          <Text style={styles.demoButtonText}>Add Demo Completed Plan</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  
  // Count unread invitations
  const unreadCount = invitations.filter(plan => !plan.isRead).length;
  
  const renderPlanItem = ({ item, index }: { item: Plan; index: number }) => {
    const isHighlighted = highlightedPlanId === item.id;
    const isFirst = index === 0 && isHighlighted;
    
    const highlightStyle = isHighlighted ? {
      transform: [
        {
          translateY: isFirst ? dropInAnimation : 0
        },
        {
          scale: newPlanAnimation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 1.08, 1.02]
          })
        }
      ],
      // Remove backgroundColor animation to avoid native driver conflicts
    } : {};

    return (
      <Animated.View style={[
        highlightStyle,
        isHighlighted && { 
          backgroundColor: 'rgba(76, 175, 80, 0.25)',
          borderRadius: 12,
        }
      ]}>
        <InvitationCard plan={item} onPress={handlePlanPress} />
      </Animated.View>
    );
  };
  
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: "Plans",
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 20,
            color: Colors.light.primary,
          },
        }} 
      />
      
      <SafeAreaView style={styles.container}>
        <TabBar 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          unreadCount={unreadCount}
        />
        
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={[styles.contentContainer, { transform: [{ translateX }] }]}>
            {activeTab === 'Invitations' && (
              <FlatList
                data={getSortedPlans(invitations)}
                renderItem={renderPlanItem}
                keyExtractor={(item) => `invitations-${item.id}`}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={renderEmptyState}
              />
            )}
            
            {activeTab === 'Plan' && (
              <View style={styles.tabContent}>
                {activePlans.length === 0 ? renderEmptyState() : (
                  <FlatList
                    data={getSortedPlans(activePlans)}
                    renderItem={renderPlanItem}
                    keyExtractor={(item) => `activePlans-${item.id}`}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                  />
                )}
              </View>
            )}
            
            {activeTab === 'Completed' && (
              <View style={styles.tabContent}>
                {completedPlans.length === 0 ? renderEmptyState() : (
                  <FlatList
                    data={completedPlans}
                    renderItem={({ item }) => (
                      <CompletedPlanCard 
                        plan={item} 
                        onPress={handlePlanPress}
                        userAttended={item.attendanceRecord?.['current']}
                      />
                    )}
                    keyExtractor={(item) => `completedPlans-${item.id}`}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                    ListFooterComponent={() => (
                      completedPlans.length > 0 ? (
                        <View style={styles.finalSeparator} />
                      ) : null
                    )}
                  />
                )}
              </View>
            )}
          </Animated.View>
        </PanGestureHandler>
        
        {/* Plan Detail Modal */}
        {selectedPlan && modalVisible && (
          <PlanDetailModal
            visible={modalVisible}
            plan={selectedPlan}
            onClose={handleCloseModal}
            onRespond={activeTab === 'Completed' ? () => {} : handleRespondToPlan}
            isCompleted={activeTab === 'Completed'}
            onAttendanceUpdate={activeTab === 'Completed' ? updateAttendance : undefined}
          />
        )}
        
        <PlanCreatedSuccessModal
          visible={showSuccessModal}
          planTitle={newPlanTitle}
          isAnonymous={isAnonymousPlan}
          onClose={() => setShowSuccessModal(false)}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  contentContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  tabContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    maxWidth: 250,
  },
  comingSoonText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
  demoButton: {
    backgroundColor: Colors.light.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.background,
    textAlign: 'center',
  },
  finalSeparator: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  testButton: {
    backgroundColor: Colors.light.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.background,
    textAlign: 'center',
  },
});
