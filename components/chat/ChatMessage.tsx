<<<<<<< HEAD
import React, { useState, useRef, useEffect } from 'react';
=======
import React, { useState, useRef } from 'react';
>>>>>>> d2395da (28.05 23:42)
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
<<<<<<< HEAD
  Platform
=======
  PanResponder,
  Modal,
  TextInput,
  Vibration
>>>>>>> d2395da (28.05 23:42)
} from 'react-native';
import { BlurView } from 'expo-blur';
import { 
<<<<<<< HEAD
  Heart, 
  ThumbsUp, 
  Laugh, 
  Angry, 
  Play,
  Pause,
  MoreHorizontal,
  Waveform
=======
  Reply,
  Edit3,
  Trash2,
  Copy
>>>>>>> d2395da (28.05 23:42)
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ChatMessage as ChatMessageType } from '@/store/chatStore';
import useChatStore from '@/store/chatStore';
import { Audio } from 'expo-av';

interface ChatMessageProps {
  message: ChatMessageType;
  planId: string;
  currentUserId: string;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MESSAGE_MAX_WIDTH = SCREEN_WIDTH * 0.7;

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

export default function ChatMessage({ 
  message, 
  planId, 
  currentUserId, 
  isOwnMessage,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true
}: ChatMessageProps) {
  const { addReaction, removeReaction, deleteMessage, editMessage } = useChatStore();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [isUnsending, setIsUnsending] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
<<<<<<< HEAD
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const playbackAnimation = useRef(new Animated.Value(0)).current;
  const waveformAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isPlayingVoice) {
      Animated.parallel([
        Animated.timing(playbackAnimation, {
          toValue: 1,
          duration: (message.voiceDuration || 0) * 1000,
          useNativeDriver: false
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(waveformAnimation, {
              toValue: 1,
              duration: 500,
              useNativeDriver: false
            }),
            Animated.timing(waveformAnimation, {
              toValue: 0,
              duration: 500,
              useNativeDriver: false
            })
          ])
        )
      ]).start();
    } else {
      playbackAnimation.setValue(0);
      waveformAnimation.stopAnimation();
      waveformAnimation.setValue(0);
    }
  }, [isPlayingVoice]);
=======
  const [messageLayout, setMessageLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  // Swipe animation for timestamp
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const timestampOpacity = useRef(new Animated.Value(0)).current;
  const unsendAnim = useRef(new Animated.Value(1)).current;
  
  // Message scale animation for long press
  const messageScale = useRef(new Animated.Value(1)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 15;
      },
      onPanResponderMove: (evt, gestureState) => {
        const maxSwipe = 60;
        if (isOwnMessage && gestureState.dx < 0) {
          const swipeValue = Math.max(gestureState.dx, -maxSwipe);
          swipeAnim.setValue(swipeValue);
          timestampOpacity.setValue(Math.min(Math.abs(swipeValue) / maxSwipe, 1));
        } else if (!isOwnMessage && gestureState.dx > 0) {
          const swipeValue = Math.min(gestureState.dx, maxSwipe);
          swipeAnim.setValue(swipeValue);
          timestampOpacity.setValue(Math.min(swipeValue / maxSwipe, 1));
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Always return to original position
        Animated.parallel([
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 150,
            friction: 8
          }),
          Animated.timing(timestampOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true
          })
        ]).start();
      },
    })
  ).current;
