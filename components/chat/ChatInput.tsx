import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Animated
} from 'react-native';
import { 
  Send, 
  Image as ImageIcon, 
  Mic, 
  BarChart3,
  Plus,
  X
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import useChatStore from '@/store/chatStore';

interface ChatInputProps {
  planId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
}

export default function ChatInput({
  planId,
  currentUserId,
  currentUserName,
  currentUserAvatar
}: ChatInputProps) {
  const { sendMessage } = useChatStore();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [recordingAnimation] = useState(new Animated.Value(1));

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

  const handleImagePicker = () => {
    setShowOptions(false);
    Alert.alert(
      'Send Image',
      'Image picker functionality would be implemented here',
      [
        {
          text: 'Camera',
          onPress: () => {
            // Camera functionality
            sendMessage(planId, {
              planId,
              userId: currentUserId,
              userName: currentUserName,
              userAvatar: currentUserAvatar,
              type: 'image',
              content: 'Check this out! 📸',
              imageUrl: 'https://picsum.photos/200/200?random=' + Date.now(),
            });
          }
        },
        {
          text: 'Gallery',
          onPress: () => {
            // Gallery functionality
            sendMessage(planId, {
              planId,
              userId: currentUserId,
              userName: currentUserName,
              userAvatar: currentUserAvatar,
              type: 'image',
              content: 'From my gallery 🖼️',
              imageUrl: 'https://picsum.photos/200/200?random=' + Date.now(),
            });
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleVoiceRecording = () => {
    setShowOptions(false);
    
    if (!isRecording) {
      setIsRecording(true);
      // Start recording animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Simulate recording
      setTimeout(() => {
        setIsRecording(false);
        recordingAnimation.stopAnimation();
        recordingAnimation.setValue(1);
        
        sendMessage(planId, {
          planId,
          userId: currentUserId,
          userName: currentUserName,
          userAvatar: currentUserAvatar,
          type: 'voice',
          content: 'Voice message',
          voiceUrl: 'voice://recording-' + Date.now(),
          voiceDuration: Math.floor(Math.random() * 30) + 5,
        });
      }, 3000);
    }
  };

  const handleCreatePoll = () => {
    setShowOptions(false);
    Alert.alert(
      'Create Poll',
      'Quick poll in chat',
      [
        {
          text: 'Yes/No Poll',
          onPress: () => {
            Alert.prompt(
              'Poll Question',
              'What do you want to ask?',
              (question) => {
                if (question?.trim()) {
                  sendMessage(planId, {
                    planId,
                    userId: currentUserId,
                    userName: currentUserName,
                    userAvatar: currentUserAvatar,
                    type: 'poll',
                    content: question.trim(),
                    pollData: {
                      question: question.trim(),
                      options: [
                        { id: 'yes', text: 'Yes 👍', votes: [] },
                        { id: 'no', text: 'No 👎', votes: [] }
                      ]
                    }
                  });
                }
              }
            );
          }
        },
        {
          text: 'Custom Poll',
          onPress: () => {
            Alert.prompt(
              'Poll Question',
              'What do you want to ask?',
              (question) => {
                if (question?.trim()) {
                  sendMessage(planId, {
                    planId,
                    userId: currentUserId,
                    userName: currentUserName,
                    userAvatar: currentUserAvatar,
                    type: 'poll',
                    content: question.trim(),
                    pollData: {
                      question: question.trim(),
                      options: [
                        { id: 'option1', text: 'Option 1', votes: [] },
                        { id: 'option2', text: 'Option 2', votes: [] },
                        { id: 'option3', text: 'Option 3', votes: [] }
                      ]
                    }
                  });
                }
              }
            );
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {showOptions && (
        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={styles.optionButton}
            onPress={handleImagePicker}
          >
            <ImageIcon size={24} color={Colors.light.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.optionButton}
            onPress={handleCreatePoll}
          >
            <BarChart3 size={24} color={Colors.light.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.optionButton}
            onPress={() => setShowOptions(false)}
          >
            <X size={24} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={[styles.attachButton, showOptions && styles.attachButtonActive]}
          onPress={() => setShowOptions(!showOptions)}
        >
          <Plus 
            size={24} 
            color={showOptions ? Colors.light.primary : Colors.light.secondaryText}
            style={{ transform: [{ rotate: showOptions ? '45deg' : '0deg' }] }}
          />
        </TouchableOpacity>
        
        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor={Colors.light.secondaryText}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSendMessage}
          blurOnSubmit={false}
        />
        
        {message.trim() ? (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
          >
            <Send size={20} color="white" />
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: recordingAnimation }] }}>
            <TouchableOpacity
              style={[
                styles.voiceButton,
                isRecording && styles.voiceButtonRecording
              ]}
              onPress={handleVoiceRecording}
              disabled={isRecording}
            >
              <Mic size={20} color={isRecording ? 'white' : Colors.light.secondaryText} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 12,
  },
  optionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachButtonActive: {
    backgroundColor: `${Colors.light.primary}15`,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  voiceButtonRecording: {
    backgroundColor: Colors.light.secondary,
  },
}); 