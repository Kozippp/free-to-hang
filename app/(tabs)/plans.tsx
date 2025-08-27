import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, SafeAreaView, Animated, Dimensions, TouchableOpacity, RefreshControl } from 'react-native';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { realtimeManager } from '@/lib/RealtimeManager';

export default function PlansScreen() {
  const [activeTab, setActiveTab] = useState('Plan');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  // DISABLED: const [showSuccessModal, setShowSuccessModal] = useState(false);
  // DISABLED: const [newPlanTitle, setNewPlanTitle] = useState('');
  const [isAnonymousPlan, setIsAnonymousPlan] = useState(false);
  // DISABLED: const [highlightedPlanId, setHighlightedPlanId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const rtProbeChannelRef = useRef<any>(null);
  
  const { user } = useAuth();
  const { invitations, activePlans, completedPlans, isLoading, loadPlans, markAsRead, respondToPlan, processCompletedPlans, updateAttendance, getSortedPlans, markUpdatesAsRead } = usePlansStore();
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const tabs = ['Invitations', 'Plan', 'Completed'];
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(0)).current;
  // DISABLED: const newPlanAnimation = useRef(new Animated.Value(0)).current;
  const tabSwitchAnimation = useRef(new Animated.Value(0)).current;
  // DISABLED: const dropInAnimation = useRef(new Animated.Value(-100)).current;

  // Load plans from API when component mounts
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 Loading plans for user:', user.id);
      console.log('🔄 User object:', { id: user.id, email: user.email });
      loadPlans(user.id);

      // Start realtime subscriptions via RealtimeManager
      realtimeManager.start(user.id);

      // Temporary rt_probe subscription
      rtProbeChannelRef.current = supabase
        .channel(`rt_probe_channel_${user.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rt_probe'
          },
          (payload) => {
            console.log('RT_PROBE EVENT:', payload.eventType, payload.table, (payload.new as any)?.id, (payload.new as any)?.note);
          }
        )
        .subscribe((status) => {
          console.log('RT_PROBE STATUS:', status);
        });
    }

    return () => {
      // Stop realtime subscriptions via RealtimeManager
      realtimeManager.stop();

      // Cleanup rt_probe subscription
      if (rtProbeChannelRef.current) {
        supabase.removeChannel(rtProbeChannelRef.current);
        rtProbeChannelRef.current = null;
      }
    };
  }, [loadPlans, user?.id]);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      console.log('🔄 Manual refresh triggered');
      await loadPlans(user.id);
    } catch (error) {
      console.error('❌ Error during manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // DISABLED: Check for new plan creation - now handled by server reload only
  // This prevents race conditions and wrong tab placements
  // useEffect(() => {
  //   if (params.newPlan === 'true') {
  //     // Find the newest plan (highest timestamp)
  //     const allPlans = [...invitations, ...activePlans];
  //     const newestPlan = allPlans.reduce((newest, current) => {
  //       return new Date(current.createdAt) > new Date(newest.createdAt) ? current : newest;
  //     }, allPlans[0]);
  //
  //     if (newestPlan) {
  //       // Set the tab based on plan type and creator
  //       const targetTab = newestPlan.type === 'anonymous' ? 'Invitations' : 'Plan';
  //
  //       // Animate tab switch for visual feedback
  //       Animated.timing(tabSwitchAnimation, {
  //         toValue: 1,
  //         duration: 300,
  //         useNativeDriver: true,
  //       }).start(() => {
  //         // Reset animation
  //         tabSwitchAnimation.setValue(0);
  //       });
  //
  //       // Immediately switch to the correct tab
  //       setActiveTab(targetTab);
  //       // DISABLED: setNewPlanTitle(newestPlan.title);
  //       setIsAnonymousPlan(newestPlan.type === 'anonymous');
  //       // DISABLED: setHighlightedPlanId(newestPlan.id);
  //
  //       // DISABLED: Start drop-in animation
  //       // dropInAnimation.setValue(-100);
  //       // Animated.spring(dropInAnimation, {
  //       //   toValue: 0,
  //       //   useNativeDriver: true,
  //       //   damping: 10,
  //       //   stiffness: 100,
  //       //   velocity: 8,
  //       // }).start();
  //
  //       // DISABLED: Show success modal with short delay for smooth transition
  //       // setTimeout(() => {
  //       //   setShowSuccessModal(true);
  //       // }, 300);
  //
  //       // DISABLED: Start new plan highlight animation after modal appears
  //       // setTimeout(() => {
  //       //   startNewPlanAnimation();
  //       // }, 400);
  //
  //       // Clear the URL parameter after handling
  //       setTimeout(() => {
  //         router.replace('/plans');
  //       }, 1000);
  //     }
  //   }
  // }, [params.newPlan, invitations, activePlans, router, tabSwitchAnimation]);

  // Handle highlighting when coming from invitation response
  useEffect(() => {
    if (params.highlightPlan) {
      const planId = typeof params.highlightPlan === 'string' ? params.highlightPlan : params.highlightPlan[0];

      // Set active tab to Plan since user responded to invitation
      setActiveTab('Plan');

      // DISABLED: Set highlighted plan
      // setHighlightedPlanId(planId);

      // DISABLED: Start highlighting animation
      // setTimeout(() => {
      //   startNewPlanAnimation();
      // }, 200);

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

  // DISABLED: const startNewPlanAnimation = () => {
  //   // Use only transform animations with native driver
  //   Animated.timing(newPlanAnimation, {
  //     toValue: 1,
  //     duration: 800,
  //     useNativeDriver: true,
  //   }).start(() => {
  //     // Fade out after highlighting
  //     Animated.timing(newPlanAnimation, {
  //       toValue: 0,
  //       duration: 600,
  //       useNativeDriver: true,
  //     }).start(() => {
  //       setHighlightedPlanId(null);
  //       dropInAnimation.setValue(0); // Reset drop animation
  //     });
  //   });
  // };
  
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
  
  const handleRespondToPlan = async (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => {
    await respondToPlan(planId, response, conditionalFriends);
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
    </View>
  );
  
  // Count unread invitations
  const unreadCount = invitations.filter(plan => !plan.isRead).length;
  
  const renderPlanItem = ({ item, index }: { item: Plan; index: number }) => {
    // DISABLED: Highlight animation system
    // const isHighlighted = highlightedPlanId === item.id;
    // const isFirst = index === 0 && isHighlighted;
    //
    // const highlightStyle = isHighlighted ? {
    //   transform: [
    //     {
    //       translateY: isFirst ? dropInAnimation : 0
    //     },
    //     {
    //       scale: newPlanAnimation.interpolate({
    //         inputRange: [0, 0.5, 1],
    //         outputRange: [1, 1.08, 1.02]
    //       })
    //     }
    //   ],
    //   // Remove backgroundColor animation to avoid native driver conflicts
    // } : {};

    return (
      <View>
        <InvitationCard plan={item} onPress={handlePlanPress} />
      </View>
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
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing || isLoading}
                    onRefresh={handleRefresh}
                    colors={[Colors.light.primary]}
                    tintColor={Colors.light.primary}
                  />
                }
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
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshing || isLoading}
                        onRefresh={handleRefresh}
                        colors={[Colors.light.primary]}
                        tintColor={Colors.light.primary}
                      />
                    }
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
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshing || isLoading}
                        onRefresh={handleRefresh}
                        colors={[Colors.light.primary]}
                        tintColor={Colors.light.primary}
                      />
                    }
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
            onRespond={activeTab === 'Completed' ? async () => {} : handleRespondToPlan}
            isCompleted={activeTab === 'Completed'}
            onAttendanceUpdate={activeTab === 'Completed' ? updateAttendance : undefined}
          />
        )}
        
        {/* DISABLED: PlanCreatedSuccessModal
        <PlanCreatedSuccessModal
          visible={showSuccessModal}
          planTitle={newPlanTitle}
          isAnonymous={isAnonymousPlan}
          onClose={() => setShowSuccessModal(false)}
        />
        */}
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
  finalSeparator: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },
});