>>>>>>> d2395da (28.05 23:42)

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleLongPress = () => {
    Vibration.vibrate(50);
    
    // Scale up the message and show modal
    Animated.parallel([
      Animated.spring(messageScale, {
        toValue: 1.05,
        useNativeDriver: true,
        tension: 150,
        friction: 8
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
    
    setShowActions(true);
  };

  const onMessageLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setMessageLayout({ x, y, width, height });
  };

  const closeModal = () => {
    // Scale back to normal and hide modal
    Animated.parallel([
      Animated.spring(messageScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 8
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      })
    ]).start(() => {
      setShowActions(false);
    });
  };

  const handleReaction = (emoji: string) => {
    const currentReaction = message.reactions[currentUserId];
    
    if (currentReaction === emoji) {
      removeReaction(planId, message.id, currentUserId);
    } else {
      addReaction(planId, message.id, currentUserId, emoji);
    }
    closeModal();
  };

  const handleUnsend = () => {
    closeModal();
    setIsUnsending(true);
    
    Animated.sequence([
      Animated.timing(unsendAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(unsendAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      deleteMessage(planId, message.id);
    });
  };

<<<<<<< HEAD
  const playVoiceMessage = () => {
    setIsPlayingVoice(!isPlayingVoice);
    if (!isPlayingVoice) {
      // Simulate voice playback
      setTimeout(() => {
        setIsPlayingVoice(false);
        playbackAnimation.setValue(0);
      }, (message.voiceDuration || 0) * 1000);
=======
  const handleEdit = () => {
    closeModal();
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText.trim() !== message.content) {
      editMessage(planId, message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  const handleReply = () => {
    closeModal();
    Alert.alert('Reply', 'Reply functionality would be implemented here');
  };

  const handleCopy = () => {
    closeModal();
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  const playVoiceMessage = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlayingVoice(false);
        return;
      }

      if (message.voiceUrl) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: message.voiceUrl },
          { shouldPlay: true }
        );
        
        setSound(newSound);
        setIsPlayingVoice(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingVoice(false);
            setSound(null);
          }
        });
      }
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert('Error', 'Could not play voice message');
>>>>>>> d2395da (28.05 23:42)
    }
  };

  const renderMessageContent = () => {
    if (isEditing && message.type === 'text') {
      return (
        <View style={styles.editContainer}>
          <TextInput
            style={[
              styles.editInput,
              isOwnMessage ? styles.ownEditInput : styles.otherEditInput
            ]}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            onSubmitEditing={handleSaveEdit}
            blurOnSubmit={false}
          />
          <View style={styles.editActions}>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.editButton}>
              <Text style={styles.editButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveEdit} style={[styles.editButton, styles.saveButton]}>
              <Text style={[styles.editButtonText, styles.saveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    switch (message.type) {
      case 'text':
        return (
          <View>
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {message.content}
            </Text>
            {message.edited && (
              <Text style={[
                styles.editedIndicator,
                isOwnMessage ? styles.ownEditedIndicator : styles.otherEditedIndicator
              ]}>
                Edited
              </Text>
            )}
          </View>
        );

      case 'image':
        return (
<<<<<<< HEAD
          <View style={styles.imageContainer}>
            {message.content && (
              <Text style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                styles.imageCaption
              ]}>
                {message.content}
              </Text>
            )}
            <Image 
              source={{ uri: message.imageUrl }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
          </View>
=======
          <TouchableOpacity activeOpacity={0.9}>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: message.imageUrl || 'https://via.placeholder.com/200' }} 
                style={styles.messageImage}
                resizeMode="cover"
              />
              {message.content && (
                <Text style={[
                  styles.messageText,
                  styles.imageCaption,
                  isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>
                  {message.content}
                </Text>
              )}
            </View>
          </TouchableOpacity>
>>>>>>> d2395da (28.05 23:42)
        );

      case 'voice':
        const duration = message.voiceDuration || 0;
        const progress = playbackAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%']
        });
        
        return (
          <TouchableOpacity 
            style={[
              styles.voiceContainer,
              isOwnMessage ? styles.ownVoiceContainer : styles.otherVoiceContainer
            ]}
            onPress={playVoiceMessage}
            activeOpacity={0.8}
          >
<<<<<<< HEAD
            <View style={styles.voiceControls}>
              {isPlayingVoice ? (
                <Pause size={20} color={isOwnMessage ? 'white' : Colors.light.primary} />
              ) : (
                <Play size={20} color={isOwnMessage ? 'white' : Colors.light.primary} />
              )}
              
              <View style={styles.voiceWaveform}>
                <Animated.View style={[
                  styles.voiceProgress,
                  { width: progress },
                  isOwnMessage ? styles.ownVoiceProgress : styles.otherVoiceProgress
                ]} />
                
                {Array.from({ length: 27 }).map((_, i) => {
                  const barHeight = Math.sin((i / 27) * Math.PI) * 15 + 5;
                  return (
                    <Animated.View 
                      key={i}
                      style={[
                        styles.waveformBar,
                        {
                          height: barHeight,
                          opacity: waveformAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.4, 1]
                          })
                        },
                        isOwnMessage ? styles.ownWaveformBar : styles.otherWaveformBar
                      ]}
                    />
                  );
                })}
              </View>
            </View>
            
=======
            <View style={[
              styles.voicePlayButton,
              isOwnMessage ? styles.ownVoiceButton : styles.otherVoiceButton
            ]}>
              <Text style={styles.voicePlayIcon}>
                {isPlayingVoice ? '⏸' : '▶️'}
              </Text>
            </View>
            
            <View style={styles.voiceWaveform}>
              {Array.from({ length: 15 }).map((_, i) => {
                const height = Math.sin(i * 0.8) * 8 + 12;
                return (
                  <View 
                    key={i}
                    style={[
                      styles.waveformBar,
                      { 
                        height,
                        backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.7)' : Colors.light.primary,
                        opacity: isPlayingVoice ? 0.8 + Math.sin(Date.now() / 100 + i) * 0.2 : 0.6
                      }
                    ]} 
                  />
                )}
              )}
            </View>
            
