import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Image,
  Dimensions,
  Animated,
  Platform,
  Keyboard,
  LayoutChangeEvent,
  ActivityIndicator
} from 'react-native';
import { 
  Send, 
  Camera, 
  X, 
  Reply,
  Image as ImageIcon
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import useChatStore from '@/store/chatStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';

interface ChatInputProps {
  planId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  onHeightChange?: (height: number) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatInput({
  planId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onHeightChange,
}: ChatInputProps) {
  const { sendMessage, getReplyingTo, setReplyingTo, uploadImage } = useChatStore();
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageConfirmation, setShowImageConfirmation] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // TextInput ref for auto-focusing on reply
  const textInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const lastMeasuredHeight = useRef(0);
  
  // Get current reply state
  const replyingTo = getReplyingTo(planId);
  
  // Animations
  const sendButtonAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-focus when replying
  useEffect(() => {
    if (replyingTo && textInputRef.current) {
      // Small delay to ensure the reply preview is rendered
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [replyingTo]);

  useEffect(() => {
    // Animate send button based on message content
    const hasText = message.trim().length > 0;
    
    Animated.timing(sendButtonAnimation, {
      toValue: hasText ? 1 : 0,
      duration: 200,
      useNativeDriver: true
    }).start();
  }, [message]);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(planId, {
        planId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        type: 'text',
        content: message.trim(),
      });
      setMessage('');
    }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      // For camera, send immediately (or show confirmation if preferred)
      // Showing confirmation to be consistent with gallery
      setSelectedImage(result.assets[0].uri);
      setShowImageConfirmation(true);
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery permission is required to select photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setShowImageConfirmation(true);
    }
  };

  const handleSendImage = async () => {
    if (selectedImage) {
      setIsUploading(true);
      
      const publicUrl = await uploadImage(selectedImage, planId);
      
      if (publicUrl) {
        sendMessage(planId, {
          planId,
          userId: currentUserId,
          userName: currentUserName,
          userAvatar: currentUserAvatar,
          type: 'image',
          content: '',
          imageUrl: publicUrl,
        });
        
        setSelectedImage(null);
        setShowImageConfirmation(false);
      } else {
        Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
      }
      
      setIsUploading(false);
    }
  };

  const handleCancelImage = () => {
    setSelectedImage(null);
    setShowImageConfirmation(false);
  };

  const renderReplyPreview = () => {
    if (!replyingTo) return null;

    const isReplyToSelf = replyingTo.userId === currentUserId;
    
    return (
      <View style={styles.replyPreviewContainer}>
        <View style={styles.replyPreviewContent}>
          <View style={styles.replyPreviewText}>
            <Text style={styles.replyPreviewTitle}>
              Replying to {isReplyToSelf ? 'yourself' : replyingTo.userName}
            </Text>
            <Text 
              style={styles.replyPreviewMessage} 
              numberOfLines={1}
            >
              {replyingTo.type === 'image' ? '📷 Photo' : 
               replyingTo.type === 'voice' ? '🎵 Voice message' :
               replyingTo.type === 'poll' ? '📊 Poll' : replyingTo.content}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.replyPreviewClose} 
          onPress={() => setReplyingTo(planId, null)}
        >
          <X size={16} color={Colors.light.secondaryText} />
        </TouchableOpacity>
      </View>
    );
  };

  const safeBottomInset = isKeyboardVisible ? 0 : insets.bottom;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (Math.abs(height - lastMeasuredHeight.current) > 2) {
      lastMeasuredHeight.current = height;
      onHeightChange?.(height);
    }
  };

  return (
    <View 
      style={[styles.container, { paddingBottom: safeBottomInset }]}
      onLayout={handleLayout}
    >
      {/* Reply Preview */}
      {renderReplyPreview()}
      
      {/* Main Input Container */}
      <View style={styles.inputContainer}>
        {/* Camera Button */}
        <TouchableOpacity 
          style={styles.cameraButton}
          onPress={handleCamera}
        >
          <Camera size={24} color={Colors.light.primary} />
        </TouchableOpacity>

        {/* Text Input */}
        <View style={styles.textInputContainer}>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={Colors.light.secondaryText}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
            blurOnSubmit={false}
            returnKeyType="default"
            onSubmitEditing={Platform.OS === 'ios' ? handleSendMessage : undefined}
          />
        </View>

        {/* Send/Gallery Button */}
        <View style={styles.actionButtonsContainer}>
          {message.trim().length > 0 ? (
            <Animated.View 
              style={[
                styles.sendButtonContainer,
                { opacity: sendButtonAnimation }
              ]}
            >
              <TouchableOpacity 
                style={styles.sendButton}
                onPress={handleSendMessage}
              >
                <Send size={20} color="white" />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity 
              style={styles.galleryButton}
              onPress={handleGallery}
            >
              <ImageIcon size={24} color={Colors.light.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image Confirmation Modal */}
      <Modal
        visible={showImageConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelImage}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
          
          <View style={styles.imagePreviewContainer}>
            {selectedImage && (
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.imagePreview}
                resizeMode="contain"
              />
            )}
            
            <View style={styles.imageActionsContainer}>
              <TouchableOpacity 
                style={styles.cancelImageButton}
                onPress={handleCancelImage}
              >
                <Text style={styles.cancelImageText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sendImageButton, isUploading && styles.disabledButton]}
                onPress={handleSendImage}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.sendImageText}>Send Photo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  replyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  replyPreviewText: {
    flex: 1,
  },
  replyPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  replyPreviewMessage: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  replyPreviewClose: {
    padding: 4,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textInputContainer: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    color: Colors.light.text,
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  actionButtonsContainer: {
    marginLeft: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonContainer: {
    width: 40,
    height: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  imagePreview: {
    width: '100%',
    height: 300,
    backgroundColor: '#F0F0F0',
  },
  imageActionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelImageButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
  },
  cancelImageText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sendImageButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
  },
  sendImageText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.7,
  },
}); 