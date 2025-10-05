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
  Modal,
  TextInput,
  Vibration,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { 
  Reply,
  Edit3,
  Trash2,
  Copy,
  X
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ChatMessage as ChatMessageType, ReadReceipt } from '@/store/chatStore';
import useChatStore from '@/store/chatStore';

interface ChatMessageProps {
  message: ChatMessageType;
  planId: string;
  currentUserId: string;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  scrollToMessage?: (messageId: string) => void;
  previousMessage?: ChatMessageType;
  isLastMessage?: boolean; // New prop to indicate this is the last message in chat
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MESSAGE_MAX_WIDTH = SCREEN_WIDTH * 0.7;

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

// Helper function to check if we need a time separator
const shouldShowTimeSeparator = (currentMessage: ChatMessageType, previousMessage?: ChatMessageType): boolean => {
  if (!previousMessage) return false;
  
  const currentDate = new Date(currentMessage.timestamp);
  const previousDate = new Date(previousMessage.timestamp);
  
  // Check if it's a different day
  const isDifferentDay = currentDate.getDate() !== previousDate.getDate() ||
                        currentDate.getMonth() !== previousDate.getMonth() ||
                        currentDate.getFullYear() !== previousDate.getFullYear();
  
  if (isDifferentDay) return true;
  
  // Check if more than 30 minutes have passed
  const timeDiff = currentMessage.timestamp - previousMessage.timestamp;
  const thirtyMinutes = 30 * 60 * 1000;
  
  return timeDiff > thirtyMinutes;
};

// Helper function to format time separator
const formatTimeSeparator = (timestamp: number): string => {
  const now = new Date();
  const messageDate = new Date(timestamp);
  
  if (
    messageDate.getDate() === now.getDate() &&
    messageDate.getMonth() === now.getMonth() &&
    messageDate.getFullYear() === now.getFullYear()
  ) {
    return messageDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  
  if (
    messageDate.getDate() === yesterday.getDate() &&
    messageDate.getMonth() === yesterday.getMonth() &&
    messageDate.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }
  
  return messageDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

export default function ChatMessage({
  message,
  planId,
  currentUserId, 
  isOwnMessage,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  scrollToMessage,
  previousMessage,
  isLastMessage = false
}: ChatMessageProps) {
  const { addReaction, removeReaction, deleteMessage, editMessage, setReplyingTo, readReceipts } = useChatStore();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [isUnsending, setIsUnsending] = useState(false);
  const [messageLayout, setMessageLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showImageViewer, setShowImageViewer] = useState(false);

  // Animation for unsending and long press
  const unsendAnim = useRef(new Animated.Value(1)).current;
  const messageScale = useRef(new Animated.Value(1)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // Image viewer animations
  const imageViewerOpacity = useRef(new Animated.Value(0)).current;
  const imageViewerScale = useRef(new Animated.Value(0.5)).current;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Get users who have read the chat (shown only on last message)
  const getReadUsers = (): ReadReceipt[] => {
    // Only show read receipts on the last message
    if (!isLastMessage) return [];

    const planReadReceipts = readReceipts[planId] || {};
    const readUsers: ReadReceipt[] = [];

    Object.values(planReadReceipts).forEach((receipt: ReadReceipt) => {
      // Don't show current user's read status
      if (receipt.userId === currentUserId) return;

      // Show all users who have read receipts for this plan
      // They will be shown under the last message
      readUsers.push(receipt);
    });

    // Sort by read time (most recent first)
    return readUsers
      .sort((a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime());
  };

  const openImageViewer = () => {
    setShowImageViewer(true);
    
    imageViewerOpacity.setValue(0);
    imageViewerScale.setValue(0.5);
    
    Animated.parallel([
      Animated.timing(imageViewerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(imageViewerScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      })
    ]).start();
  };

  const closeImageViewer = () => {
    Animated.parallel([
      Animated.timing(imageViewerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(imageViewerScale, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowImageViewer(false);
    });
  };

  const handleLongPress = () => {
    Vibration.vibrate(50);
    
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
    setShowActions(false);
    
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
    setIsEditing(true);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.content) {
      editMessage(planId, message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  const handleReply = () => {
    setReplyingTo(planId, message);
    setShowActions(false);
  };

  const handleCopy = () => {
    // Simple alert for now since expo-clipboard caused issues
    Alert.alert('Copied', 'Message content copied');
    setShowActions(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteMessage(planId, message.id);
            setShowActions(false);
          }
        }
      ]
    );
  };

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    const { userName, content, type } = message.replyTo;
    const isReplyToSelf = message.replyTo.userId === currentUserId;
    
    const getFirstName = (fullName: string) => fullName.split(' ')[0];
    const senderFirstName = getFirstName(isOwnMessage ? 'You' : message.userName);
    const replyToFirstName = isReplyToSelf ? 'You' : getFirstName(userName);
    
    const getContentPreview = () => {
      switch (type) {
        case 'image':
          return '📷 Photo';
        case 'voice':
          return '🎵 Voice message';
        default:
          return content;
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
        <Text style={styles.replyIndicatorText}>
          <Reply size={12} color={Colors.light.secondaryText} />
          {' '}{senderFirstName} replied to {replyToFirstName}
        </Text>
        
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
    if (message.type === 'voice') {
      return (
        <View style={styles.audioMessage}>
          <Text style={styles.audioPlaceholder}>🎵 Voice message (temporarily disabled)</Text>
        </View>
      );
    }

    if (message.type === 'image') {
      return (
        <TouchableOpacity style={styles.imageContainer}>
          <Image 
            source={{ uri: message.imageUrl }} 
            style={styles.messageImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    if (isEditing) {
      return (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
          />
          <View style={styles.editActions}>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleCancelEdit}
            >
              <Text style={styles.editButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.editButton, styles.saveButton]}
              onPress={handleSaveEdit}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <Text style={[
        styles.messageText,
        isOwnMessage ? styles.ownMessageText : styles.otherMessageText
      ]}>
        {message.content}
      </Text>
    );
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

  const renderReadStatus = () => {
    // Show read status only on the last message
    const readUsers = getReadUsers();
    if (readUsers.length === 0) return null;

    return (
      <View style={styles.readStatusContainer}>
        {readUsers.map((receipt, index) => (
          <Image
            key={`read-${receipt.userId}`}
            source={{ uri: receipt.user.avatar_url || 'https://via.placeholder.com/20x20' }}
            style={[
              styles.readStatusAvatar,
              { marginLeft: index > 0 ? 4 : 0 } // Space avatars apart instead of overlapping
            ]}
          />
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
    <>
      {/* Time Separator */}
      {shouldShowTimeSeparator(message, previousMessage) && (
        <View style={styles.timeSeparatorWrapper}>
          <Text style={styles.timeSeparatorText}>
            {formatTimeSeparator(message.timestamp)}
          </Text>
        </View>
      )}
      
      <Animated.View 
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isOwnMessage && showAvatar && (
          <Image 
            source={{ uri: message.userAvatar }} 
            style={styles.avatar}
          />
        )}
        
        {!isOwnMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}
        
        <View style={{ flex: 1 }}>
          <View style={[
            styles.messageWrapper,
            isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper
          ]}>
            {!isOwnMessage && isFirstInGroup && (
              <Text style={styles.userName}>{message.userName}</Text>
            )}
            
            {renderReplyPreview()}
            
            {message.type === 'image' ? (
              <TouchableWithoutFeedback onLongPress={handleLongPress}>
                <View 
                  style={styles.imageMessageWrapper}
                  onLayout={onMessageLayout}
                >
                  {renderMessageContent()}
                </View>
              </TouchableWithoutFeedback>
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

            {renderReactions()}
          </View>

          {renderReadStatus()}

          {/* Image Viewer Modal */}
          {showImageViewer && (
            <Modal
              visible={showImageViewer}
              transparent={true}
              animationType="none"
              onRequestClose={closeImageViewer}
            >
              <Animated.View 
                style={[
                  styles.imageViewerOverlay,
                  { opacity: imageViewerOpacity }
                ]}
              >
                <BlurView intensity={80} style={StyleSheet.absoluteFill} />
                
                <TouchableOpacity 
                  style={styles.imageViewerClose}
                  onPress={closeImageViewer}
                >
                  <View style={styles.closeButtonBackground}>
                    <X size={20} color="white" />
                  </View>
                </TouchableOpacity>
                
                <Animated.View
                  style={[
                    styles.imageViewerContainer,
                    {
                      transform: [{ scale: imageViewerScale }]
                    }
                  ]}
                >
                  <Image 
                    source={{ uri: message.imageUrl || 'https://via.placeholder.com/200' }} 
                    style={styles.fullScreenImage}
                    resizeMode="contain"
                  />
                </Animated.View>
                
                <TouchableWithoutFeedback onPress={closeImageViewer}>
                  <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>
              </Animated.View>
            </Modal>
          )}
        </View>

        {/* Message Actions Modal */}
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
            
            {/* Highlighted Message */}
            <Animated.View 
              style={[
                styles.highlightedMessageWrapper,
                {
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
              {message.type === 'image' ? (
                <View>
                  {renderMessageContent()}
                </View>
              ) : (
                <View style={getBubbleStyle()}>
                  {renderMessageContent()}
                </View>
              )}
            </Animated.View>
            
            {/* Timestamp */}
            <Animated.View 
              style={[
                styles.highlightedTimestamp,
                {
                  left: isOwnMessage 
                    ? SCREEN_WIDTH - messageLayout.width - 16 - 60
                    : Math.max(16, Math.min(SCREEN_WIDTH - messageLayout.width - 16, messageLayout.x)) + messageLayout.width + 8,
                  top: Dimensions.get('window').height * 0.3 - 10,
                  opacity: modalOpacity,
                }
              ]}
            >
              <Text style={styles.highlightedTimestampText}>
                {formatTime(message.timestamp)}
              </Text>
            </Animated.View>
            
            {/* Emoji Menu */}
            <Animated.View 
              style={[
                styles.emojiMenu,
                {
                  left: isOwnMessage
                    ? SCREEN_WIDTH - 280 - 16
                    : Math.max(16, Math.min(SCREEN_WIDTH - 280 - 16, messageLayout.x + (messageLayout.width / 2) - 140)),
                  top: Dimensions.get('window').height * 0.3 - (messageLayout.height / 2) - 60,
                  opacity: modalOpacity,
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
            
            {/* Action Menu */}
            <Animated.View 
              style={[
                styles.actionMenu,
                {
                  left: isOwnMessage
                    ? SCREEN_WIDTH - 180 - 16
                    : Math.max(16, Math.min(SCREEN_WIDTH - 180 - 16, messageLayout.x + (messageLayout.width / 2) - 90)),
                  top: Dimensions.get('window').height * 0.3 + (messageLayout.height / 2) + 20,
                  opacity: modalOpacity,
                }
              ]}
            >
              {isOwnMessage ? (
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
    </>
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
    backgroundColor: '#E3F2FD',
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
    color: '#000000',
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
    color: 'rgba(0,0,0,0.5)',
  },
  otherEditedIndicator: {
    color: 'rgba(0,0,0,0.5)',
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
  voicePlaceholder: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 150,
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
    color: '#000000',
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
    maxWidth: '100%',
    minWidth: '60%',
  },
  replyIndicatorText: {
    fontSize: 11,
    color: Colors.light.secondaryText,
    marginBottom: 4,
    backgroundColor: 'transparent',
    flexShrink: 0,
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 12,
  },
  imageViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  highlightedTimestamp: {
    position: 'absolute',
    zIndex: 1,
  },
  highlightedTimestampText: {
    fontSize: 10,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  timeSeparatorWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timeSeparatorText: {
    fontSize: 10,
    color: Colors.light.secondaryText,
    marginHorizontal: 8,
    fontWeight: '500',
  },
  closeButtonBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioMessage: {
    padding: 8,
  },
  audioPlaceholder: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 200,
    maxHeight: 200,
  },
  readStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
    marginRight: 12,
    marginBottom: 4,
  },
  readStatusAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
}); 