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
  Dimensions
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
  const { sendMessage } = useChatStore();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(40).fill(0));
  
  // Animations
  const recordingAnimation = useRef(new Animated.Value(1)).current;
  const sendButtonAnimation = useRef(new Animated.Value(0)).current;
  const micButtonAnimation = useRef(new Animated.Value(1)).current;
  
  // Timer for recording duration and audio levels
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioLevelTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      allowsEditing: true,
      aspect: [4, 3],
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
      allowsEditing: true,
      aspect: [4, 3],
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

  const simulateAudioLevels = () => {
    // Simulate real-time audio level detection
    setAudioLevels(prev => {
      const newLevels = [...prev];
      // Shift array left and add new level
      newLevels.shift();
      newLevels.push(Math.random() * 0.8 + 0.2); // Random level between 0.2 and 1
      return newLevels;
    });
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
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start recording animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start duration timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start audio level simulation (in real app, get from recording)
      audioLevelTimer.current = setInterval(simulateAudioLevels, 100);

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
        });
      }

      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioLevels(Array(40).fill(0));
      
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
            {audioLevels.map((level, i) => (
              <View
                key={i}
                style={[
                  styles.liveWaveformBar,
                  {
                    height: Math.max(3, level * 30),
                    opacity: 0.3 + (level * 0.7)
                  }
                ]}
              />
            ))}
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
}); 