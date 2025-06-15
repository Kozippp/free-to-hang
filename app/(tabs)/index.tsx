import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  Animated,
  Platform,
  RefreshControl
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Settings, UserPlus } from 'lucide-react-native';

import Colors from '@/constants/colors';
import StatusToggle from '@/components/StatusToggle';
import UserStatusBar from '@/components/UserStatusBar';
import FriendCard from '@/components/FriendCard';
import ActivityModal from '@/components/ActivityModal';
import PlanBuilderSheet from '@/components/PlanBuilderSheet';
import AddFriendsModal from '@/components/friends/AddFriendsModal';
import useHangStore from '@/store/hangStore';
import { useAuth } from '@/contexts/AuthContext';

export default function HangScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { 
    user,
    friends, 
    offlineFriends,
    selectedFriends,
    pingedFriends,
    isAvailable, 
    activity,
    setActivity,
    toggleAvailability,
    selectFriend,
    unselectFriend,
    isSelectedFriend,
    loadUserData,
    loadFriends,
    startRealTimeUpdates,
    stopRealTimeUpdates
  } = useHangStore();
  
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [isAnonymousPlan, setIsAnonymousPlan] = useState(false);
  const [showAddFriendsModal, setShowAddFriendsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Load user data when component mounts or auth user changes
  useEffect(() => {
    if (authUser) {
      // Add a small delay to ensure everything is ready
      const timer = setTimeout(() => {
        loadUserData();
        loadFriends();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [authUser]);
  
  // Handle initial state when component mounts
  useEffect(() => {
    if (isAvailable) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isAvailable, fadeAnim]);
  
  // Add real-time updates effect
  useEffect(() => {
    if (authUser) {
      // Start real-time updates only after user is authenticated and data is loaded
      const timer = setTimeout(() => {
        startRealTimeUpdates();
      }, 2000);
      
      return () => {
        clearTimeout(timer);
        stopRealTimeUpdates();
      };
    }
  }, [authUser, startRealTimeUpdates, stopRealTimeUpdates]);
  
  const handleToggle = () => {
    if (!isAvailable) {
      setShowActivityModal(true);
    } else {
      toggleAvailability();
    }
  };
  
  const handleActivitySubmit = (newActivity: string) => {
    setActivity(newActivity);
    toggleAvailability();
  };
  
  const handleFriendSelect = (id: string) => {
    if (isSelectedFriend(id)) {
      unselectFriend(id);
    } else {
      selectFriend(id);
    }
  };
  
  const handleOpenPlanBuilder = (anonymous: boolean = false) => {
    setIsAnonymousPlan(anonymous);
    setShowPlanSheet(true);
  };
  
  const handleClosePlanSheet = () => {
    setShowPlanSheet(false);
    setIsAnonymousPlan(false);
  };

  const handlePlanSubmitted = () => {
    // Don't update state here - let the sheet handle its own closing
    // The new success flow is now handled in the plans tab
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (authUser) {
      await Promise.all([loadUserData(), loadFriends()]);
    }
    setRefreshing(false);
  };
  
  // Get all friends for display (including pinged offline friends)
  const getAllFriends = () => {
    const allFriends = [...friends];
    
    // Add pinged offline friends - add null check for pingedFriends
    const safePingedFriends = pingedFriends || [];
    safePingedFriends.forEach(id => {
      const friend = offlineFriends.find(f => f.id === id);
      if (friend && !allFriends.some(f => f.id === id)) {
        allFriends.push({
          id: friend.id,
          name: friend.name,
          avatar: friend.avatar,
          status: 'pinged' as const,
          activity: '',
          lastActive: friend.lastSeen,
          responseStatus: 'pending' as const
        });
      }
    });
    
    return allFriends;
  };
  
  const safeSelectedFriends = selectedFriends || [];
  const selectedFriendsData = getAllFriends().filter(friend => 
    safeSelectedFriends.includes(friend.id)
  );
  
  return (
    <>
      <Stack.Screen options={{ title: 'Free to Hang', headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Free to Hang</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.addFriendsButton}
                onPress={() => setShowAddFriendsModal(true)}
              >
                <UserPlus size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
                <Settings size={24} color={Colors.light.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {!isAvailable ? (
            <View style={styles.offlineContainer}>
              <Text style={styles.offlineTitle}>
                Let friends see you're free, and see who's also searching for plans tonight.
              </Text>
              <StatusToggle isOn={isAvailable} onToggle={handleToggle} />
            </View>
          ) : (
            <Animated.View 
              style={[
                styles.onlineContainer,
                { opacity: fadeAnim }
              ]}
            >
              <UserStatusBar 
                avatar={user.avatar}
                isAvailable={isAvailable}
                activity={activity}
                onToggle={handleToggle}
              />
              
              <Text style={styles.friendsTitle}>Friends available to hang</Text>
              <Text style={styles.friendsDescription}>Choose the people to suggest a hang.</Text>
              
              <ScrollView 
                style={styles.friendsList}
                showsVerticalScrollIndicator={Platform.OS === 'web'}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Colors.light.primary}
                  />
                }
              >
                {getAllFriends().length > 0 ? (
                  getAllFriends().map((friend) => (
                    <FriendCard
                      key={friend.id}
                      id={friend.id}
                      name={friend.name}
                      avatar={friend.avatar}
                      activity={friend.activity}
                      lastActive={friend.lastActive}
                      selected={isSelectedFriend(friend.id)}
                      onSelect={handleFriendSelect}
                      status={friend.status as 'available' | 'offline' | 'pinged'}
                      responseStatus={friend.responseStatus as 'accepted' | 'maybe' | 'pending' | 'seen' | 'unseen'}
                    />
                  ))
                ) : (
                  <View style={styles.emptyFriendsContainer}>
                    <Text style={styles.emptyFriendsTitle}>
                      No friends available right now
                    </Text>
                    <Text style={styles.emptyFriendsDescription}>
                      Invite your friends to join Free to Hang so you can see when they're available.
                    </Text>
                    <TouchableOpacity 
                      style={styles.inviteFriendsButton}
                      onPress={() => setShowAddFriendsModal(true)}
                    >
                      <UserPlus size={18} color="white" style={styles.inviteFriendsIcon} />
                      <Text style={styles.inviteFriendsText}>Add Friends</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Plan Builder Button */}
                {safeSelectedFriends.length > 0 && (
                  <View style={styles.planBuilderContainer}>
                    <TouchableOpacity 
                      style={styles.planBuilderButton}
                      onPress={() => handleOpenPlanBuilder(false)}
                    >
                      <Text style={styles.planBuilderButtonText}>
                        Suggest a hang with {safeSelectedFriends.length} friend{safeSelectedFriends.length > 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.anonymousPlanButton}
                      onPress={() => handleOpenPlanBuilder(true)}
                    >
                      <Text style={styles.anonymousPlanButtonText}>
                        Send anonymous hang suggestion
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </ScrollView>
        
        {/* Modals */}
        <ActivityModal
          visible={showActivityModal}
          onClose={() => setShowActivityModal(false)}
          onSubmit={handleActivitySubmit}
        />
        
        <PlanBuilderSheet
          visible={showPlanSheet}
          onClose={handleClosePlanSheet}
          selectedFriends={selectedFriendsData}
          isAnonymous={isAnonymousPlan}
          onPlanSubmitted={handlePlanSubmitted}
        />
        
        <AddFriendsModal
          visible={showAddFriendsModal}
          onClose={() => setShowAddFriendsModal(false)}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addFriendsButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    padding: 8,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  offlineTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.light.text,
    marginBottom: 40,
    lineHeight: 24,
  },
  onlineContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  friendsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 30,
    marginBottom: 8,
  },
  friendsDescription: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 20,
  },
  friendsList: {
    flex: 1,
  },
  emptyFriendsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyFriendsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyFriendsDescription: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  inviteFriendsButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteFriendsIcon: {
    marginRight: 4,
  },
  inviteFriendsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  planBuilderContainer: {
    marginTop: 20,
    marginBottom: 40,
    gap: 12,
  },
  planBuilderButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  planBuilderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  anonymousPlanButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  anonymousPlanButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});