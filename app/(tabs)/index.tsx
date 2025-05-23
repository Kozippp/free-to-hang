import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  Platform,
  Animated,
  Image
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import StatusToggle from '@/components/StatusToggle';
import UserStatusBar from '@/components/UserStatusBar';
import FriendCard from '@/components/FriendCard';
import ActivityModal from '@/components/ActivityModal';
import PlanSuggestionSheet from '@/components/plans/PlanSuggestionSheet';
import useHangStore from '@/store/hangStore';
import { mockFriends, offlineFriends } from '@/constants/mockData';

export default function HangScreen() {
  const { 
    user, 
    friends, 
    isAvailable, 
    activity, 
    selectedFriends,
    pingedFriends,
    toggleAvailability, 
    setActivity,
    selectFriend,
    unselectFriend,
    isSelectedFriend,
    clearSelectedFriends
  } = useHangStore();
  
  const router = useRouter();
  
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [isAnonymousPlan, setIsAnonymousPlan] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
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
  
  // Get all friends for display (including pinged offline friends)
  const getAllFriends = () => {
    const allFriends = [...mockFriends];
    
    // Add pinged offline friends
    pingedFriends.forEach(id => {
      const friend = offlineFriends.find(f => f.id === id);
      if (friend && !allFriends.some(f => f.id === id)) {
        allFriends.push({
          id: friend.id,
          name: friend.name,
          avatar: friend.avatar,
          status: 'pinged' as const,
          activity: '',
          lastActive: friend.lastSeen,
          responseStatus: friend.responseStatus
        });
      }
    });
    
    return allFriends;
  };
  
  const selectedFriendsData = getAllFriends().filter(friend => 
    selectedFriends.includes(friend.id)
  );
  
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: "Free to Hang",
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 20,
            color: Colors.light.primary,
          },
        }} 
      />
      
      <View style={styles.container}>
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
            
            <ScrollView 
              style={styles.friendsList}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
            >
              {getAllFriends().length > 0 ? (
                getAllFriends().map((friend) => (
                  <FriendCard
                    key={friend.id}
                    id={friend.id}
                    name={friend.name}
                    avatar={friend.avatar}
                    activity={friend.activity}
                    lastActive={friend.lastActive || friend.lastSeen}
                    selected={isSelectedFriend(friend.id)}
                    onSelect={handleFriendSelect}
                    status={friend.status as 'online' | 'offline' | 'pinged' | undefined}
                  />
                ))
              ) : (
                <View style={styles.emptyFriendsContainer}>
                  <Text style={styles.emptyFriendsTitle}>
                    No friends online right now
                  </Text>
                  <Text style={styles.emptyFriendsDescription}>
                    Invite your friends to join Free to Hang so you can see when they're available.
                  </Text>
                  <TouchableOpacity 
                    style={styles.inviteFriendsButton}
                    onPress={() => {}}
                  >
                    <UserPlus size={18} color="white" style={styles.inviteFriendsIcon} />
                    <Text style={styles.inviteFriendsText}>Invite Friends</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Add invite friends section at the bottom */}
              {getAllFriends().length > 0 && (
                <View style={styles.inviteFriendsSection}>
                  <Text style={styles.inviteFriendsTitle}>
                    Want to see more friends here?
                  </Text>
                  <TouchableOpacity 
                    style={styles.inviteFriendsButtonSmall}
                    onPress={() => {}}
                  >
                    <UserPlus size={16} color={Colors.light.primary} style={styles.inviteFriendsIconSmall} />
                    <Text style={styles.inviteFriendsTextSmall}>Invite Friends</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        )}
        
        {isAvailable && selectedFriends.length > 0 && (
          <View style={styles.actionButtonsContainer}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.suggestButton, styles.buttonFlex]}
                onPress={() => handleOpenPlanBuilder(false)}
              >
                <Text style={styles.suggestButtonText}>Create Plan</Text>
              </TouchableOpacity>
              
              {selectedFriends.length >= 2 && (
                <TouchableOpacity
                  style={[styles.anonymousButton, styles.buttonFlex]}
                  onPress={() => handleOpenPlanBuilder(true)}
                >
                  <Text style={styles.anonymousButtonText}>Anonymous Plan</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
      
      <ActivityModal
        visible={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onSubmit={handleActivitySubmit}
        initialActivity={activity}
      />
      
      <PlanSuggestionSheet
        visible={showPlanSheet}
        onClose={handleClosePlanSheet}
        selectedFriends={selectedFriendsData}
        isAnonymous={isAnonymousPlan}
        availableFriends={friends.filter(friend => 
          !selectedFriends.includes(friend.id) && friend.status === 'online'
        )}
        onPlanSubmitted={handlePlanSubmitted}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 16,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 26,
  },
  onlineContainer: {
    flex: 1,
  },
  friendsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  friendsList: {
    flex: 1,
  },
  emptyFriendsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyFriendsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyFriendsDescription: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
  },
  inviteFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  inviteFriendsIcon: {
    marginRight: 8,
  },
  inviteFriendsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteFriendsSection: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  inviteFriendsTitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 12,
    textAlign: 'center',
  },
  inviteFriendsButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.light.primary}10`,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  inviteFriendsIconSmall: {
    marginRight: 6,
  },
  inviteFriendsTextSmall: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    padding: 16,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonFlex: {
    flex: 1,
  },
  suggestButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  suggestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  anonymousButton: {
    backgroundColor: Colors.light.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  anonymousButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});