>>>>>>> d2395da (28.05 23:42)
            <Text style={[
              styles.voiceDuration,
              isOwnMessage ? styles.ownVoiceDuration : styles.otherVoiceDuration
            ]}>
              {duration}s
            </Text>
          </TouchableOpacity>
        );

<<<<<<< HEAD
      case 'poll':
        return (
          <View style={styles.pollContainer}>
            <Text style={[
              styles.pollQuestion,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {message.pollData?.question}
            </Text>
            
            {message.pollData?.options.map((option) => {
              const totalVotes = message.pollData?.options.reduce((sum, opt) => sum + opt.votes.length, 0) || 0;
              const percentage = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
              const hasVoted = option.votes.includes(currentUserId);
              
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.pollOption,
                    hasVoted && styles.votedPollOption,
                    isOwnMessage ? styles.ownPollOption : styles.otherPollOption
                  ]}
                  onPress={() => handlePollVote(option.id)}
                >
                  <View style={styles.pollOptionContent}>
                    <Text style={[
                      styles.pollOptionText,
                      isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                      hasVoted && styles.votedOptionText
                    ]}>
                      {option.text}
                    </Text>
                    
                    <View style={styles.pollPercentageContainer}>
                      <Text style={[
                        styles.pollPercentage,
                        isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                      ]}>
                        {percentage}%
                      </Text>
                      
                      {hasVoted && (
                        <View style={[
                          styles.votedIndicator,
                          isOwnMessage ? styles.ownVotedIndicator : styles.otherVotedIndicator
                        ]}>
                          <Check size={12} color="white" />
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <View style={[
                    styles.pollProgress,
                    isOwnMessage ? styles.ownPollProgress : styles.otherPollProgress,
                    { width: `${percentage}%` }
                  ]} />
                </TouchableOpacity>
              );
            })}
          </View>
        );

=======
>>>>>>> d2395da (28.05 23:42)
      default:
        return null;
    }
  };

  const renderReactions = () => {
    const reactionCounts: { [emoji: string]: number } = {};
    Object.values(message.reactions).forEach(emoji => {
      reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    });

    if (Object.keys(reactionCounts).length === 0) return null;

    return (
      <View style={[
        styles.reactionsContainer,
        isOwnMessage ? styles.ownReactions : styles.otherReactions
      ]}>
        {Object.entries(reactionCounts).map(([emoji, count]) => (
<<<<<<< HEAD
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionBubble,
              message.reactions[currentUserId] === emoji && styles.selectedReaction
=======
          <TouchableOpacity 
            key={emoji} 
            style={[
              styles.reactionBubble,
              message.reactions[currentUserId] === emoji && styles.myReactionBubble
>>>>>>> d2395da (28.05 23:42)
            ]}
            onPress={() => handleReaction(emoji)}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getBubbleStyle = () => {
    const baseStyle = isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble;
    const radiusStyle: any = {};
    
    if (isOwnMessage) {
      radiusStyle.borderTopRightRadius = isFirstInGroup ? 20 : 6;
      radiusStyle.borderBottomRightRadius = isLastInGroup ? 20 : 6;
      radiusStyle.borderTopLeftRadius = 20;
      radiusStyle.borderBottomLeftRadius = 20;
    } else {
      radiusStyle.borderTopLeftRadius = isFirstInGroup ? 20 : 6;
      radiusStyle.borderBottomLeftRadius = isLastInGroup ? 20 : 6;
      radiusStyle.borderTopRightRadius = 20;
      radiusStyle.borderBottomRightRadius = 20;
    }
    
    return [baseStyle, radiusStyle];
  };

  if (isUnsending) {
    return (
      <Animated.View 
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
          { 
            transform: [{ scale: unsendAnim }],
            opacity: unsendAnim
          }
        ]}
      >
        <View style={styles.unsendingContainer}>
          <Text style={styles.unsendingText}>Message deleted</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        { transform: [{ translateX: swipeAnim }] }
      ]}
      {...panResponder.panHandlers}
    >
      {/* Timestamp revealed on swipe */}
      <Animated.View 
        style={[
          styles.swipeTimestamp,
          isOwnMessage ? styles.swipeTimestampLeft : styles.swipeTimestampRight,
          { opacity: timestampOpacity }
        ]}
      >
        <Text style={styles.swipeTimestampText}>{formatTime(message.timestamp)}</Text>
      </Animated.View>
      
      {!isOwnMessage && showAvatar && (
        <Image 
          source={{ uri: message.userAvatar }} 
          style={styles.avatar}
        />
      )}
      
      {!isOwnMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}
      
      <View style={[
        styles.messageWrapper,
        isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper
      ]}>
        {!isOwnMessage && isFirstInGroup && (
          <Text style={styles.userName}>{message.userName}</Text>
        )}
        
        <TouchableOpacity
<<<<<<< HEAD
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
            message.type === 'voice' && styles.voiceMessageBubble
          ]}
          onLongPress={() => setShowReactions(true)}
          activeOpacity={0.8}
=======
          style={getBubbleStyle()}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
          onLayout={onMessageLayout}
>>>>>>> d2395da (28.05 23:42)
        >
          {renderMessageContent()}
        </TouchableOpacity>
        
        {renderReactions()}
      </View>

<<<<<<< HEAD
      {showReactions && (
        <View style={[
          styles.reactionPicker,
          isOwnMessage ? styles.ownReactionPicker : styles.otherReactionPicker
        ]}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.reactionButton,
                message.reactions[currentUserId] === emoji && styles.selectedReactionButton
              ]}
              onPress={() => handleReaction(emoji)}
            >
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.closeReactionButton}
            onPress={() => setShowReactions(false)}
