import React, { useState, useRef, useEffect } from 'react';
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
  FlatList,
} from 'react-native';
import Colors from '@/constants/colors';
import { X, Plus, Check } from 'lucide-react-native';
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
  onFriendsUpdated?: (friends: Friend[]) => void;
  prefilledTitle?: string;
  prefilledDescription?: string;
}

export default function PlanSuggestionSheet({
  visible,
  onClose,
  selectedFriends,
  availableFriends,
  isAnonymous,
  onPlanSubmitted,
  onFriendsUpdated,
  prefilledTitle,
  prefilledDescription,
}: PlanSuggestionSheetProps) {
  const { user, clearSelectedFriends } = useHangStore();
  const { createPlan } = usePlansStore();
  const router = useRouter();
  
  const [planTitle, setPlanTitle] = useState(prefilledTitle || '');
  const [description, setDescription] = useState(prefilledDescription || '');
  const [showAddFriendsModal, setShowAddFriendsModal] = useState(false);
  const [modalSelectedFriends, setModalSelectedFriends] = useState<string[]>([]);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const { height } = Dimensions.get('window');
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Setup pan responder for swipe-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 10 && 
               Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
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
      setTimeout(() => {
        resetStates();
      }, 0);
    } else {
      // Initialize with prefilled data when modal opens
      setTimeout(() => {
        setPlanTitle(prefilledTitle || '');
        setDescription(prefilledDescription || '');
      }, 0);
      
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, prefilledTitle, prefilledDescription]);

  const resetStates = () => {
    setTimeout(() => {
      setPlanTitle('');
      setDescription('');
    }, 0);
  };
  
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  
  const handleSubmit = async () => {
    try {
      // Create plan data for API
      const planData = {
        title: planTitle,
        description: description,
        isAnonymous: isAnonymous,
        date: 'Today, 7:00 PM', // This would be set by the user in a real app
        location: 'To be determined', // This would be set by the user in a real app
        maxParticipants: null,
        invitedFriends: selectedFriends.map(friend => friend.id)
      };
      
      // Create the plan via API
      await createPlan(planData);
      
      // Clear selected friends in the store
      clearSelectedFriends();
      
      // Notify parent component that plan was submitted
      onPlanSubmitted();
      
      // Close the plan sheet with animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onClose();
        
        // Navigate to plans tab with immediate effect
        setTimeout(() => {
          router.push('/plans?newPlan=true');
        }, 100); // Small delay to ensure sheet is closed
      });
      
    } catch (error) {
      console.error('❌ Error creating plan:', error);
      // You might want to show an error message to the user here
    }
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
  
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleOpenAddFriendsModal = () => {
    // Get available friends that aren't already selected
    const availableFriendsIds = availableFriends
      .filter(friend => !selectedFriends.some(selected => selected.id === friend.id))
      .map(friend => friend.id);

    setModalSelectedFriends(availableFriendsIds);
    setShowAddFriendsModal(true);
  };

  const handleAddFriendsConfirm = () => {
    // Add selected friends from modal to the main selected friends list
    const friendsToAdd = availableFriends.filter(friend =>
      modalSelectedFriends.includes(friend.id)
    );

    // Create updated friends list
    const updatedFriends = [...selectedFriends, ...friendsToAdd];

    // Notify parent component of the update
    if (onFriendsUpdated) {
      onFriendsUpdated(updatedFriends);
    }

    setShowAddFriendsModal(false);
    setModalSelectedFriends([]);
  };

  const toggleModalFriendSelection = (friendId: string) => {
    if (modalSelectedFriends.includes(friendId)) {
      setModalSelectedFriends(modalSelectedFriends.filter(id => id !== friendId));
    } else {
      setModalSelectedFriends([...modalSelectedFriends, friendId]);
    }
  };

  const getAvailableFriendsForModal = () => {
    return availableFriends.filter(friend =>
      !selectedFriends.some(selected => selected.id === friend.id)
    );
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
                  nestedScrollEnabled={true}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={true}
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

                  {/* Selected Friends Section */}
                  {selectedFriends.length > 0 && (
                    <View style={styles.invitedFriendsContainer}>
                      <Text style={styles.invitedFriendsLabel}>
                        Inviting ({selectedFriends.length})
                      </Text>
                      <View style={styles.friendsList}>
                        {selectedFriends.map((friend, index) => (
                          <View key={friend.id} style={styles.friendItem}>
                            <Image
                              source={{ uri: friend.avatar }}
                              style={styles.friendAvatar}
                            />
                            <Text style={styles.friendName}>
                              {friend.name}
                            </Text>
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.addFriendButton}
                          onPress={handleOpenAddFriendsModal}
                        >
                          <Plus size={20} color={Colors.light.primary} />
                        </TouchableOpacity>
                      </View>
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
    </Modal>
  );

  return (
    <>
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
                    nestedScrollEnabled={true}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={true}
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

                    {/* Selected Friends Section */}
                    {selectedFriends.length > 0 && (
                      <View style={styles.invitedFriendsContainer}>
                        <Text style={styles.invitedFriendsLabel}>
                          Inviting ({selectedFriends.length})
                        </Text>
                        <View style={styles.friendsList}>
                          {selectedFriends.map((friend, index) => (
                            <View key={friend.id} style={styles.friendItem}>
                              <Image
                                source={{ uri: friend.avatar }}
                                style={styles.friendAvatar}
                              />
                              <Text style={styles.friendName}>
                                {friend.name}
                              </Text>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={styles.addFriendButton}
                            onPress={handleOpenAddFriendsModal}
                          >
                            <View style={styles.addFriendIconContainer}>
                              <Plus size={20} color={Colors.light.primary} />
                            </View>
                            <Text style={styles.addFriendText}>Add</Text>
                          </TouchableOpacity>
                        </View>
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
      </Modal>

      {/* Add Friends Modal */}
      {showAddFriendsModal && (
        <View style={styles.addFriendsModalAbsolute}>
          <TouchableWithoutFeedback onPress={() => setShowAddFriendsModal(false)}>
            <View style={styles.addFriendsOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.addFriendsModalContainer}>
                  <View style={styles.addFriendsHeader}>
                    <Text style={styles.addFriendsTitle}>Add More Friends</Text>
                    <TouchableOpacity
                      style={styles.addFriendsCloseButton}
                      onPress={() => setShowAddFriendsModal(false)}
                    >
                      <X size={24} color={Colors.light.secondaryText} />
                    </TouchableOpacity>
                  </View>

                <FlatList
                  data={getAvailableFriendsForModal()}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item: friend }) => {
                    const isSelected = modalSelectedFriends.includes(friend.id);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.addFriendItem,
                          isSelected && styles.addFriendItemSelected
                        ]}
                        onPress={() => toggleModalFriendSelection(friend.id)}
                      >
                        <Image source={{ uri: friend.avatar }} style={styles.addFriendAvatar} />
                        <View style={styles.addFriendInfo}>
                          <Text style={styles.addFriendName}>{friend.name}</Text>
                        </View>
                        {isSelected && (
                          <View style={styles.addFriendCheck}>
                            <Check size={20} color={Colors.light.primary} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  style={styles.addFriendsList}
                  showsVerticalScrollIndicator={false}
                />

                <View style={styles.addFriendsFooter}>
                  <TouchableOpacity
                    style={styles.addFriendsCancelButton}
                    onPress={() => setShowAddFriendsModal(false)}
                  >
                    <Text style={styles.addFriendsCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.addFriendsConfirmButton,
                      modalSelectedFriends.length === 0 && styles.disabledButton
                    ]}
                    onPress={handleAddFriendsConfirm}
                    disabled={modalSelectedFriends.length === 0}
                  >
                    <Text style={styles.addFriendsConfirmText}>
                      Add {modalSelectedFriends.length > 0 ? `(${modalSelectedFriends.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Light white overlay instead of black
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '90%',
    minHeight: '70%', // Increased to 70% of screen height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
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
    backgroundColor: Colors.light.buttonBackground,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
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
  invitedFriendsContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  invitedFriendsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  friendsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  friendAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
  },
  addFriendIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.light.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addFriendText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.primary,
  },
  addFriendsModalAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
  addFriendsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addFriendsModalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2000,
    zIndex: 2001,
  },
  addFriendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addFriendsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  addFriendsCloseButton: {
    padding: 4,
  },
  addFriendsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  addFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: Colors.light.buttonBackground,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  addFriendItemSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}10`,
  },
  addFriendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  addFriendInfo: {
    flex: 1,
  },
  addFriendName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  addFriendCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.light.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendsFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  addFriendsCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.buttonBackground,
    alignItems: 'center',
  },
  addFriendsCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  addFriendsConfirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  addFriendsConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});