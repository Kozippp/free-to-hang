import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Animated,
  Platform,
  Alert
} from 'react-native';
import { 
  Check, 
  Clock, 
  Edit2, 
  MapPin, 
  Calendar, 
  ThumbsUp, 
  ThumbsDown, 
  Plus, 
  Eye, 
  EyeOff,
  HelpCircle,
  CheckCircle,
  UserPlus,
  Users,
  X
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan, ParticipantStatus, Poll } from '@/store/plansStore';
import PlanTabs from './PlanTabs';
import PlanTitle from './PlanTitle';
import PlanDescription from './PlanDescription';
import PlanParticipants from './PlanParticipants';
import PlanVisibilityToggle from './PlanVisibilityToggle';
import PlanUserStatus from './PlanUserStatus';
import InviteFriendsModal from './InviteFriendsModal';
import PollCreator from './PollCreator';
import PollVoting from './PollVoting';
import PollDisplay from './PollDisplay';
import InvitationVotingPoll from './InvitationVotingPoll';
import ChatView from '../chat/ChatView';
import usePlansStore from '@/store/plansStore';
import useChatStore from '@/store/chatStore';

interface PlanDetailViewProps {
  plan: Plan;
  onClose: () => void;
  onRespond: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => void;
}

export default function PlanDetailView({ plan, onClose, onRespond }: PlanDetailViewProps) {
  const { addPoll, voteOnPoll, addPollOption, invitations, activePlans, processExpiredInvitationPolls, createInvitationPollWithAutoVote } = usePlansStore();
  const { getUnreadCount } = useChatStore();
  
  // Get the latest plan data from store
  const latestPlan = [...invitations, ...activePlans].find(p => p.id === plan.id) || plan;
  
  const [activeTab, setActiveTab] = useState('Control Panel');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isGroupVisible, setIsGroupVisible] = useState(false);
  const [acceptingMode, setAcceptingMode] = useState('accepting'); // 'public' or 'accepting'
  const [highlightNewPlan, setHighlightNewPlan] = useState(false);
  
  // Poll states
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showPollVoting, setShowPollVoting] = useState(false);
  const [currentPollId, setCurrentPollId] = useState<string | null>(null);
  const [pollType, setPollType] = useState<'when' | 'where' | 'custom'>('custom');
  
  // Decline animation states
  const [isClosing, setIsClosing] = useState(false);
  const declineAnimation = useRef(new Animated.Value(1)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  
  // Get current user's status from latest plan data
  const currentUser = latestPlan.participants.find(p => p.id === 'current');
  const currentUserStatus = currentUser?.status || 'pending';
  
  // Check if user is going (has responded with 'accepted')
  const isInYesGang = currentUserStatus === 'accepted';
  
  // Group participants by status
  const acceptedParticipants = latestPlan.participants.filter(p => p.status === 'accepted');
  const maybeParticipants = latestPlan.participants.filter(p => 
    p.status === 'maybe' || p.status === 'conditional'
  );
  const pendingParticipants = latestPlan.participants.filter(p => p.status === 'pending');
  
  // Get polls from the plan
  const polls = latestPlan.polls || [];
  const whenPoll = polls.find(poll => poll.type === 'when');
  const wherePoll = polls.find(poll => poll.type === 'where');
  const customPolls = polls.filter(poll => poll.type === 'custom');
  const invitationPolls = polls.filter(poll => poll.type === 'invitation');
  
  // Animation for highlighting new plan
  const highlightAnim = useRef(new Animated.Value(0)).current;
  
  // Process expired invitation polls periodically
  React.useEffect(() => {
    const interval = setInterval(() => {
      processExpiredInvitationPolls();
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [processExpiredInvitationPolls]);
  
  React.useEffect(() => {
    if (highlightNewPlan) {
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: false,
        })
      ]).start(() => {
        setHighlightNewPlan(false);
      });
    }
  }, [highlightNewPlan, highlightAnim]);
  
  const highlightBackground = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(91, 138, 245, 0)', 'rgba(91, 138, 245, 0.1)']
  });
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };
  
  const handleTitleSave = () => {
    // In a real app, this would update the plan in the backend
    setEditingTitle(false);
    // Only people who are going can edit title
  };
  
  const handleDescriptionSave = () => {
    // In a real app, this would update the plan in the backend
    setEditingDescription(false);
    // Only people who are going can edit description
  };
  
  const handleCreatePoll = (type: 'when' | 'where' | 'custom') => {
    if (!isInYesGang) {
      Alert.alert(
        'Cannot Create Poll',
        'You need to respond "Going" to the plan to create polls and suggest changes.',
        [
          { text: 'OK', style: 'default' }
        ]
      );
      return;
    }
    
    setPollType(type);
    
    // Set initial question based on type
    let initialQuestion = '';
    if (type === 'when') {
      initialQuestion = 'When should we meet?';
    } else if (type === 'where') {
      initialQuestion = 'Where should we meet?';
    }
    
    setShowPollCreator(true);
  };
  
  const handlePollSubmit = (question: string, options: string[]) => {
    // Create a new poll
    const newPoll: Poll = {
      id: `poll-${Date.now()}`,
      question,
      type: pollType,
      options: options.map((text, index) => ({
        id: `option-${Date.now()}-${index}`,
        text,
        votes: []
      }))
    };
    
    // Add the poll to the plan
    addPoll(plan.id, newPoll);
    
    // Close the poll creator
    setShowPollCreator(false);
  };
  
  const handleOpenVoting = (pollId: string) => {
    setCurrentPollId(pollId);
    setShowPollVoting(true);
  };
  
  const handleVoteSubmit = (selectedOptionIds: string[]) => {
    if (!currentPollId) return;
    
    // Submit votes
    voteOnPoll(plan.id, currentPollId, selectedOptionIds, 'current');
    
    // Close voting modal
    setShowPollVoting(false);
    setCurrentPollId(null);
  };
  
  const handleInviteFriends = () => {
    setShowInviteModal(true);
  };

  const handleCreateInvitationPoll = (friendIds: string[], friendNames: string[]) => {
    // Use the new function with auto-vote for the creator
    createInvitationPollWithAutoVote(latestPlan.id, friendIds, friendNames, 'current');
    setShowInviteModal(false);
  };
  
  const handleToggleGroupVisibility = () => {
    // In a real app, this would trigger a vote
    setIsGroupVisible(!isGroupVisible);
  };
  
  const handleChangeAcceptingMode = (mode: string) => {
    // In a real app, this would trigger a vote
    setAcceptingMode(mode);
  };
  
  const handleStatusChange = (status: ParticipantStatus, conditionalFriends?: string[]) => {
    // If changing from Yes to Maybe/If, show warning
    if (currentUserStatus === 'accepted' && (status === 'maybe' || status === 'conditional')) {
      Alert.alert(
        'Change Status',
        'Changing your status will remove all your votes. Are you sure?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Change',
            onPress: () => {
              onRespond(plan.id, status, conditionalFriends);
            }
          }
        ]
      );
    } else if (status === 'declined') {
      // Start decline animation
      setIsClosing(true);
      
      // Create smooth closing animation
      Animated.parallel([
        Animated.timing(declineAnimation, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnimation, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        // After animation, actually decline and close
        onRespond(plan.id, status, conditionalFriends);
        
        // Small delay to show the effect, then close
        setTimeout(() => {
          onClose();
        }, 200);
      });
    } else {
      onRespond(plan.id, status, conditionalFriends);
    }
  };
  
  // Helper function to get user votes for a poll
  const getUserVotesForPoll = (pollId: string): string[] => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return [];
    
    return poll.options
      .filter(option => option.votes.includes('current'))
      .map(option => option.id);
  };
  
  // Helper function to get total votes for a poll
  const getTotalVotesForPoll = (pollId: string): number => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return 0;
    
    // Count unique voters
    const uniqueVoters = new Set<string>();
    poll.options.forEach(option => {
      option.votes.forEach(voterId => {
        uniqueVoters.add(voterId);
      });
    });
    
    return uniqueVoters.size;
  };
  
  // Prepare poll data for display
  const preparePollForDisplay = (poll: Poll) => {
    return {
      ...poll,
      options: poll.options.map(option => ({
        ...option,
        votes: option.votes.length,
        voters: option.votes.map(voterId => {
          const participant = latestPlan.participants.find(p => p.id === voterId);
          return participant ? {
            id: participant.id,
            name: participant.name,
            avatar: participant.avatar
          } : {
            id: voterId,
            name: `User ${voterId}`,
            avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face`
          };
        })
      }))
    };
  };
  
  // Get unread message count for this plan
  const unreadCount = getUnreadCount(latestPlan.id, 'current');

  // Helper function to handle poll voting with multiple selections
  const handlePollVote = (pollId: string, optionId: string) => {
    const currentVotes = getUserVotesForPoll(pollId);
    let newVotes: string[];
    
    if (currentVotes.includes(optionId)) {
      // Remove vote if already selected
      newVotes = currentVotes.filter(id => id !== optionId);
    } else {
      // Add vote if not selected
      newVotes = [...currentVotes, optionId];
    }
    
    voteOnPoll(plan.id, pollId, newVotes, 'current');
  };

  return (
    <Animated.View style={[
      styles.container, 
      { 
        backgroundColor: highlightBackground,
        transform: [
          { scale: declineAnimation },
          { translateY: slideAnimation }
        ],
        opacity: fadeAnimation
      }
    ]}>
      {/* Decline overlay effect */}
      {isClosing && (
        <Animated.View style={[
          styles.declineOverlay,
          { opacity: fadeAnimation.interpolate({
            inputRange: [0.3, 1],
            outputRange: [0.7, 0],
            extrapolate: 'clamp'
          })}
        ]}>
          <Text style={styles.declineText}>Plan Declined ✓</Text>
        </Animated.View>
      )}
      
      <PlanTabs 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        unreadCount={unreadCount}
      />
      
      {activeTab === 'Control Panel' && (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        >
          {/* Title Section */}
          <PlanTitle 
            title={title} 
            isEditing={editingTitle}
            onEdit={() => isInYesGang && setEditingTitle(true)}
            onSave={handleTitleSave}
            onChange={setTitle}
            canEdit={isInYesGang}
          />
          
          {/* Description Section */}
          <PlanDescription
            description={description}
            isEditing={editingDescription}
            onEdit={() => isInYesGang && setEditingDescription(true)}
            onSave={handleDescriptionSave}
            onChange={setDescription}
            canEdit={isInYesGang}
          />
          
          {/* When Section */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Clock size={20} color={Colors.light.text} style={styles.headerIcon} />
              <Text style={styles.sectionTitle}>When</Text>
            </View>
            
            {whenPoll ? (
              <PollDisplay
                question={whenPoll.question}
                options={preparePollForDisplay(whenPoll).options}
                onVote={(optionId) => handlePollVote(whenPoll.id, optionId)}
                userVotes={getUserVotesForPoll(whenPoll.id)}
                totalVotes={getTotalVotesForPoll(whenPoll.id)}
                canVote={isInYesGang}
              />
            ) : (
              <View style={styles.emptyPollContainer}>
                <Text style={styles.emptyPollText}>
                  No time has been set yet
                </Text>
                
                <TouchableOpacity 
                  style={[
                    styles.createPollButton,
                    !isInYesGang && styles.disabledCreateButton
                  ]}
                  onPress={() => handleCreatePoll('when')}
                >
                  <Text style={[
                    styles.createPollButtonText,
                    !isInYesGang && styles.disabledCreateButtonText
                  ]}>
                    Suggest a time
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Where Section */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <MapPin size={20} color={Colors.light.text} style={styles.headerIcon} />
              <Text style={styles.sectionTitle}>Where</Text>
            </View>
            
            {wherePoll ? (
              <PollDisplay
                question={wherePoll.question}
                options={preparePollForDisplay(wherePoll).options}
                onVote={(optionId) => handlePollVote(wherePoll.id, optionId)}
                userVotes={getUserVotesForPoll(wherePoll.id)}
                totalVotes={getTotalVotesForPoll(wherePoll.id)}
                canVote={isInYesGang}
              />
            ) : (
              <View style={styles.emptyPollContainer}>
                <Text style={styles.emptyPollText}>
                  No location has been set yet
                </Text>
                
                <TouchableOpacity 
                  style={[
                    styles.createPollButton,
                    !isInYesGang && styles.disabledCreateButton
                  ]}
                  onPress={() => handleCreatePoll('where')}
                >
                  <Text style={[
                    styles.createPollButtonText,
                    !isInYesGang && styles.disabledCreateButtonText
                  ]}>
                    Suggest a location
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Custom Polls Section */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>Need to decide something else?</Text>
            </View>
            
            {customPolls.length > 0 && customPolls.map((poll) => (
              <PollDisplay
                key={poll.id}
                question={poll.question}
                options={preparePollForDisplay(poll).options}
                onVote={(optionId) => handlePollVote(poll.id, optionId)}
                userVotes={getUserVotesForPoll(poll.id)}
                totalVotes={getTotalVotesForPoll(poll.id)}
                canVote={isInYesGang}
              />
            ))}
            
            <TouchableOpacity 
              style={[
                styles.createPollButton,
                !isInYesGang && styles.disabledCreateButton
              ]}
              onPress={() => handleCreatePoll('custom')}
            >
              <Text style={[
                styles.createPollButtonText,
                !isInYesGang && styles.disabledCreateButtonText
              ]}>
                Create a new poll
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Participants Section */}
          <PlanParticipants
            acceptedParticipants={acceptedParticipants}
            maybeParticipants={maybeParticipants}
            pendingParticipants={pendingParticipants}
            onInvite={() => {}}
            canInvite={false}
          />

          {/* Invitations Section - Improved structure */}
          {invitationPolls.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.headerRow}>
                <UserPlus size={20} color={Colors.light.text} style={styles.headerIcon} />
                <Text style={styles.sectionTitle}>Invitations</Text>
              </View>
              
              <Text style={styles.invitationDescription}>
                Active vote to invite these people is happening. Cast your vote and majority decides.
              </Text>
              
              {/* Active invitation votes */}
              {invitationPolls.map((poll) => {
                const invitedUsers = poll.invitedUsers?.map(userId => {
                  // Mock data for invited users - in real app this would come from user store
                  return {
                    id: userId,
                    name: `User ${userId}`,
                    avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face`
                  };
                }) || [];

                const hasUserVoted = poll.options.some(option => 
                  option.votes.includes('current')
                );

                return (
                  <InvitationVotingPoll
                    key={poll.id}
                    poll={poll}
                    onVote={(pollId, optionId) => {
                      // Only allow voting if user is "going"
                      if (isInYesGang) {
                        handlePollVote(pollId, optionId);
                      }
                    }}
                    userVoted={hasUserVoted}
                    invitedUsers={invitedUsers}
                    canVote={isInYesGang}
                  />
                );
              })}
              
              {/* Invite more people button at bottom */}
              <TouchableOpacity 
                style={[
                  styles.inviteMoreButton,
                  !isInYesGang && styles.disabledCreateButton
                ]}
                onPress={handleInviteFriends}
                disabled={!isInYesGang}
              >
                <UserPlus size={16} color={isInYesGang ? Colors.light.primary : Colors.light.secondaryText} />
                <Text style={[
                  styles.inviteMoreButtonText,
                  !isInYesGang && styles.disabledCreateButtonText
                ]}>
                  Invite more people
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Simple invite button when no active votes */
            isInYesGang && (
              <TouchableOpacity 
                style={styles.simpleInviteButton}
                onPress={handleInviteFriends}
              >
                <UserPlus size={16} color={Colors.light.primary} />
                <Text style={styles.simpleInviteButtonText}>
                  Invite more people
                </Text>
              </TouchableOpacity>
            )
          )}
          
          {/* Group Visibility Section */}
          <PlanVisibilityToggle
            isVisible={isGroupVisible}
            acceptingMode={acceptingMode}
            onToggle={handleToggleGroupVisibility}
            onChangeMode={handleChangeAcceptingMode}
            canVote={isInYesGang}
          />
          
          {/* User Status Section */}
          <PlanUserStatus
            currentStatus={currentUserStatus}
            onStatusChange={handleStatusChange}
            participants={latestPlan.participants}
            currentUserId="current"
          />
          
          {/* Bottom padding for better scrolling */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
      
      {activeTab === 'Chat' && (
        <ChatView plan={latestPlan} currentUserId="current" />
      )}
      
      {/* Poll Creator Modal */}
      <PollCreator
        visible={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onSubmit={handlePollSubmit}
        pollType={pollType}
      />
      
      {/* Poll Voting Modal */}
      {currentPollId && (
        <PollVoting
          visible={showPollVoting}
          onClose={() => setShowPollVoting(false)}
          question={polls.find(p => p.id === currentPollId)?.question || ''}
          options={(() => {
            const poll = polls.find(p => p.id === currentPollId);
            if (!poll) return [];
            return preparePollForDisplay(poll).options;
          })()}
          onVote={handleVoteSubmit}
          userVotes={getUserVotesForPoll(currentPollId)}
          currentUserId="current"
        />
      )}
      
      {/* Invite Friends Modal */}
      <InviteFriendsModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={(friendIds) => {
          // Legacy callback - not used anymore
          setShowInviteModal(false);
        }}
        onCreateInvitationPoll={handleCreateInvitationPoll}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  emptyPollContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyPollText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 16,
  },
  createPollButton: {
    backgroundColor: `${Colors.light.primary}15`,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  createPollButtonText: {
    color: Colors.light.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  disabledCreateButton: {
    opacity: 0.6,
  },
  disabledCreateButtonText: {
    color: Colors.light.secondaryText,
  },
  customPollSection: {
    marginBottom: 16,
  },
  customPollExplanation: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    marginTop: 8,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  customPollContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },

  bottomPadding: {
    height: 40,
  },
  declineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  declineText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  invitationDescription: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 16,
  },
  inviteMoreButton: {
    flexDirection: 'row',
    backgroundColor: `${Colors.light.primary}15`,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 12,
  },
  inviteMoreButtonText: {
    color: Colors.light.primary,
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 8,
  },
  simpleInviteButton: {
    flexDirection: 'row',
    backgroundColor: `${Colors.light.primary}15`,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  simpleInviteButtonText: {
    color: Colors.light.primary,
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 8,
  },
});