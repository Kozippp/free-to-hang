import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import Colors from '@/constants/colors';
import useChatStore from '@/store/chatStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Plan } from '@/store/plansStore';

interface ChatViewProps {
  plan: Plan;
  currentUserId?: string;
}

export default function ChatView({ plan, currentUserId = 'current' }: ChatViewProps) {
  const { messages, markMessagesAsRead } = useChatStore();
  const flatListRef = useRef<FlatList>(null);
  
  const planMessages = messages[plan.id] || [];
  
  // Get current user from plan participants
  const currentUser = plan.participants.find(p => p.id === currentUserId);
  const currentUserName = currentUser?.name || 'You';
  const currentUserAvatar = currentUser?.avatar || '';

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

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isOwnMessage = item.userId === currentUserId;
    
    return (
      <ChatMessage
        key={item.id}
        message={item}
        planId={plan.id}
        currentUserId={currentUserId}
        isOwnMessage={isOwnMessage}
      />
    );
  };

  const getItemLayout = (_: any, index: number) => ({
    length: 80, // Estimated height
    offset: 80 * index,
    index,
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={planMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
        onLayout={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        getItemLayout={getItemLayout}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={20}
      />
      
      <ChatInput
        planId={plan.id}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
      />
    </KeyboardAvoidingView>
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
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
}); 