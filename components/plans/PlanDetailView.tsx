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
  Alert,
  KeyboardAvoidingView
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
  const { 
    markAsRead, 
    addPoll, 
    voteOnPoll, 
    updatePollOption, 
    removePollOption, 
    addPollOption, 
    deletePoll,
    createInvitationPollWithAutoVote, 
    markPlanAsCompleted, 
    canMarkAsCompleted,
    voteForCompletion,
    removeCompletionVote,
    getCompletionVotingStatus,
    invitations,
    activePlans,
    processExpiredInvitationPolls
  } = usePlansStore();
  const { getUnreadCount } = useChatStore();
  
  // Get the latest plan data from store
  const latestPlan = [...invitations, ...activePlans].find(p => p.id === plan.id) || plan;
  
  const [activeTab, setActiveTab] = useState('Control Panel');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [highlightNewPlan, setHighlightNewPlan] = useState(false);
  
  // Poll states
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showPollVoting, setShowPollVoting] = useState(false);
  const [currentPollId, setCurrentPollId] = useState<string | null>(null);
  const [pollType, setPollType] = useState<'when' | 'where' | 'custom'>('custom');
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  
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
  
  const handleCreatePoll = (type: 'when' | 'where' | 'custom', existingPoll?: Poll) => {
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
    setEditingPoll(existingPoll || null);
    setShowPollCreator(true);
  };
  
  const handlePollSubmit = (question: string, options: string[]) => {
    if (editingPoll) {
      // Update existing poll
      const updatedPoll: Poll = {
        ...editingPoll,
        question,
        options: options.map((text, index) => {
          // Keep existing votes if option text hasn't changed
          const existingOption = editingPoll.options.find(opt => opt.text === text);
          return {
            id: existingOption?.id || `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
            text,
            votes: existingOption?.votes || []
          };
        })
      };
      
      // Update the poll in the store
      addPoll(latestPlan.id, updatedPoll);
    } else {
      // Create a new poll
      const newPoll: Poll = {
        id: `poll-${Date.now()}`,
        question,
        type: pollType,
        options: options.map((text, index) => ({
          id: `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
          text,
          votes: []
        }))
      };
      
      // Add the new poll to the plan
      addPoll(latestPlan.id, newPoll);
    }
    
    // Close the poll creator and reset state
    setShowPollCreator(false);
    setEditingPoll(null);
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
  
  const handleStatusChange = (status: ParticipantStatus, conditionalFriends?: string[]) => {
    if (status === 'declined') {
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
      // For all other status changes, pass through directly
      // PlanUserStatus component handles the warnings
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

  // Helper function to handle invitation poll voting (single selection)
  const handleInvitationVote = (pollId: string, optionId: string) => {
    // For invitation polls, only allow one vote (either Allow or Deny)
    voteOnPoll(plan.id, pollId, [optionId], 'current');
  };

  // Helper function to handle poll deletion
  const handleDeletePoll = (pollId: string) => {
    deletePoll(plan.id, pollId);
  };

  // Helper function to handle marking plan as completed
  const handleMarkAsCompleted = () => {
    const votingStatus = getCompletionVotingStatus(latestPlan);
    
    if (votingStatus.hasUserVoted) {
      // User wants to remove their vote
      Alert.alert(
        'Remove Completion Vote',
        'Do you want to remove your vote for completion?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Remove Vote', 
            style: 'destructive',
            onPress: () => {
              removeCompletionVote(plan.id, 'current');
            }
          }
        ]
      );
    } else {
      // User wants to vote for completion
      const remainingVotes = votingStatus.requiredVotes - votingStatus.votedUsers.length;
      Alert.alert(
        'Vote for Completion',
        `Vote to mark this plan as completed. ${remainingVotes} more vote${remainingVotes === 1 ? '' : 's'} needed to automatically complete.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Vote to Complete', 
            style: 'default',
            onPress: () => {
              voteForCompletion(plan.id, 'current');
              
              // Check if this vote will complete the plan
              if (remainingVotes === 1) {
                // This will be the last vote needed, close modal after short delay
                setTimeout(() => {
                  onClose();
                }, 1000);
              }
            }
          }
        ]
      );
    }
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
          
          {/* Time and Location Sections */}
          {!whenPoll && !wherePoll && !isInYesGang ? (
            /* Combined view when both are not set for invitees */
            <View style={styles.section}>
              <View style={styles.notSetContainer}>
                <Text style={styles.notSetText}>Time and location haven't been decided yet</Text>
                <Text style={styles.notSetSubtext}>Put "Going" to be the first one to suggest when and where to meet!</Text>
              </View>
            </View>
          ) : (
            <>
              {/* When Section */}
              <View style={styles.section}>
                <View style={styles.headerRow}>
                  <Clock size={20} color={Colors.light.text} style={styles.headerIcon} />
                  <Text style={styles.sectionTitle}>What time works best?</Text>
                </View>
                
                {whenPoll ? (
                  <PollDisplay
                    question={whenPoll.question}
                    options={preparePollForDisplay(whenPoll).options}
                    onVote={(optionId) => handlePollVote(whenPoll.id, optionId)}
                    userVotes={getUserVotesForPoll(whenPoll.id)}
                    totalVotes={getTotalVotesForPoll(whenPoll.id)}
                    canVote={isInYesGang}
                    onEdit={() => handleCreatePoll('when', whenPoll)}
                    totalGoingParticipants={acceptedParticipants.length}
                    hideQuestion={true}
                  />
                ) : isInYesGang ? (
                  <View style={styles.emptyPollContainer}>
                    <Text style={styles.emptyPollText}>
                      No time has been set yet
                    </Text>
                    
                    <TouchableOpacity 
                      style={styles.createPollButton}
                      onPress={() => handleCreatePoll('when')}
                    >
                      <Text style={styles.createPollButtonText}>
                        Suggest a time
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.notSetContainer}>
                    <Text style={styles.notSetText}>Time hasn't been decided yet</Text>
                    <Text style={styles.notSetSubtext}>Put "Going" to be the first one to suggest a time!</Text>
                  </View>
                )}
              </View>
              
              {/* Where Section */}
              <View style={styles.section}>
                <View style={styles.headerRow}>
                  <MapPin size={20} color={Colors.light.text} style={styles.headerIcon} />
                  <Text style={styles.sectionTitle}>Where should we meet?</Text>
                </View>
                
                {wherePoll ? (
                  <PollDisplay
                    question={wherePoll.question}
                    options={preparePollForDisplay(wherePoll).options}
                    onVote={(optionId) => handlePollVote(wherePoll.id, optionId)}
                    userVotes={getUserVotesForPoll(wherePoll.id)}
                    totalVotes={getTotalVotesForPoll(wherePoll.id)}
                    canVote={isInYesGang}
                    onEdit={() => handleCreatePoll('where', wherePoll)}
                    totalGoingParticipants={acceptedParticipants.length}
                    hideQuestion={true}
                  />
                ) : isInYesGang ? (
                  <View style={styles.emptyPollContainer}>
                    <Text style={styles.emptyPollText}>
                      No location has been set yet
                    </Text>
                    
                    <TouchableOpacity 
                      style={styles.createPollButton}
                      onPress={() => handleCreatePoll('where')}
                    >
                      <Text style={styles.createPollButtonText}>
                        Suggest a location
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.notSetContainer}>
                    <Text style={styles.notSetText}>Location hasn't been decided yet</Text>
                    <Text style={styles.notSetSubtext}>Put "Going" to be the first one to suggest a location!</Text>
                  </View>
                )}
              </View>
            </>
          )}
          
          {/* Custom Polls Sections - Only show if user is going */}
          {isInYesGang && customPolls.map((poll) => (
            <View key={poll.id} style={styles.section}>
              <PollDisplay
                question={poll.question}
                options={preparePollForDisplay(poll).options}
                onVote={(optionId) => handlePollVote(poll.id, optionId)}
                userVotes={getUserVotesForPoll(poll.id)}
                totalVotes={getTotalVotesForPoll(poll.id)}
                canVote={isInYesGang}
                onEdit={() => handleCreatePoll('custom', poll)}
                totalGoingParticipants={acceptedParticipants.length}
                onDelete={() => handleDeletePoll(poll.id)}
              />
            </View>
          ))}
          
          {/* Create Poll Section - Only show if user is going */}
          {isInYesGang && (
            <View style={styles.section}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Need to decide something else?</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.createPollButton}
                onPress={() => handleCreatePoll('custom')}
              >
                <Text style={styles.createPollButtonText}>
                  Create a poll
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
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
              
              <Text style={[styles.invitationDescription, { marginTop: -8 }]}>
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
                        handleInvitationVote(pollId, optionId);
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
          
          {/* Mark as Completed Section - Show to going users always, maybe users only if voting started */}
          {canMarkAsCompleted(latestPlan) && (
            isInYesGang || 
            (currentUserStatus === 'maybe' && getCompletionVotingStatus(latestPlan).votedUsers.length > 0)
          ) && (
            <View style={styles.section}>
              <View style={styles.headerRow}>
                <CheckCircle size={20} color={Colors.light.text} style={styles.headerIcon} />
                <Text style={styles.sectionTitle}>Plan Complete?</Text>
              </View>
              
              {(() => {
                const votingStatus = getCompletionVotingStatus(latestPlan);
                const remainingVotes = votingStatus.requiredVotes - votingStatus.votedUsers.length;
                
                return (
                  <>
                    <Text style={styles.completionDescription}>
                      Mark this hangout as completed.
                    </Text>
                    
                    {votingStatus.votedUsers.length > 0 && (
                      <View style={styles.votingStatus}>
                        <Text style={styles.votingStatusText}>
                          {remainingVotes} more vote{remainingVotes === 1 ? '' : 's'} needed to confirm the completion
                        </Text>
                        
                        <View style={styles.votingProgress}>
                          <View style={[
                            styles.votingProgressBar,
                            { width: `${Math.min((votingStatus.votedUsers.length / votingStatus.requiredVotes) * 100, 100)}%` }
                          ]} />
                        </View>
                      </View>
                    )}
                    
                    {/* Show voting buttons for Going users, info for Maybe users */}
                    {isInYesGang ? (
                      votingStatus.votedUsers.length === 0 ? (
                        /* Minimalistic single button when no votes */
                        <TouchableOpacity 
                          style={[
                            styles.singleCompleteButton,
                            votingStatus.hasUserVoted && styles.singleCompleteButtonPressed
                          ]}
                          onPress={() => {
                            voteForCompletion(plan.id, 'current');
                            
                            // Check if this vote will complete the plan
                            if (remainingVotes === 1) {
                              setTimeout(() => {
                                onClose();
                              }, 1000);
                            }
                          }}
                        >
                          <Text style={styles.singleCompleteButtonText}>
                            Complete
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        /* Two button layout when voting has started */
                        <View style={styles.completionVotingContainer}>
                          <TouchableOpacity 
                            style={[
                              styles.completionVoteButton,
                              styles.completeButton,
                              !votingStatus.hasUserVoted && styles.completionVoteButtonActive
                            ]}
                            onPress={() => {
                              if (!votingStatus.hasUserVoted) {
                                voteForCompletion(plan.id, 'current');
                                
                                // Check if this vote will complete the plan
                                if (remainingVotes === 1) {
                                  setTimeout(() => {
                                    onClose();
                                  }, 1000);
                                }
                              }
                            }}
                          >
                            <Text style={[
                              styles.completionVoteButtonText,
                              { color: !votingStatus.hasUserVoted ? Colors.light.onlineGreen : Colors.light.text }
                            ]}>
                              Complete
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={[
                              styles.completionVoteButton,
                              styles.notCompleteButton,
                              votingStatus.hasUserVoted && styles.completionVoteButtonActiveWhite
                            ]}
                            onPress={() => {
                              if (votingStatus.hasUserVoted) {
                                removeCompletionVote(plan.id, 'current');
                              }
                            }}
                          >
                            <Text style={[
                              styles.completionVoteButtonText,
                              { color: votingStatus.hasUserVoted ? Colors.light.text : Colors.light.secondaryText }
                            ]}>
                              Not Yet
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )
                    ) : (
                      /* For maybe participants - show same buttons but alert when clicked */
                      votingStatus.votedUsers.length === 0 ? (
                        /* Show nothing to maybe users when no one has voted */
                        null
                      ) : (
                        /* Show buttons to maybe users when voting has started, but they can't vote */
                        <View style={styles.completionVotingContainer}>
                          <TouchableOpacity 
                            style={[
                              styles.completionVoteButton,
                              styles.completeButton,
                              !votingStatus.hasUserVoted && styles.completionVoteButtonActive
                            ]}
                            onPress={() => {
                              Alert.alert(
                                'Cannot Vote',
                                'Only participants marked as "Going" can vote to complete the plan.',
                                [{ text: 'OK', style: 'default' }]
                              );
                            }}
                          >
                            <Text style={[
                              styles.completionVoteButtonText,
                              { color: !votingStatus.hasUserVoted ? Colors.light.onlineGreen : Colors.light.text }
                            ]}>
                              Complete
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={[
                              styles.completionVoteButton,
                              styles.notCompleteButton,
                              votingStatus.hasUserVoted && styles.completionVoteButtonActiveWhite
                            ]}
                            onPress={() => {
                              Alert.alert(
                                'Cannot Vote',
                                'Only participants marked as "Going" can vote to complete the plan.',
                                [{ text: 'OK', style: 'default' }]
                              );
                            }}
                          >
                            <Text style={[
                              styles.completionVoteButtonText,
                              { color: votingStatus.hasUserVoted ? Colors.light.text : Colors.light.secondaryText }
                            ]}>
                              Not Yet
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )
                    )}
                  </>
                );
              })()}
            </View>
          )}
          
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
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <ChatView 
            plan={latestPlan} 
            currentUserId="current" 
            disableKeyboardAvoidance={true}
          />
        </KeyboardAvoidingView>
      )}
      
      {/* Poll Creator Modal */}
      <PollCreator
        visible={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onSubmit={handlePollSubmit}
        pollType={pollType}
        existingPoll={editingPoll}
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
    zIndex: 1000,
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
  notSetContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  notSetText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  notSetSubtext: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 18,
  },
  completionDescription: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 16,
  },
  votingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  votingStatusText: {
    fontSize: 14,
    color: Colors.light.text,
    marginRight: 8,
  },
  votingProgress: {
    height: 12,
    backgroundColor: Colors.light.border,
    borderRadius: 6,
    flex: 1,
  },
  votingProgressBar: {
    height: '100%',
    backgroundColor: Colors.light.onlineGreen,
    borderRadius: 6,
  },
  completionVotingContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  completionVoteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: `${Colors.light.border}30`,
    borderColor: Colors.light.border,
  },
  completeButton: {
    // Base styles - will be overridden by active state
  },
  notCompleteButton: {
    // Base styles - will be overridden by active state
  },
  completionVoteButtonActive: {
    backgroundColor: `${Colors.light.onlineGreen}20`,
    borderColor: Colors.light.onlineGreen,
  },
  completionVoteButtonActiveWhite: {
    backgroundColor: 'white',
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  completionVoteButtonText: {
    fontWeight: '600',
    fontSize: 14,
    color: Colors.light.text,
  },
  singleCompleteButton: {
    backgroundColor: Colors.light.onlineGreen,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.onlineGreen,
  },
  singleCompleteButtonPressed: {
    backgroundColor: `${Colors.light.onlineGreen}60`,
    borderColor: `${Colors.light.onlineGreen}30`,
  },
  singleCompleteButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  chatContainer: {
    flex: 1,
  },
});