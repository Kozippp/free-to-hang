import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { 
  Heart, 
  ThumbsUp, 
  Laugh, 
  Angry, 
  Play,
  Pause,
  MoreHorizontal
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ChatMessage as ChatMessageType } from '@/store/chatStore';
import useChatStore from '@/store/chatStore';

interface ChatMessageProps {
  message: ChatMessageType;
  planId: string;
  currentUserId: string;
  isOwnMessage: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MESSAGE_MAX_WIDTH = SCREEN_WIDTH * 0.75;

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

export default function ChatMessage({ 
  message, 
  planId, 
  currentUserId, 
  isOwnMessage 
}: ChatMessageProps) {
  const { addReaction, removeReaction, voteInPoll } = useChatStore();
  const [showReactions, setShowReactions] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const handleReaction = (emoji: string) => {
    const currentReaction = message.reactions[currentUserId];
    
    if (currentReaction === emoji) {
      removeReaction(planId, message.id, currentUserId);
    } else {
      addReaction(planId, message.id, currentUserId, emoji);
    }
    setShowReactions(false);
  };

  const handlePollVote = (optionId: string) => {
    voteInPoll(planId, message.id, optionId, currentUserId);
  };

  const playVoiceMessage = () => {
    // Placeholder for voice message playback
    setIsPlayingVoice(!isPlayingVoice);
    Alert.alert('Voice Message', 'Voice playback functionality would be implemented here');
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.content}
          </Text>
        );

      case 'image':
        return (
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
              source={{ uri: message.imageUrl || 'https://via.placeholder.com/200' }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
          </View>
        );

      case 'voice':
        return (
          <TouchableOpacity 
            style={styles.voiceContainer}
            onPress={playVoiceMessage}
          >
            {isPlayingVoice ? (
              <Pause size={20} color={isOwnMessage ? 'white' : Colors.light.primary} />
            ) : (
              <Play size={20} color={isOwnMessage ? 'white' : Colors.light.primary} />
            )}
            <View style={styles.voiceWaveform}>
              {Array.from({ length: 8 }).map((_, i) => (
                <View 
                  key={i}
                  style={[
                    styles.waveformBar,
                    { 
                      height: Math.random() * 20 + 10,
                      backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.7)' : Colors.light.primary
                    }
                  ]} 
                />
              ))}
            </View>
            <Text style={[
              styles.voiceDuration,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {message.voiceDuration || 5}s
            </Text>
          </TouchableOpacity>
        );

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
                    { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : Colors.light.buttonBackground }
                  ]}
                  onPress={() => handlePollVote(option.id)}
                >
                  <Text style={[
                    styles.pollOptionText,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                    hasVoted && styles.votedOptionText
                  ]}>
                    {option.text}
                  </Text>
                  <Text style={[
                    styles.pollPercentage,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                  ]}>
                    {percentage}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
        {Object.entries(reactionCounts).map(([emoji, count]) => (
          <View key={emoji} style={styles.reactionBubble}>
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      {!isOwnMessage && (
        <Image 
          source={{ uri: message.userAvatar }} 
          style={styles.avatar}
        />
      )}
      
      <View style={[
        styles.messageWrapper,
        isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper
      ]}>
        {!isOwnMessage && (
          <Text style={styles.userName}>{message.userName}</Text>
        )}
        
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
          ]}
          onLongPress={() => setShowReactions(true)}
        >
          {renderMessageContent()}
        </TouchableOpacity>
        
        {renderReactions()}
        
        <View style={[
          styles.messageInfo,
          isOwnMessage ? styles.ownMessageInfo : styles.otherMessageInfo
        ]}>
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
          {!message.isRead && !isOwnMessage && (
            <View style={styles.unreadDot} />
          )}
        </View>
      </View>

      {/* Reaction Picker */}
      {showReactions && (
        <View style={[
          styles.reactionPicker,
          isOwnMessage ? styles.ownReactionPicker : styles.otherReactionPicker
        ]}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionButton}
              onPress={() => handleReaction(emoji)}
            >
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.reactionButton}
            onPress={() => setShowReactions(false)}
          >
            <MoreHorizontal size={20} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 4,
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
    fontSize: 12,
    color: Colors.light.secondaryText,
    marginBottom: 2,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
  },
  ownMessageBubble: {
    backgroundColor: Colors.light.primary,
  },
  otherMessageBubble: {
    backgroundColor: Colors.light.cardBackground,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: Colors.light.text,
  },
  imageContainer: {
    maxWidth: 200,
  },
  imageCaption: {
    marginBottom: 8,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    paddingVertical: 4,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    flex: 1,
  },
  waveformBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1.5,
  },
  voiceDuration: {
    fontSize: 12,
    opacity: 0.8,
  },
  pollContainer: {
    minWidth: 200,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pollOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  votedPollOption: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  pollOptionText: {
    fontSize: 14,
    flex: 1,
  },
  votedOptionText: {
    fontWeight: '600',
  },
  pollPercentage: {
    fontSize: 12,
    opacity: 0.8,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
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
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    marginLeft: 2,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ownMessageInfo: {
    justifyContent: 'flex-end',
  },
  otherMessageInfo: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 11,
    color: Colors.light.secondaryText,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
    marginLeft: 4,
  },
  reactionPicker: {
    position: 'absolute',
    top: -50,
    backgroundColor: 'white',
    borderRadius: 25,
    flexDirection: 'row',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  ownReactionPicker: {
    right: 0,
  },
  otherReactionPicker: {
    left: 40,
  },
  reactionButton: {
    padding: 4,
    marginHorizontal: 2,
  },
  reactionPickerEmoji: {
    fontSize: 24,
  },
}); 