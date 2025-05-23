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
  const [highlightedPlanId, setHighlightedPlanId] = useState<string | null>(null);
  
  const { invitations, activePlans, completedPlans, markAsRead, respondToPlan } = usePlansStore();
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const tabs = ['Invitations', 'Plan', 'Completed'];
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(0)).current;
  const newPlanAnimation = useRef(new Animated.Value(0)).current;
  const tabSwitchAnimation = useRef(new Animated.Value(0)).current;
  const dropInAnimation = useRef(new Animated.Value(-100)).current;

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
                data={invitations}
                renderItem={renderPlanItem}
                keyExtractor={(item) => item.id}
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
                    keyExtractor={(item) => item.id}
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