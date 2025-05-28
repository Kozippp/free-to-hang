import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
  TextInput,
  Vibration
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import { 
  Reply,
  Edit3,
  Trash2,
  Copy,
  X
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
  scrollToMessage?: (messageId: string) => void;
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
  isLastInGroup = true,
  scrollToMessage
}: ChatMessageProps) {
  const { addReaction, removeReaction, deleteMessage, editMessage, setReplyingTo } = useChatStore();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [isUnsending, setIsUnsending] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [messageLayout, setMessageLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showImageViewer, setShowImageViewer] = useState(false);
  
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

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
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
    // Close modal immediately to avoid useInsertionEffect warning
    setShowActions(false);
    
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
    ]).start();
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
    setReplyingTo(planId, message);
  };

  const handleCopy = () => {
    closeModal();
    let textToCopy = '';
    
    switch (message.type) {
      case 'text':
        textToCopy = message.content;
        break;
      case 'image':
        textToCopy = message.content || 'Image';
        break;
      case 'voice':
        textToCopy = 'Voice message';
        break;
      case 'poll':
        textToCopy = message.pollData?.question || 'Poll';
        break;
      default:
        textToCopy = message.content;
    }
    
    Clipboard.setStringAsync(textToCopy);
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
    }
  };

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    const { userName, content, type } = message.replyTo;
    const isReplyToSelf = message.replyTo.userId === currentUserId;
    
    // Get first name only
    const getFirstName = (fullName: string) => fullName.split(' ')[0];
    const senderFirstName = getFirstName(isOwnMessage ? 'You' : message.userName);
    const replyToFirstName = isReplyToSelf ? 'yourself' : getFirstName(userName);
    
    const getContentPreview = () => {
      switch (type) {
        case 'image':
          return '📷 Photo';
        case 'voice':
          return '🎵 Voice message';
        case 'poll':
          return '📊 Poll';
        default:
          return content; // Don't truncate - let it be full length
      }
    };

    const handleReplyBubblePress = () => {
      if (scrollToMessage && message.replyTo?.messageId) {
        scrollToMessage(message.replyTo.messageId);
      }
    };
    
    return (
      <View style={[
        styles.replyPreviewContainer,
        isOwnMessage ? styles.ownReplyContainer : styles.otherReplyContainer
      ]}>
        {/* Reply indicator text - remove line limitation */}
        <Text style={styles.replyIndicatorText}>
          <Reply size={12} color={Colors.light.secondaryText} />
          {' '}{senderFirstName} replied to {replyToFirstName}
        </Text>
        
        {/* Original message bubble (gray) */}
        <TouchableOpacity 
          style={styles.originalMessageBubble}
          onPress={handleReplyBubblePress}
          activeOpacity={0.7}
        >
          <Text style={styles.originalMessageText}>
            {getContentPreview()}
          </Text>
        </TouchableOpacity>
      </View>
    );
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
          <View>
            <TouchableOpacity 
              activeOpacity={0.9} 
              style={styles.imageMessageContainer}
              onPress={() => {
                setShowImageViewer(true);
              }}
              onLongPress={handleLongPress}
            >
              <Image 
                source={{ uri: message.imageUrl || 'https://via.placeholder.com/200' }} 
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
            {message.content && (
              <View style={[
                styles.imageCaptionBubble,
                isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
                { marginTop: 4 }
              ]}>
                <Text style={[
                  styles.messageText,
                  isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>
                  {message.content}
                </Text>
              </View>
            )}
          </View>
        );

      case 'voice':
        return (
          <TouchableOpacity 
            style={styles.voiceContainer}
            onPress={playVoiceMessage}
            activeOpacity={0.8}
          >
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
                    key={`waveform-${message.id}-${i}`}
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
            
            <Text style={[
              styles.voiceDuration,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {message.voiceDuration || 5}s
            </Text>
          </TouchableOpacity>
        );

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
        <View style={styles.reactionsGroup}>
          {Object.entries(reactionCounts).map(([emoji, count], index) => (
            <TouchableOpacity 
              key={`reaction-${index}-${emoji}`} 
              style={[
                styles.reactionItem,
                message.reactions[currentUserId] === emoji && styles.myReactionItem
              ]}
              onPress={() => handleReaction(emoji)}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
            </TouchableOpacity>
          ))}
        </View>
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
        
        {/* Reply preview outside the bubble */}
        {renderReplyPreview()}
        
        {/* Image messages are displayed outside the bubble */}
        {message.type === 'image' ? (
          <TouchableOpacity
            style={styles.imageMessageWrapper}
            onLongPress={handleLongPress}
            activeOpacity={1}
            onLayout={onMessageLayout}
          >
            {renderMessageContent()}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={getBubbleStyle()}
            onLongPress={handleLongPress}
            activeOpacity={0.8}
            onLayout={onMessageLayout}
          >
            {renderMessageContent()}
          </TouchableOpacity>
        )}
        
        {/* Image Viewer Modal */}
        {showImageViewer && (
          <Modal
            visible={showImageViewer}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowImageViewer(false)}
          >
            <View style={styles.imageViewerOverlay}>
              <TouchableOpacity 
                style={styles.imageViewerClose}
                onPress={() => setShowImageViewer(false)}
              >
                <X size={24} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageViewerContainer}
                activeOpacity={1}
                onPress={() => setShowImageViewer(false)}
              >
                <Image 
                  source={{ uri: message.imageUrl || 'https://via.placeholder.com/200' }} 
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </Modal>
        )}
      </View>

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
              {QUICK_REACTIONS.map((emoji, index) => (
                <TouchableOpacity
                  key={`emoji-${index}-${emoji}`}
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
    marginVertical: 2,
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
    marginBottom: 4,
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
    maxWidth: 250,
  },
  imageCaption: {
    marginTop: 8,
  },
  messageImage: {
    maxWidth: 280,
    maxHeight: 350,
    minWidth: 200,
    minHeight: 150,
    borderRadius: 16,
    marginVertical: 2,
  },
  imageMessageContainer: {
    maxWidth: '100%',
  },
  imageCaptionBubble: {
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    flex: 1,
  },
  waveformBar: {
    width: 2,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  voiceDuration: {
    fontSize: 11,
    opacity: 0.8,
    marginLeft: 6,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    marginBottom: 2,
    position: 'relative',
  },
  ownReactions: {
    justifyContent: 'flex-end',
    marginRight: 12,
  },
  otherReactions: {
    justifyContent: 'flex-start',
    marginLeft: 12,
  },
  reactionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginHorizontal: 1,
  },
  myReactionItem: {
    opacity: 1,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 9,
    color: Colors.light.secondaryText,
    marginLeft: 2,
    fontWeight: '600',
    minWidth: 8,
  },
  swipeTimestamp: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightedMessageWrapper: {
    position: 'absolute',
    zIndex: 1,
  },
  emojiMenu: {
    position: 'absolute',
    zIndex: 2,
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
  },
  replyPreviewContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'transparent',
    maxWidth: '90%',
    minWidth: '50%',
  },
  replyIndicatorText: {
    fontSize: 11,
    color: Colors.light.secondaryText,
    marginBottom: 4,
    backgroundColor: 'transparent',
    flexWrap: 'wrap',
  },
  originalMessageBubble: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
    maxWidth: '100%',
    minWidth: '50%',
  },
  originalMessageText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
  ownReplyContainer: {
    alignItems: 'flex-end',
  },
  otherReplyContainer: {
    alignItems: 'flex-start',
  },
  imageMessageWrapper: {
    maxWidth: MESSAGE_MAX_WIDTH,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  imageViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});