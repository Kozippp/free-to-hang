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
  username?: string;
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
  onOpenAddMoreFriends?: () => void;
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
  onOpenAddMoreFriends,
  prefilledTitle,
  prefilledDescription,
}: PlanSuggestionSheetProps) {
  const { user, clearSelectedFriends } = useHangStore();
  const { createPlan } = usePlansStore();
  const router = useRouter();
  
  const [planTitle, setPlanTitle] = useState(prefilledTitle || '');
  const [description, setDescription] = useState(prefilledDescription || '');

  const slideAnim = useRef(new Animated.Value(0)).current;
  const { height } = Dimensions.get('window');
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Setup pan responder for swipe-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) => {
        // Only respond to pan gestures at the very top of the sheet (handle area)
        return gestureState.y0 < 60; // Only activate near the handle
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes in the handle area
        return gestureState.dy > 10 && 
               Math.abs(gestureState.dx) < Math.abs(gestureState.dy) &&
               gestureState.y0 < 60; // Only activate near the handle
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

  if (!visible) return null;

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
                showsVerticalScrollIndicator={Platform.OS === 'web'}
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
                        <View style={styles.invitedFriendsHeader}>
                          <Text style={styles.invitedFriendsLabel}>
                            Inviting ({selectedFriends.length})
                          </Text>
                          <TouchableOpacity
                            style={styles.addMoreButton}
                            onPress={() => {
                              console.log('🔵 Add More button pressed');
                              if (onOpenAddMoreFriends) {
                                onOpenAddMoreFriends();
                              }
                            }}
                          >
                            <Plus size={16} color={Colors.light.primary} />
                            <Text style={styles.addMoreButtonText}>Add More</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.friendsList}>
                          {selectedFriends.map((friend, index) => (
                            <View key={friend.id} style={[
                              styles.friendItem,
                              index === selectedFriends.length - 1 && styles.friendItemLast
                            ]}>
                              <View style={styles.friendAvatarContainer}>
                                <Image
                                  source={{ uri: friend.avatar }}
                                  style={styles.friendAvatar}
                                />
                                <View style={[
                                  styles.statusIndicator,
                                  friend.status === 'available' ? styles.statusAvailable : styles.statusOffline
                                ]} />
                              </View>
                              <Text style={styles.friendName}>
                                {friend.name}
                              </Text>
                              <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => {
                                  const updatedFriends = selectedFriends.filter(f => f.id !== friend.id);
                                  if (onFriendsUpdated) {
                                    onFriendsUpdated(updatedFriends);
                                  }
                                }}
                              >
                                <X size={16} color={Colors.light.secondaryText} />
                              </TouchableOpacity>
                            </View>
                          ))}
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Reduced opacity to see through
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
  invitedFriendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invitedFriendsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.light.primary}15`,
    gap: 4,
  },
  addMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  friendsList: {
    flexDirection: 'column',
    gap: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  friendItemLast: {
    borderBottomWidth: 0,
  },
  friendAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  statusAvailable: {
    backgroundColor: '#4CAF50', // Green for available/free to hang
  },
  statusOffline: {
    backgroundColor: Colors.light.secondaryText, // Gray for offline/not available
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  removeButton: {
    padding: 4,
  },
});