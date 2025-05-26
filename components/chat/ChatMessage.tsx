import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Platform
} from 'react-native';
import { 
  Heart, 
  ThumbsUp, 
  Laugh, 
  Angry, 
  Play,
  Pause,
  MoreHorizontal,
  Waveform
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

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
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
    setIsPlayingVoice(!isPlayingVoice);
    if (!isPlayingVoice) {
      // Simulate voice playback
      setTimeout(() => {
        setIsPlayingVoice(false);
        playbackAnimation.setValue(0);
      }, (message.voiceDuration || 0) * 1000);
    }
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
              source={{ uri: message.imageUrl }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
          </View>
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
          >
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
            
            <Text style={[
              styles.voiceDuration,
              isOwnMessage ? styles.ownVoiceDuration : styles.otherVoiceDuration
            ]}>
              {duration}s
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
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionBubble,
              message.reactions[currentUserId] === emoji && styles.selectedReaction
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
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
            message.type === 'voice' && styles.voiceMessageBubble
          ]}
          onLongPress={() => setShowReactions(true)}
          activeOpacity={0.8}
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
  voiceMessageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    gap: 12,
  },
  voiceWaveform: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  waveformBar: {
    width: 2,
    marginHorizontal: 1,
    borderRadius: 1,
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
    opacity: 0.8,
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
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  selectedReaction: {
    backgroundColor: `${Colors.light.primary}20`,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
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
  },
  reactionPicker: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 24,
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
  },
  closeReactionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.buttonBackground,
  },
});