=======
      {/* Message Actions Modal - Two Floating Menus */}
      <Modal
        visible={showActions}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
          
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
          />
          
          {/* Highlighted Message - Different positioning for own vs other messages */}
          <Animated.View 
            style={[
              styles.highlightedMessageWrapper,
              {
                // Different horizontal positioning for own vs other messages
                left: isOwnMessage 
                  ? SCREEN_WIDTH - messageLayout.width - 16
                  : Math.max(16, Math.min(SCREEN_WIDTH - messageLayout.width - 16, messageLayout.x)),
                top: Dimensions.get('window').height * 0.3 - (messageLayout.height / 2),
                width: messageLayout.width,
                height: messageLayout.height,
                transform: [{ scale: messageScale }],
                opacity: modalOpacity,
              }
            ]}
>>>>>>> d2395da (28.05 23:42)
          >
            <View style={getBubbleStyle()}>
              {renderMessageContent()}
            </View>
          </Animated.View>
          
          {/* Top Emoji Menu - Position according to message type */}
          <Animated.View 
            style={[
              styles.emojiMenu,
              {
                // Position emoji menu based on message alignment
                left: isOwnMessage
                  ? SCREEN_WIDTH - 280 - 16
                  : Math.max(16, Math.min(SCREEN_WIDTH - 280 - 16, messageLayout.x + (messageLayout.width / 2) - 140)),
                top: Dimensions.get('window').height * 0.3 - (messageLayout.height / 2) - 60,
                opacity: modalOpacity,
                transform: [
                  {
                    translateY: modalOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={[styles.emojiRow, isOwnMessage && styles.ownEmojiRow]}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiButton,
                    message.reactions[currentUserId] === emoji && styles.selectedEmojiButton
                  ]}
                  onPress={() => handleReaction(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
          
          {/* Bottom Action Menu - Position according to message type */}
          <Animated.View 
            style={[
              styles.actionMenu,
              {
                // Position action menu based on message alignment
                left: isOwnMessage
                  ? SCREEN_WIDTH - 180 - 16
                  : Math.max(16, Math.min(SCREEN_WIDTH - 180 - 16, messageLayout.x + (messageLayout.width / 2) - 90)),
                top: Dimensions.get('window').height * 0.3 + (messageLayout.height / 2) + 20,
                opacity: modalOpacity,
                transform: [
                  {
                    translateY: modalOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0]
                    })
                  }
                ]
              }
            ]}
          >
            {/* Different menu order for own vs other messages */}
            {isOwnMessage ? (
              // Own message: Unsend first (right to left order)
              <>
                <TouchableOpacity style={styles.actionMenuItem} onPress={handleUnsend}>
                  <Trash2 size={24} color={Colors.light.secondary} />
                  <Text style={[styles.actionMenuText, styles.unsendMenuText]}>Unsend</Text>
                </TouchableOpacity>
                
                <View style={styles.actionMenuSeparator} />
                
                <TouchableOpacity style={styles.actionMenuItem} onPress={handleCopy}>
                  <Copy size={24} color={Colors.light.text} />
                  <Text style={styles.actionMenuText}>Copy</Text>
                </TouchableOpacity>
                
                <View style={styles.actionMenuSeparator} />
                
                <TouchableOpacity style={styles.actionMenuItem} onPress={handleReply}>
                  <Reply size={24} color={Colors.light.text} />
                  <Text style={styles.actionMenuText}>Reply</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Other message: Reply first (left to right order)
              <>
                <TouchableOpacity style={styles.actionMenuItem} onPress={handleReply}>
                  <Reply size={24} color={Colors.light.text} />
                  <Text style={styles.actionMenuText}>Reply</Text>
                </TouchableOpacity>
                
                <View style={styles.actionMenuSeparator} />
                
                <TouchableOpacity style={styles.actionMenuItem} onPress={handleCopy}>
                  <Copy size={24} color={Colors.light.text} />
                  <Text style={styles.actionMenuText}>Copy</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 1,
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 2,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  messageWrapper: {
    maxWidth: MESSAGE_MAX_WIDTH,
  },
  ownMessageWrapper: {
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 11,
    color: Colors.light.secondaryText,
    marginBottom: 2,
    marginLeft: 12,
    fontWeight: '500',
  },
  ownMessageBubble: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  otherMessageBubble: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  voiceMessageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#000000',
  },
  editedIndicator: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  ownEditedIndicator: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherEditedIndicator: {
    color: 'rgba(0,0,0,0.5)',
  },
  imageContainer: {
    maxWidth: 200,
  },
  imageCaption: {
    marginTop: 8,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  voiceContainer: {
    minWidth: 160,
    maxWidth: 240,
    borderRadius: 20,
    padding: 12,
  },
  ownVoiceContainer: {
    backgroundColor: Colors.light.primary,
  },
  otherVoiceContainer: {
    backgroundColor: Colors.light.cardBackground,
  },
  voiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
<<<<<<< HEAD
    gap: 12,
=======
    minWidth: 160,
    paddingVertical: 2,
  },
  voicePlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  ownVoiceButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  otherVoiceButton: {
    backgroundColor: Colors.light.primary,
  },
  voicePlayIcon: {
    fontSize: 12,
>>>>>>> d2395da (28.05 23:42)
  },
  voiceWaveform: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
<<<<<<< HEAD
    position: 'relative',
    marginLeft: 8,
  },
  voiceProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 4,
    opacity: 0.3,
  },
  ownVoiceProgress: {
    backgroundColor: 'white',
  },
  otherVoiceProgress: {
    backgroundColor: Colors.light.primary,
=======
    marginHorizontal: 6,
    flex: 1,
>>>>>>> d2395da (28.05 23:42)
  },
  waveformBar: {
    width: 2,
    marginHorizontal: 1,
    borderRadius: 1,
<<<<<<< HEAD
  },
  ownWaveformBar: {
    backgroundColor: 'white',
  },
  otherWaveformBar: {
    backgroundColor: Colors.light.primary,
  },
  voiceDuration: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  ownVoiceDuration: {
    color: 'white',
  },
  otherVoiceDuration: {
    color: Colors.light.text,
  },
  pollContainer: {
    minWidth: 200,
    maxWidth: 300,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pollOption: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  ownPollOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  otherPollOption: {
    backgroundColor: Colors.light.buttonBackground,
  },
  votedPollOption: {
    borderWidth: 1,
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    zIndex: 1,
  },
  pollOptionText: {
    fontSize: 14,
    flex: 1,
  },
  votedOptionText: {
    fontWeight: '600',
  },
  pollPercentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollPercentage: {
    fontSize: 12,
=======
  },
  voiceDuration: {
    fontSize: 11,
>>>>>>> d2395da (28.05 23:42)
    opacity: 0.8,
    marginLeft: 6,
  },
  votedIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownVotedIndicator: {
    backgroundColor: 'white',
  },
  otherVotedIndicator: {
    backgroundColor: Colors.light.primary,
  },
  pollProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    opacity: 0.15,
  },
  ownPollProgress: {
    backgroundColor: 'white',
  },
  otherPollProgress: {
    backgroundColor: Colors.light.primary,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  ownReactions: {
    justifyContent: 'flex-end',
  },
  otherReactions: {
    justifyContent: 'flex-start',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
<<<<<<< HEAD
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  selectedReaction: {
    backgroundColor: `${Colors.light.primary}20`,
=======
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  myReactionBubble: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
>>>>>>> d2395da (28.05 23:42)
  },
  reactionEmoji: {
    fontSize: 20,
  },
  reactionCount: {
    fontSize: 10,
    color: Colors.light.secondaryText,
<<<<<<< HEAD
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
=======
    marginLeft: 2,
    fontWeight: '500',
  },
  swipeTimestamp: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
>>>>>>> d2395da (28.05 23:42)
  },
  swipeTimestampLeft: {
    left: -80,
    alignItems: 'flex-end',
  },
  swipeTimestampRight: {
    right: -80,
    alignItems: 'flex-start',
  },
  swipeTimestampText: {
    fontSize: 11,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
<<<<<<< HEAD
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
=======
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
>>>>>>> d2395da (28.05 23:42)
  },
  highlightedMessageWrapper: {
    position: 'absolute',
<<<<<<< HEAD
    backgroundColor: 'white',
    borderRadius: 24,
=======
    zIndex: 1,
  },
  emojiMenu: {
    position: 'absolute',
    zIndex: 2,
>>>>>>> d2395da (28.05 23:42)
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
<<<<<<< HEAD
  ownReactionPicker: {
    right: 0,
    bottom: '100%',
    marginBottom: 8,
  },
  otherReactionPicker: {
    left: 40,
    bottom: '100%',
    marginBottom: 8,
  },
  reactionButton: {
    padding: 8,
    borderRadius: 20,
  },
  selectedReactionButton: {
    backgroundColor: `${Colors.light.primary}20`,
  },
  reactionPickerEmoji: {
    fontSize: 20,
=======
  emojiButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
    backgroundColor: 'transparent',
  },
  selectedEmojiButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    transform: [{ scale: 1.1 }],
  },
  emojiText: {
    fontSize: 20,
  },
  actionMenu: {
    position: 'absolute',
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    minWidth: 180,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionMenuText: {
    fontSize: 16,
    marginLeft: 12,
    color: Colors.light.text,
  },
  actionMenuSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  unsendMenuText: {
    color: Colors.light.secondary,
  },
  editContainer: {
    minWidth: 200,
  },
  editInput: {
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 4,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  ownEditInput: {
    color: 'white',
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  otherEditInput: {
    color: '#000000',
    borderBottomColor: '#E0E0E0',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.secondaryText,
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
  },
  saveButtonText: {
    color: 'white',
  },
  unsendingContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  unsendingText: {
    fontSize: 11,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
  },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownEmojiRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
>>>>>>> d2395da (28.05 23:42)
  },
  closeReactionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.buttonBackground,
  },
});