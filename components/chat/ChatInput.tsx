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
  Platform
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
import * as ImagePicker from 'expo-image-picker';

interface ChatInputProps {
  planId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatInput({
  planId,
  currentUserId,
  currentUserName,
  currentUserAvatar
}: ChatInputProps) {
  const { sendMessage, getReplyingTo, setReplyingTo } = useChatStore();
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageConfirmation, setShowImageConfirmation] = useState(false);
  
  // TextInput ref for auto-focusing on reply
  const textInputRef = useRef<TextInput>(null);
  
  // Get current reply state
  const replyingTo = getReplyingTo(planId);
  
  // Animations
  const sendButtonAnimation = useRef(new Animated.Value(0)).current;

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      sendMessage(planId, {
        planId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        type: 'image',
        content: '',
        imageUrl: result.assets[0].uri,
      });
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery permission is required to select photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setShowImageConfirmation(true);
    }
  };

  const handleSendImage = () => {
    if (selectedImage) {
      sendMessage(planId, {
        planId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        type: 'image',
        content: '',
        imageUrl: selectedImage,
      });
    }
    setSelectedImage(null);
    setShowImageConfirmation(false);
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
          <View style={styles.replyPreviewIndicator} />
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

  return (
    <View style={styles.container}>
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
                style={styles.sendImageButton}
                onPress={handleSendImage}
              >
                <Text style={styles.sendImageText}>Send Photo</Text>
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
  replyPreviewIndicator: {
    width: 3,
    height: 32,
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  replyPreviewText: {
    flex: 1,
  },
  replyPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: SCREEN_WIDTH - 40,
    maxHeight: '80%',
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 300,
  },
  imageActionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelImageButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 8,
  },
  cancelImageText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  sendImageButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
  },
  sendImageText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 