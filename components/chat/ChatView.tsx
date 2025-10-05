import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import Colors from '@/constants/colors';
import useChatStore from '@/store/chatStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Plan } from '@/store/plansStore';

interface ChatViewProps {
  plan: Plan;
  currentUserId?: string;
  disableKeyboardAvoidance?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatView({ plan, currentUserId = 'current', disableKeyboardAvoidance = false }: ChatViewProps) {
  const { 
    messages, 
    markMessagesAsRead, 
    fetchMessages, 
    subscribeToChat, 
    unsubscribeFromChat,
    loading 
  } = useChatStore();
  const flatListRef = useRef<FlatList>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(1)).current;
  
  const planMessages = messages[plan.id] || [];
  const isLoading = loading[plan.id] || false;
  
  // Get current user from plan participants
  const currentUser = plan.participants.find(p => p.id === currentUserId);
  const currentUserName = currentUser?.name || 'You';
  const currentUserAvatar = currentUser?.avatar || '';

  // Fetch messages and subscribe to real-time updates
  useEffect(() => {
    console.log(`🔄 Loading chat for plan ${plan.id}`);
    
    // Fetch initial messages
    fetchMessages(plan.id);
    
    // Subscribe to real-time updates
    subscribeToChat(plan.id);
    
    // Cleanup: unsubscribe when component unmounts
    return () => {
      console.log(`🔌 Unsubscribing from chat ${plan.id}`);
      unsubscribeFromChat(plan.id);
    };
  }, [plan.id, fetchMessages, subscribeToChat, unsubscribeFromChat]);

  useEffect(() => {
    // Mark messages as read when chat is opened
    markMessagesAsRead(plan.id, currentUserId);
  }, [plan.id, currentUserId, markMessagesAsRead]);

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive
    if (planMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [planMessages.length]);

  // Check if we should show date separator
  const shouldShowDateSeparator = (currentMessage: any, previousMessage: any) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.timestamp);
    const previousDate = new Date(previousMessage.timestamp);
    
    // Show separator if messages are from different days
    if (currentDate.toDateString() !== previousDate.toDateString()) {
      return true;
    }
    
    // Show separator if messages are more than 15 minutes apart
    const timeDiff = currentMessage.timestamp - previousMessage.timestamp;
    return timeDiff > 15 * 60 * 1000; // 15 minutes
  };

  const formatDateSeparator = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isOwnMessage = item.userId === currentUserId;
    const previousMessage = index > 0 ? planMessages[index - 1] : null;
    const nextMessage = index < planMessages.length - 1 ? planMessages[index + 1] : null;
    const showDateSeparator = shouldShowDateSeparator(item, previousMessage);
    const isHighlighted = highlightedMessageId === item.id;
    
    // Check if we should show avatar (first message from user or after someone else)
    const showAvatar = !isOwnMessage && (
      !previousMessage || 
      previousMessage.userId !== item.userId ||
      showDateSeparator
    );
    
    // Determine if this is first/last in group for better bubble styling
    const isFirstInGroup = !previousMessage || 
      previousMessage.userId !== item.userId || 
      showDateSeparator;
    
    const isLastInGroup = !nextMessage || 
      nextMessage.userId !== item.userId ||
      shouldShowDateSeparator(nextMessage, item);
    
    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparatorContainer}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.timestamp)}
            </Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        
        <Animated.View style={[
          isHighlighted && {
            transform: [{ scale: highlightAnim }]
          }
        ]}>
          <ChatMessage
            message={item}
            planId={plan.id}
            currentUserId={currentUserId}
            isOwnMessage={isOwnMessage}
            showAvatar={showAvatar}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            scrollToMessage={scrollToMessage}
          />
        </Animated.View>
      </View>
    );
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    setShowScrollToBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const scrollToMessage = useCallback((messageId: string) => {
    const messageIndex = planMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1 && flatListRef.current) {
      // Scroll to message
      flatListRef.current.scrollToIndex({
        index: messageIndex,
        animated: true,
        viewPosition: 0.5, // Center the message
      });
      
      // Highlight animation
      setHighlightedMessageId(messageId);
      
      // Start highlight animation after a short delay
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(highlightAnim, {
            toValue: 1.1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(highlightAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Clear highlight after animation
          setTimeout(() => {
            setHighlightedMessageId(null);
          }, 500);
        });
      }, 300);
    }
  }, [planMessages, highlightAnim]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={planMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (planMessages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        onLayout={() => {
          if (planMessages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={20}
        inverted={false}
        onScrollToIndexFailed={(info) => {
          // Fallback: try to scroll after a short delay
          setTimeout(() => {
            if (flatListRef.current && info.index < planMessages.length) {
              flatListRef.current.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              });
            }
          }, 100);
        }}
      />
      
      {showScrollToBottom && (
        <Animated.View style={styles.scrollToBottomButton}>
          <TouchableOpacity onPress={scrollToBottom}>
            <View style={styles.scrollToBottomInner}>
              <Text style={styles.scrollToBottomText}>↓</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
      
      <ChatInput
        planId={plan.id}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  dateSeparatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dateSeparatorText: {
    fontSize: 11,
    color: Colors.light.secondaryText,
    marginHorizontal: 12,
    fontWeight: '500',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    zIndex: 100,
  },
  scrollToBottomInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  scrollToBottomText: {
    fontSize: 16,
    color: Colors.light.text,
  },
}); 