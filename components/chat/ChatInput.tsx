import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  Text,
  Dimensions,
  Modal,
  Image
} from 'react-native';
import { 
  Send, 
  Camera,
  Mic, 
  X,
  Image as ImageIcon
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import useChatStore from '@/store/chatStore';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(40).fill(0));
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);
  const [currentAmplitude, setCurrentAmplitude] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageConfirmation, setShowImageConfirmation] = useState(false);
  
  // TextInput ref for auto-focusing on reply
  const textInputRef = useRef<TextInput>(null);
  
  // Get current reply state
  const replyingTo = getReplyingTo(planId);
  
  // Animations
  const recordingAnimation = useRef(new Animated.Value(1)).current;
  const sendButtonAnimation = useRef(new Animated.Value(0)).current;
  const micButtonAnimation = useRef(new Animated.Value(1)).current;
  const amplitudeAnimation = useRef(new Animated.Value(0)).current;
  
  // Timer for recording duration and audio levels
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioLevelTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    // Animate send button and mic button based on message content
    const hasText = message.trim().length > 0;
    
    Animated.parallel([
      Animated.timing(sendButtonAnimation, {
        toValue: hasText ? 1 : 0,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(micButtonAnimation, {
        toValue: hasText ? 0 : 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
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

  const simulateAudioLevels = () => {
    // Simulate more realistic audio level patterns with better variation
    const time = Date.now() / 1000;
    const baseLevel = 0.2 + Math.sin(time * 0.8) * 0.15; // Base oscillation
    const speechPattern = Math.sin(time * 2.5) * 0.2; // Speech-like pattern
    const noise = (Math.random() - 0.5) * 0.3; // Random variation
    const spike = Math.random() < 0.15 ? Math.random() * 0.4 : 0; // Occasional spikes
    
    const newLevel = Math.max(0.05, Math.min(1.0, baseLevel + speechPattern + noise + spike));
    
    // Update current amplitude for live animation
    setCurrentAmplitude(newLevel);
    
    // Animate the amplitude value
    Animated.timing(amplitudeAnimation, {
      toValue: newLevel,
      duration: 50,
      useNativeDriver: false,
    }).start();
    
    setAudioLevels(prev => {
      const newLevels = [...prev];
      // Keep only last 60 bars for performance
      if (newLevels.length >= 60) {
        newLevels.shift();
      }
      newLevels.push(newLevel);
      return newLevels;
    });
    
    // Store complete waveform for final message
    setRecordedWaveform(prev => [...prev, newLevel]);
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission is required to record voice messages');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Configure recording with metering enabled for amplitude capture
      const recordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true, // Enable audio level monitoring
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordedWaveform([]);
      setAudioLevels(Array(40).fill(0));
      setCurrentAmplitude(0);

      // Start recording animation (breathing effect)
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start duration timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start real-time audio level monitoring (faster for smoother animation)
      audioLevelTimer.current = setInterval(simulateAudioLevels, 80);

    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        sendMessage(planId, {
          planId,
          userId: currentUserId,
          userName: currentUserName,
          userAvatar: currentUserAvatar,
          type: 'voice',
          content: 'Voice message',
          voiceUrl: uri,
          voiceDuration: recordingDuration,
          waveformData: recordedWaveform,
        });
      }

      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioLevels(Array(40).fill(0));
      setRecordedWaveform([]);
      
      // Stop animations
      recordingAnimation.stopAnimation();
      recordingAnimation.setValue(1);

      // Clear timers
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      if (audioLevelTimer.current) {
        clearInterval(audioLevelTimer.current);
        audioLevelTimer.current = null;
      }

    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioLevels(Array(40).fill(0));
      setRecordedWaveform([]);
      
      // Stop animations
      recordingAnimation.stopAnimation();
      recordingAnimation.setValue(1);

      // Clear timers
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      if (audioLevelTimer.current) {
        clearInterval(audioLevelTimer.current);
        audioLevelTimer.current = null;
      }
    } catch (err) {
      console.error('Failed to cancel recording', err);
    }
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        <TouchableOpacity onPress={cancelRecording} style={styles.cancelButton}>
          <X size={24} color={Colors.light.secondary} />
        </TouchableOpacity>
        
        <View style={styles.recordingInfo}>
          <Animated.View style={[
            styles.recordingDot,
            { transform: [{ scale: recordingAnimation }] }
          ]} />
          <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)}</Text>
          
          <View style={styles.liveWaveformContainer}>
            <View style={styles.liveWaveformBg}>
              {audioLevels.map((level, i) => (
                <Animated.View
                  key={`live-wave-${i}`}
                  style={[
                    styles.liveWaveformBar,
                    {
                      height: Math.max(4, level * 32),
                      opacity: 0.4 + (level * 0.6),
                      transform: [{
                        scaleY: i === audioLevels.length - 1 
                          ? amplitudeAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1.2],
                              extrapolate: 'clamp',
                            })
                          : 1
                      }]
                    }
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
        
        <TouchableOpacity onPress={stopRecording} style={styles.sendVoiceButton}>
          <Send size={20} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderReplyPreview()}
      
      {/* Image Confirmation Modal */}
      {showImageConfirmation && selectedImage && (
        <Modal
          visible={showImageConfirmation}
          transparent={false}
          animationType="slide"
          onRequestClose={handleCancelImage}
        >
          <View style={styles.imageConfirmationFullscreen}>
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullscreenConfirmationImage}
              resizeMode="contain"
            />
            <View style={styles.fullscreenImageActions}>
              <TouchableOpacity 
                style={styles.fullscreenCancelButton} 
                onPress={handleCancelImage}
              >
                <Text style={styles.fullscreenCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.fullscreenSendButton} 
                onPress={handleSendImage}
              >
                <Send size={20} color="white" />
                <Text style={styles.fullscreenSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleGallery}>
          <ImageIcon size={22} color={Colors.light.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleCamera}>
          <Camera size={22} color={Colors.light.primary} />
        </TouchableOpacity>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Message..."
            placeholderTextColor={Colors.light.secondaryText}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
            blurOnSubmit={false}
            ref={textInputRef}
          />
          
          {message.trim() && (
            <Animated.View style={[
              styles.micInInput,
              {
                transform: [{ scale: micButtonAnimation }],
                opacity: micButtonAnimation,
              }
            ]}>
              <TouchableOpacity onPress={startRecording}>
                <Mic size={18} color={Colors.light.secondaryText} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
        
        {message.trim() ? (
          <Animated.View style={[
            styles.sendButton,
            {
              transform: [{ scale: sendButtonAnimation }],
              opacity: sendButtonAnimation,
            }
          ]}>
            <TouchableOpacity onPress={handleSendMessage} style={styles.sendButtonInner}>
              <Send size={18} color="white" />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View style={[
            styles.voiceButton,
            {
              transform: [{ scale: micButtonAnimation }],
              opacity: micButtonAnimation,
            }
          ]}>
            <TouchableOpacity onPress={startRecording}>
              <Mic size={22} color={Colors.light.primary} />
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 36,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 20,
    paddingVertical: 0,
  },
  micInInput: {
    marginLeft: 8,
    padding: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    gap: 12,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.secondary,
  },
  recordingDuration: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
    minWidth: 35,
  },
  liveWaveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 30,
    gap: 2,
  },
  liveWaveformBg: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
  },
  liveWaveformBar: {
    width: 3,
    backgroundColor: Colors.light.primary,
    borderRadius: 1.5,
    minHeight: 3,
  },
  sendVoiceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.cardBackground,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  replyPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  replyPreviewIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.secondary,
    marginRight: 8,
  },
  replyPreviewText: {
    flex: 1,
  },
  replyPreviewTitle: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  replyPreviewMessage: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  replyPreviewClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageConfirmationFullscreen: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenConfirmationImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenImageActions: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullscreenCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  fullscreenCancelText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  fullscreenSendButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    gap: 8,
  },
  fullscreenSendText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
}); 