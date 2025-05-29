import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, SafeAreaView, Animated, Dimensions } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import TabBar from '@/components/plans/TabBar';
import InvitationCard from '@/components/plans/InvitationCard';
import PlanDetailModal from '@/components/plans/PlanDetailModal';
import PlanCreatedSuccessModal from '@/components/PlanCreatedSuccessModal';
import usePlansStore, { Plan, ParticipantStatus } from '@/store/plansStore';

export default function PlansScreen() {
  const [activeTab, setActiveTab] = useState('Invitations');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [isAnonymousPlan, setIsAnonymousPlan] = useState(false);
  
  const { invitations, activePlans, completedPlans, markAsRead, respondToPlan } = usePlansStore();
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const tabs = ['Invitations', 'Plan', 'Completed'];
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(0)).current;

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
        
        // Immediately switch to the correct tab
        setActiveTab(targetTab);
        setNewPlanTitle(newestPlan.title);
        setIsAnonymousPlan(newestPlan.type === 'anonymous');
        
        // Show success modal with short delay for smooth transition
        setTimeout(() => {
          setShowSuccessModal(true);
        }, 300);
        
        // Clear the URL parameter after handling
        setTimeout(() => {
          router.replace('/plans');
        }, 1000);
      }
    }
  }, [params.newPlan, invitations, activePlans, router]);

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
      <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} yet</Text>
      <Text style={styles.emptyDescription}>
        {activeTab === 'Invitations' 
          ? "When someone invites you to hang out, you'll see it here."
          : activeTab === 'Plan'
            ? "Plans you've accepted will appear here."
            : "Your past hangouts will be shown here."
        }
      </Text>
    </View>
  );
  
  // Count unread invitations
  const unreadCount = invitations.filter(plan => !plan.isRead).length;
  
  const renderPlanItem = ({ item, index }: { item: Plan; index: number }) => {
    return (
      <InvitationCard plan={item} onPress={handlePlanPress} />
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
                data={invitations}
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
                    data={activePlans}
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
                  <Text style={styles.comingSoonText}>Completed plans will be shown here</Text>
                )}
              </View>
            )}
          </Animated.View>
        </PanGestureHandler>
        
        <PlanDetailModal
          visible={modalVisible}
          plan={selectedPlan}
          onClose={handleCloseModal}
          onRespond={handleRespondToPlan}
        />
        
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
  emptyDescription: {
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
});