git add .
git commit -mimport React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
} from 'react-native';
import Colors from '@/constants/colors';
import { X, Plus, Users, Bell, UserPlus } from 'lucide-react-native';
import PingOfflineModal from './PingOfflineModal';
import { offlineFriends } from '@/constants/mockData';
import useHangStore from '@/store/hangStore';
import usePlansStore, { ParticipantStatus } from '@/store/plansStore';
import { useRouter } from 'expo-router';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'available' | 'offline' | 'pinged';
  activity?: string;
  lastActive?: string;
  lastSeen?: string;
}

interface PlanSuggestionSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedFriends: Friend[];
  availableFriends: Friend[];
  isAnonymous: boolean;
  onPlanSubmitted: () => void;
}

export default function PlanSuggestionSheet({
  visible,
  onClose,
  selectedFriends,
  availableFriends,
  isAnonymous,
  onPlanSubmitted,
}: PlanSuggestionSheetProps) {
  const { user, clearSelectedFriends } = useHangStore();
  const { addPlan } = usePlansStore();
  const router = useRouter();
  
  const [planTitle, setPlanTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [additionalFriends, setAdditionalFriends] = useState<string[]>([]);
  const [pingedFriends, setPingedFriends] = useState<string[]>([]);
  const [showPingModal, setShowPingModal] = useState(false);
  const [removedFriends, setRemovedFriends] = useState<string[]>([]);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { height } = Dimensions.get('window');
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Setup pan responder for swipe-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes in the top area
        return gestureState.dy > 10 && 
               Math.abs(gestureState.dx) < Math.abs(gestureState.dy) && 
               gestureState.y0 < 100; // Only activate in top area
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Only allow downward movement
          slideAnim.setValue(1 - (gestureState.dy / height));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // If swiped down far enough, close the sheet
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
  
  // Reset all states when the modal becomes visible
  useEffect(() => {
    if (!visible) {
      // Reset states when modal closes
      resetStates();
    } else {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);
  
  const resetStates = () => {
    setPlanTitle('');
    setDescription('');
    setShowInvitePanel(false);
    setAdditionalFriends([]);
    setPingedFriends([]);
    setRemovedFriends([]);
  };
  
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  
  const handleSubmit = () => {
    // Create a new plan object
    const newPlan = {
      id: Date.now().toString(), // Generate a unique ID
      title: planTitle,
      description: description,
      type: isAnonymous ? 'anonymous' as const : 'normal' as const,
      creator: isAnonymous ? null : {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      participants: getAllFriends().map(friend => ({
        id: friend.id,
        name: friend.name,
        avatar: friend.avatar,
        status: friend.id === user.id ? 'accepted' as ParticipantStatus : 'pending' as ParticipantStatus
      })),
      date: 'Tomorrow, 7:00 PM', // This would be set by the user in a real app
      location: 'To be determined', // This would be set by the user in a real app
      isRead: true, // Mark as read since you created it
      createdAt: new Date().toISOString()
    };
    
    // DISABLED: Optimistic plan addition that causes race conditions
    // Plans should only be added after server confirmation
    // addPlan(newPlan);
    
    // Animate the sheet closing
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Clear selected friends in the store
      clearSelectedFriends();
      // Notify parent component that plan was submitted
      onPlanSubmitted();
      // Close the plan sheet
      onClose();
      
      // Navigate to the appropriate tab based on plan type
      if (isAnonymous) {
        router.push('/plans');
        // Set a timeout to ensure the navigation completes before showing success message
        setTimeout(() => {
          // In a real app, you would show a success message here
          console.log('Anonymous plan created successfully!');
        }, 300);
      } else {
        router.push('/plans');
        // Set a timeout to ensure the navigation completes before showing success message
        setTimeout(() => {
          // In a real app, you would show a success message here
          console.log('Plan created successfully!');
        }, 300);
      }
    });
  };
  
  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  
  const toggleAdditionalFriend = (friendId: string) => {
    if (additionalFriends.includes(friendId)) {
      setAdditionalFriends(additionalFriends.filter(id => id !== friendId));
    } else {
      const newSelected = [...additionalFriends, friendId];
      setAdditionalFriends(newSelected);
    }
  };
  
  const handlePingFriend = (friendId: string) => {
    if (!pingedFriends.includes(friendId)) {
      setPingedFriends([...pingedFriends, friendId]);
    }
  };
  
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };
  
  const toggleInvitePanel = () => {
    setShowInvitePanel(!showInvitePanel);
  };
  
  const removeFriend = (friendId: string) => {
    // Handle removing a friend from any list they might be in
    if (additionalFriends.includes(friendId)) {
      setAdditionalFriends(additionalFriends.filter(id => id !== friendId));
    } else if (pingedFriends.includes(friendId)) {
      setPingedFriends(pingedFriends.filter(id => id !== friendId));
    } else {
      // For initially selected friends, add to removed list
      setRemovedFriends([...removedFriends, friendId]);
    }
  };
  
  // Get all friends for display (selected + additional + pinged, minus removed)
  const getAllFriends = () => {
    // Start with initially selected friends that haven't been removed
    const allFriends = selectedFriends
      .filter(friend => !removedFriends.includes(friend.id));
    
    // Add current user with (you) label
    const currentUser = {
      ...user,
      name: `${user.name} (you)`,
      status: 'available' as const
    };
    
    // Add user at the beginning of the list
    allFriends.unshift(currentUser);
    
    // Add additional friends from available online friends
    additionalFriends.forEach(id => {
      const friend = availableFriends.find(f => f.id === id);
      if (friend && !allFriends.some(f => f.id === id)) {
        allFriends.push(friend);
      }
    });
    
    // Add pinged offline friends
    pingedFriends.forEach(id => {
      const friend = offlineFriends.find(f => f.id === id);
      if (friend && !allFriends.some(f => f.id === id)) {
        allFriends.push({
          ...friend,
          status: 'pinged' as const
        });
      }
    });
    
    return allFriends;
  };

  // Get available friends that haven't been selected yet
  const getAvailableFriendsToAdd = () => {
    // Get all currently selected friend IDs (including additional but excluding removed)
    const allSelectedIds = [
      ...additionalFriends,
      ...selectedFriends.filter(f => !removedFriends.includes(f.id)).map(f => f.id)
    ];
    
    // Return available friends not in the selected list
    return availableFriends.filter(friend => !allSelectedIds.includes(friend.id));
  };
  
  if (!visible) return null;
  
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.sheetContainer,
                { transform: [{ translateY }] },
                isAnonymous ? styles.anonymousSheet : null,
              ]}
            >
              <View style={styles.handle} {...panResponder.panHandlers} />
              
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <X size={24} color={Colors.light.secondaryText} />
              </TouchableOpacity>
              
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={100}
              >
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.content}
                  contentContainerStyle={styles.contentContainer}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  alwaysBounceVertical={true}
                >
                  <Text style={[
                    styles.title,
                    isAnonymous ? styles.anonymousTitle : null
                  ]}>
                    {isAnonymous ? 'Anonymous Plan' : 'Create Plan'}
                  </Text>
                  
                  {isAnonymous && (
                    <View style={styles.anonymousInfo}>
                      <Text style={styles.anonymousInfoText}>
                        Your friends won't know who suggested this plan
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.labelContainer}>
                    <Text style={styles.label}>What's the plan?</Text>
                    <Text style={styles.requiredAsterisk}>*</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={planTitle}
                    onChangeText={setPlanTitle}
                    placeholder="Movie night? Chill in the park?"
                    placeholderTextColor={Colors.light.secondaryText}
                  />
                  
                  <Text style={styles.label}>Description (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add more details about your plan..."
                    placeholderTextColor={Colors.light.secondaryText}
                    multiline
                    numberOfLines={Platform.OS === 'ios' ? 0 : 4}
                    textAlignVertical="top"
                  />
                  
                  <Text style={styles.label}>People</Text>
                  
                  {/* Vertical list of invited people */}
                  <View style={styles.peopleList}>
                    {getAllFriends().map((friend) => (
                      <View key={friend.id} style={styles.personRow}>
                        <View style={styles.personInfo}>
                          <View style={styles.avatarWrapper}>
                            <Image source={{ uri: friend.avatar }} style={styles.avatar} />
                            <View style={[
                              styles.statusDot,
                              friend.status === 'available' && styles.onlineDot,
                              friend.status === 'offline' && styles.offlineDot,
                              friend.status === 'pinged' && styles.pingedDot,
                            ]} />
                          </View>
                          <Text style={styles.personName}>{friend.name}</Text>
                        </View>
                        
                        {/* Show remove button for all except current user */}
                        {friend.id !== 'current' && (
                          <TouchableOpacity 
                            style={styles.removeButton}
                            onPress={() => removeFriend(friend.id)}
                          >
                            <X size={16} color={Colors.light.secondaryText} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                  
                  {/* Add more people button */}
                  <TouchableOpacity 
                    style={styles.addMoreButton}
                    onPress={toggleInvitePanel}
                  >
                    <UserPlus size={18} color={Colors.light.primary} style={styles.addMoreIcon} />
                    <Text style={styles.addMoreText}>Add more people</Text>
                  </TouchableOpacity>
                  
                  {showInvitePanel && (
                    <View style={styles.invitePanel}>
                      <TouchableOpacity 
                        style={styles.invitePanelHeader}
                        onPress={toggleInvitePanel}
                      >
                        <Users size={20} color={Colors.light.secondaryText} />
                        <Text style={styles.invitePanelTitle}>Invite Friends</Text>
                      </TouchableOpacity>
                      
                      {getAvailableFriendsToAdd().length > 0 ? (
                        <>
                          <Text style={styles.inviteSectionTitle}>Friends available now</Text>
                          <ScrollView 
                            style={styles.availableFriendsScrollView}
                            contentContainerStyle={styles.availableFriendsContainer}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                            scrollEventThrottle={16}
                            bounces={false}
                          >
                            {getAvailableFriendsToAdd().map((friend) => (
                              <TouchableOpacity 
                                key={friend.id}
                                style={styles.availableFriendItem}
                                onPress={() => toggleAdditionalFriend(friend.id)}
                              >
                                <View style={styles.availableFriendAvatarContainer}>
                                  <Image source={{ uri: friend.avatar }} style={styles.availableFriendAvatar} />
                                  <View style={[styles.availableFriendStatusDot, styles.onlineDot]} />
                                </View>
                                <View style={styles.availableFriendInfo}>
                                  <Text style={styles.availableFriendName}>{friend.name}</Text>
                                  <Text style={styles.availableFriendActivity}>{friend.activity}</Text>
                                </View>
                                <View style={styles.addFriendButton}>
                                  <Plus size={16} color={Colors.light.primary} />
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </>
                      ) : (
                        <Text style={styles.noMoreFriendsText}>
                          All your available friends have been invited
                        </Text>
                      )}
                      
                      <TouchableOpacity 
                        style={styles.inviteOption}
                        onPress={() => setShowPingModal(true)}
                      >
                        <Bell size={18} color={Colors.light.primary} style={styles.inviteOptionIcon} />
                        <Text style={styles.inviteOptionText}>Ping offline friends</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* Submit button */}
                  <View style={styles.submitButtonContainer}>
                    <TouchableOpacity 
                      style={[
                        styles.submitButton,
                        isAnonymous ? styles.anonymousButton : null,
                        !planTitle ? styles.disabledButton : null
                      ]}
                      onPress={handleSubmit}
                      disabled={!planTitle}
                    >
                      <Text style={styles.submitButtonText}>
                        {isAnonymous ? 'Suggest Anonymously' : 'Suggest Plan'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Add extra padding at the bottom for better scrolling */}
                  <View style={styles.bottomPadding} />
                </ScrollView>
              </KeyboardAvoidingView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      
      <PingOfflineModal
        visible={showPingModal}
        onClose={() => setShowPingModal(false)}
        onPingFriend={handlePingFriend}
        pingedFriends={pingedFriends}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '95%',
    minHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  anonymousSheet: {
    borderTopColor: Colors.light.secondary,
    borderTopWidth: 4,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  anonymousTitle: {
    color: Colors.light.secondary,
  },
  anonymousInfo: {
    backgroundColor: `${Colors.light.secondary}15`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  anonymousInfoText: {
    color: Colors.light.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: Colors.light.secondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: Colors.light.cardBackground,
    color: Colors.light.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Styles for vertical people list
  peopleList: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    backgroundColor: Colors.light.cardBackground,
    overflow: 'hidden',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.light.cardBackground,
  },
  onlineDot: {
    backgroundColor: Colors.light.onlineGreen,
  },
  offlineDot: {
    backgroundColor: Colors.light.offlineGray,
  },
  pingedDot: {
    backgroundColor: '#FFC107', // Amber color for pinged status
  },
  personName: {
    fontSize: 14,
    color: Colors.light.text,
  },
  removeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  // Add more people button
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 20,
    backgroundColor: `${Colors.light.primary}10`,
    borderRadius: 10,
  },
  addMoreIcon: {
    marginRight: 8,
  },
  addMoreText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  invitePanel: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  invitePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  invitePanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 8,
  },
  inviteSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.secondaryText,
    marginBottom: 8,
  },
  availableFriendsScrollView: {
    maxHeight: 200,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  availableFriendsContainer: {
    paddingVertical: 8,
  },
  availableFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: Colors.light.background,
  },
  availableFriendAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  availableFriendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  availableFriendStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.light.background,
  },
  availableFriendInfo: {
    flex: 1,
  },
  availableFriendName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  availableFriendActivity: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  addFriendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Colors.light.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMoreFriendsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  inviteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  inviteOptionIcon: {
    marginRight: 12,
  },
  inviteOptionText: {
    fontSize: 16,
    color: Colors.light.primary,
  },
  submitButtonContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  anonymousButton: {
    backgroundColor: Colors.light.secondary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 60, // Extra padding at the bottom for better scrolling
  },
});