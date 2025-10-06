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
  KeyboardAvoidingView,
  Modal,
  Dimensions
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
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
  UserPlus,
  Users,
  X
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan, ParticipantStatus, Poll } from '@/store/plansStore';
import PlanTabs from './PlanTabs';
import PlanTitle from './PlanTitle';
import PlanParticipants from './PlanParticipants';
import PlanUserStatus from './PlanUserStatus';
import InviteFriendsModal from './InviteFriendsModal';
import PollCreator from './PollCreator';
import PollVoting from './PollVoting';
import PollDisplay from './PollDisplay';
import ChatView from '../chat/ChatView';
import usePlansStore from '@/store/plansStore';
import useChatStore from '@/store/chatStore';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { plansService } from '@/lib/plans-service';
import { supabase } from '@/lib/supabase';

interface PlanDetailViewProps {
  plan: Plan;
  onClose: () => void;
  onRespond: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => Promise<void>;
}

export default function PlanDetailView({ plan, onClose, onRespond }: PlanDetailViewProps) {
  const { user } = useAuth();
  const { 
    markAsRead, 
    addPoll, 
    voteOnPoll, 
    voteOnPollOptimistic,
    updatePollOption, 
    removePollOption, 
    addPollOption, 
    deletePoll,
    invitations,
    activePlans,
    loadPlans
    // markPlanAsSeen // TODO: Enable when backend is ready
  } = usePlansStore();
  const { getUnreadCount } = useChatStore();
  const router = useRouter();
  
  // Early return if user is not authenticated
  if (!user) {
    console.log('🔒 PlanDetailView: No user authenticated, returning null');
    return null;
  }
  
  // Get the latest plan data from store
  const latestPlan = [...invitations, ...activePlans].find(p => p.id === plan.id) || plan;
  
  const [activeTab, setActiveTab] = useState('Control Panel');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [highlightNewPlan, setHighlightNewPlan] = useState(false);
  
  // Response confirmation states
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [pendingResponse, setPendingResponse] = useState<{
    status: ParticipantStatus;
    conditionalFriends?: string[];
  } | null>(null);
  
  // Poll states
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showPollVoting, setShowPollVoting] = useState(false);
  const [currentPollId, setCurrentPollId] = useState<string | null>(null);
  const [pollType, setPollType] = useState<'when' | 'where' | 'custom'>('custom');
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [realTimeUpdates, setRealTimeUpdates] = useState<Set<string>>(new Set());
  const [isPollLoading, setIsPollLoading] = useState(false);
  const [loadingPollId, setLoadingPollId] = useState<string | null>(null);
  const [deletingPollId, setDeletingPollId] = useState<string | null>(null);

  
  // Decline animation states
  const [isClosing, setIsClosing] = useState(false);
  const declineAnimation = useRef(new Animated.Value(1)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  
  // Get current user's status from latest plan data
  const currentUser = latestPlan.participants.find(p => p.id === user.id);
  const currentUserStatus = currentUser?.status || 'pending';
  
  // Check if user is going
  const isInYesGang = currentUserStatus === 'going';
  
  // Swipe gesture state
  const { width } = Dimensions.get('window');
  const translateX = useRef(new Animated.Value(0)).current;
  
  // Group participants by status
  const acceptedParticipants = latestPlan.participants.filter(p => p.status === 'going');
  const maybeParticipants = latestPlan.participants.filter(p =>
    p.status === 'maybe' || p.status === 'conditional'
  );
  const pendingParticipants = latestPlan.participants.filter(p => p.status === 'pending');
  
  // Get polls from the plan
  const polls = latestPlan.polls || [];
  const whenPoll = polls.find(poll => poll.type === 'when');
  const wherePoll = polls.find(poll => poll.type === 'where');
  const customPolls = polls.filter(poll => poll.type === 'custom');
  
  // Animation for highlighting new plan
  const highlightAnim = useRef(new Animated.Value(0)).current;
  
  // Gesture handlers for swipe navigation
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { 
      useNativeDriver: true,
      listener: (event: any) => {
        const tx = event.nativeEvent.translationX;
        
        // Control Panel: allow both directions (left to exit, right to chat)
        if (activeTab === 'Control Panel') {
          // Allow natural swipe in both directions
          return;
        } 
        // Chat: only allow left to right swipe (back to Control Panel)
        else if (activeTab === 'Chat') {
          // Only allow positive translation (left to right)
          // Block any right to left movement
          if (tx < 0) {
            event.nativeEvent.translationX = 0;
            translateX.setValue(0);
          }
        }
      }
    }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX: tx, velocityX } = event.nativeEvent;
      
      if (activeTab === 'Control Panel') {
        // Control Panel: swipe left to right exits, swipe right to left goes to Chat
        if (tx > 100 || velocityX > 500) {
          // Swipe left to right (or fast velocity) - exit/close
          Animated.timing(translateX, {
            toValue: width,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else if (tx < -100 || velocityX < -500) {
          // Swipe right to left (or fast velocity) - go to Chat
          translateX.setValue(0);
          setActiveTab('Chat');
        } else {
          // Not far enough - reset
          Animated.spring(translateX, {
            toValue: 0,
            velocity: velocityX,
            tension: 68,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      } else if (activeTab === 'Chat') {
        // Chat: ONLY swipe left to right goes back to Control Panel
        if (tx > 100 || velocityX > 500) {
          // Swipe left to right (or fast velocity) - back to Control Panel
          translateX.setValue(0);
          setActiveTab('Control Panel');
        } else {
          // Not far enough or wrong direction - reset
          Animated.spring(translateX, {
            toValue: 0,
            velocity: velocityX,
            tension: 68,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      }
    }
  };
  
  // Reset translateX when tab changes to prevent visual glitches
  React.useEffect(() => {
    translateX.setValue(0);
  }, [activeTab]);
  
  // Mark plan as seen when first opened (if user is pending)
  React.useEffect(() => {
    // TODO: Add mark as seen functionality when database schema allows
    // if (currentUserStatus === 'pending') {
    //   markPlanAsSeen(plan.id).catch(console.error);
    // }
  }, [plan.id, currentUserStatus]);

  // Track real-time updates for animation
  React.useEffect(() => {
    const pollIds = polls.map(poll => poll.id);
    const newRealTimeUpdates = new Set<string>();
    
    // Add poll IDs to real-time updates set
    pollIds.forEach(pollId => {
      newRealTimeUpdates.add(pollId);
    });
    
    setRealTimeUpdates(newRealTimeUpdates);
    
    // Clear real-time update flags after animation
    const timeout = setTimeout(() => {
      setRealTimeUpdates(new Set());
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [polls]);
  
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
  
  const handlePollSubmit = async (question: string, options: string[]) => {
    try {
      console.log('🚀 Starting poll submit, setting loading for poll:', editingPoll?.id);
      setLoadingPollId(editingPoll?.id || null);

      // Check if user is authenticated
      if (!user) {
        Alert.alert(
          'Authentication Required',
          'You need to be signed in to create polls. Please sign in and try again.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      if (editingPoll) {
        // Update existing poll using API
        console.log('✏️ Updating poll via API:', editingPoll.id);
        console.log('👤 User ID:', user.id);

        const pollData = {
          question,
          options
        };

        // Use plansService to update poll via API
        const updatedPlan = await plansService.editPoll(latestPlan.id, editingPoll.id, question, options);
        console.log('✅ Poll updated successfully via API:', updatedPlan);

        // Manually reload plans to ensure UI updates immediately
        // Real-time subscription should also handle this, but this ensures immediate feedback
        await loadPlans(user.id);
      } else {
        // Create a new poll using API
        console.log('📊 Creating poll via API:', { question, options, type: pollType });
        console.log('👤 User ID:', user.id);

        const pollData = {
          question,
          options,
          type: pollType
        };

        // Use plansService to create poll via API
        const updatedPlan = await plansService.createPoll(latestPlan.id, pollData);
        console.log('✅ Poll created successfully via API:', updatedPlan);

        // Manually reload plans to ensure UI updates immediately
        // Real-time subscription should also handle this, but this ensures immediate feedback
        await loadPlans(user.id);
      }

      // Close the poll creator and reset state
      console.log('✅ Poll submit successful, clearing loading');
      setShowPollCreator(false);
      setEditingPoll(null);
      setLoadingPollId(null);
    } catch (error) {
      console.error('❌ Error creating poll:', error);
      console.log('❌ Poll submit failed, clearing loading');
      setLoadingPollId(null);

      let errorMessage = 'Failed to create poll. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          errorMessage = 'Your session has expired. Please sign out and sign back in.';
        } else if (error.message.includes('403')) {
          errorMessage = 'You need to respond "Going" to the plan to create polls.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert(
        'Error Creating Poll',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };
  
  const handleOpenVoting = (pollId: string) => {
    setCurrentPollId(pollId);
    setShowPollVoting(true);
  };
  
  const handleVoteSubmit = async (selectedOptionIds: string[]) => {
    if (!currentPollId) return;
    
    try {
      // Submit votes via API
      console.log('🗳️ Submitting votes via API:', { pollId: currentPollId, selectedOptionIds });
      await plansService.voteOnPoll(plan.id, currentPollId, selectedOptionIds);
      console.log('✅ Votes submitted successfully via API');
      
      // Manually reload plans to ensure UI updates immediately
      console.log('🔄 Reloading plans after vote submit...');
      await loadPlans(user.id);
      console.log('✅ Plans reloaded after vote submit');
      
      // Close voting modal
      setShowPollVoting(false);
      setCurrentPollId(null);
    } catch (error) {
      console.error('❌ Error submitting votes:', error);
      
      let errorMessage = 'Failed to submit votes. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          errorMessage = 'Your session has expired. Please sign out and sign back in.';
        } else if (error.message.includes('403')) {
          errorMessage = 'You need to respond "Going" to the plan to vote on polls.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Error Voting',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };
  
  const handleInviteFriends = () => {
    setShowInviteModal(true);
  };

  const handleInviteUsers = async (friendIds: string[], friendNames: string[]) => {
    try {
      console.log('👥 Inviting users directly:', { friendIds, friendNames });

      // Directly invite users (no voting)
      await plansService.inviteUsers(latestPlan.id, friendIds);

      console.log('✅ Users invited successfully');
      
      Alert.alert(
        'Friends Invited!',
        `${friendIds.length} friend${friendIds.length > 1 ? 's have' : ' has'} been invited to the plan.`,
        [{ text: 'OK' }]
      );
      
      setShowInviteModal(false);

      // Real-time subscription will handle updating the store
    } catch (error) {
      console.error('❌ Error inviting users:', error);

      let errorMessage = 'Failed to invite users. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          errorMessage = 'Your session has expired. Please sign out and sign back in.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Only going participants can invite others.';
        } else if (error.message.includes('400')) {
          errorMessage = 'Some selected users are already in the plan.';
        }
      }

      Alert.alert(
        'Error Inviting Users',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };
  
  const handleStatusChange = async (status: ParticipantStatus, conditionalFriends?: string[]) => {
    // Always close any existing confirmation modal first
    setShowConfirmationModal(false);
    setPendingResponse(null);

    // Check if this is a first-time response (user is currently pending)
    const isFirstTimeResponse = currentUserStatus === 'pending';
    
    // If changing from 'going' to 'maybe', 'conditional', or 'declined', remove all votes first
    if (currentUserStatus === 'going' && (status === 'maybe' || status === 'conditional' || status === 'declined')) {
      // Remove user votes from all polls using API calls
      const voteRemovalPromises = polls.map(async (poll) => {
        const userVotes = getUserVotesForPoll(poll.id);
        if (userVotes.length > 0) {
          try {
            console.log('🗳️ Removing votes from poll:', poll.id, 'for user:', user.id);
            await plansService.voteOnPoll(plan.id, poll.id, []);
            console.log('✅ Votes removed successfully from poll:', poll.id);
          } catch (error) {
            console.error('❌ Error removing votes from poll:', poll.id, error);
          }
        }
      });

      // Wait for all vote removals to complete
      await Promise.all(voteRemovalPromises);
    }

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
      ]).start(async () => {
        // After animation, actually decline and close
        try {
          await onRespond(plan.id, status, conditionalFriends);
        } catch (error) {
          console.error('Error declining plan:', error);
        }
        
        // Small delay to show the effect, then close
        setTimeout(() => {
          onClose();
        }, 200);
      });
      return; // Exit early for decline
    }

    // Handle going, maybe, conditional responses
    if (status === 'going' || status === 'maybe' || status === 'conditional') {
      if (isFirstTimeResponse) {
        // FIRST-TIME RESPONSE: Show confirmation modal and navigate to Plans tab
        setPendingResponse({ status, conditionalFriends });

        // Set the status text for display
        let statusText = '';
        switch (status) {
          case 'going':
            statusText = 'Going';
            break;
          case 'maybe':
            statusText = 'Maybe';
            break;
          case 'conditional':
            statusText = 'If';
            break;
        }

        setConfirmationMessage(statusText);
        setShowConfirmationModal(true);
      } else {
        // STATUS CHANGE: Apply immediately without any alerts
        try {
          await onRespond(plan.id, status, conditionalFriends);
        } catch (error) {
          console.error('Error changing status:', error);
          Alert.alert('Error', 'Failed to update status. Please try again.');
        }
      }
    } else {
      // For all other status changes, pass through directly
      try {
        await onRespond(plan.id, status, conditionalFriends);
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
    }
  };
  
  // Handle confirmation modal completion
  const handleConfirmationComplete = async () => {
    if (pendingResponse) {
      try {
        // Apply the response
        await onRespond(plan.id, pendingResponse.status, pendingResponse.conditionalFriends);
        
        // Close confirmation modal
        setShowConfirmationModal(false);
        setPendingResponse(null);
        
        // Close the plan detail modal
        onClose();
        
        // Navigate to Plans tab with highlighting parameter
        router.replace({
          pathname: '/plans',
          params: { highlightPlan: plan.id }
        });
      } catch (error) {
        console.error('Error confirming response:', error);
        Alert.alert('Error', 'Failed to update status. Please try again.');
        
        // Don't close modal on error
        setShowConfirmationModal(false);
        setPendingResponse(null);
      }
    }
  };
  
  // Helper function to get user votes for a poll
  const getUserVotesForPoll = (pollId: string): string[] => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return [];

    const userVotes = poll.options
      .filter(option => option.votes.includes(user.id))
      .map(option => option.id);

    //console.log('🔍 getUserVotesForPoll:', { pollId, userVotes, userId: user.id, pollOptions: poll.options.map(o => ({ id: o.id, votes: o.votes })) });

    return userVotes;
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
  const unreadCount = getUnreadCount(latestPlan.id, user.id);

  // Helper function to handle poll voting with multiple selections
  const handlePollVote = async (pollId: string, optionId: string) => {
    try {
      const currentVotes = getUserVotesForPoll(pollId);
      let newVotes: string[];

      if (currentVotes.includes(optionId)) {
        // Remove vote if already selected
        newVotes = currentVotes.filter(id => id !== optionId);
      } else {
        // Add vote if not selected
        newVotes = [...currentVotes, optionId];
      }

      // Optimistic update - update UI immediately
      console.log('🚀 Optimistic vote update:', { pollId, newVotes });
      voteOnPollOptimistic(plan.id, pollId, newVotes, user.id);

      // Use API to vote on poll
      console.log('🗳️ Voting on poll via API:', { pollId, newVotes });
      await plansService.voteOnPoll(plan.id, pollId, newVotes);
      console.log('✅ Vote submitted successfully via API');

      // Real-time subscription will handle updating the store
      // No need to manually reload plans
    } catch (error) {
      console.error('❌ Error voting on poll:', error);

      // Revert optimistic update on error
      console.log('🔄 Reverting optimistic update due to error');
      await loadPlans(user.id);

      let errorMessage = 'Failed to submit vote. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          errorMessage = 'Your session has expired. Please sign out and sign back in.';
        } else if (error.message.includes('403')) {
          errorMessage = 'You need to respond "Going" to the plan to vote on polls.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert(
        'Error Voting',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };


  // Helper function to handle poll deletion
  const handleDeletePoll = async (pollId: string) => {
    try {
      // Set loading state for deletion
      console.log('🗑️ Starting poll deletion:', pollId);
      setDeletingPollId(pollId);

      console.log('🗑️ Deleting poll via API:', pollId);
      await plansService.deletePoll(plan.id, pollId);
      console.log('✅ Poll deleted successfully via API');

      // Manually reload plans to ensure UI updates immediately
      console.log('🔄 Reloading plans after poll deletion...');
      await loadPlans(user.id);
      console.log('✅ Plans reloaded after poll deletion');
    } catch (error) {
      console.error('❌ Error deleting poll:', error);

      let errorMessage = 'Failed to delete poll. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          errorMessage = 'Your session has expired. Please sign out and sign back in.';
        } else if (error.message.includes('403')) {
          errorMessage = 'You need to respond "Going" to the plan to delete polls.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert(
        'Error Deleting Poll',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      // Clear loading state
      setDeletingPollId(null);
    }
  };

  // Manual completion voting removed; plans auto-complete after 24h

  return (
    <View style={styles.container}>
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
      
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetX={activeTab === 'Chat' ? [-10000, -10] : undefined}
      >
        <Animated.View 
          style={[
            styles.contentWrapper,
            { 
              backgroundColor: highlightBackground,
              transform: [
                { scale: declineAnimation },
                { translateY: slideAnimation },
                { translateX: translateX }
              ],
              opacity: fadeAnimation
            }
          ]}
        >
          {activeTab === 'Control Panel' && (
            <ScrollView 
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
            >
          {/* Description Section - Title moved to modal header */}
          <PlanTitle 
            title={title}
            description={description}
            isEditingTitle={editingTitle}
            isEditingDescription={editingDescription}
            onEditTitle={() => isInYesGang && setEditingTitle(true)}
            onEditDescription={() => isInYesGang && setEditingDescription(true)}
            onSaveTitle={handleTitleSave}
            onSaveDescription={handleDescriptionSave}
            onChangeTitle={setTitle}
            onChangeDescription={setDescription}
            canEdit={isInYesGang}
            hideTitle={true}
          />
          
          {/* Combined Voting Section */}
          {(isInYesGang || whenPoll || wherePoll || customPolls.length > 0) && (
            <View style={styles.section}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Voting & Decisions</Text>
              </View>
              
              {/* When Poll */}
              {whenPoll ? (
                <View style={styles.pollContainer}>
                  <View style={styles.pollHeader}>
                    <Clock size={18} color={Colors.light.text} style={styles.pollIcon} />
                    <Text style={styles.pollTitle}>What time works best?</Text>
                  </View>
                  <PollDisplay
                    pollId={whenPoll.id}
                    question={whenPoll.question}
                    options={preparePollForDisplay(whenPoll).options}
                    onVote={(optionId) => handlePollVote(whenPoll.id, optionId)}
                    userVotes={getUserVotesForPoll(whenPoll.id)}
                    totalVotes={getTotalVotesForPoll(whenPoll.id)}
                    canVote={isInYesGang}
                    onEdit={() => handleCreatePoll('when', whenPoll)}
                    totalGoingParticipants={acceptedParticipants.length}
                    hideQuestion={true}
                    isRealTimeUpdate={realTimeUpdates.has(whenPoll.id)}
                    isLoading={loadingPollId === whenPoll.id}
                  />
                </View>
              ) : isInYesGang ? (
                <View style={styles.pollContainer}>
                  <View style={styles.pollHeader}>
                    <Clock size={18} color={Colors.light.text} style={styles.pollIcon} />
                    <Text style={styles.pollTitle}>What time works best?</Text>
                  </View>
                  <View style={styles.emptyPollContainer}>
                    <Text style={styles.emptyPollText}>No time has been set yet</Text>
                    <TouchableOpacity 
                      style={styles.createPollButton}
                      onPress={() => handleCreatePoll('when')}
                    >
                      <Text style={styles.createPollButtonText}>Suggest a time</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              
              {/* Where Poll */}
              {wherePoll ? (
                <View style={styles.pollContainer}>
                  <View style={styles.pollHeader}>
                    <MapPin size={18} color={Colors.light.text} style={styles.pollIcon} />
                    <Text style={styles.pollTitle}>Where should we meet?</Text>
                  </View>
                  <PollDisplay
                    pollId={wherePoll.id}
                    question={wherePoll.question}
                    options={preparePollForDisplay(wherePoll).options}
                    onVote={(optionId) => handlePollVote(wherePoll.id, optionId)}
                    userVotes={getUserVotesForPoll(wherePoll.id)}
                    totalVotes={getTotalVotesForPoll(wherePoll.id)}
                    canVote={isInYesGang}
                    onEdit={() => handleCreatePoll('where', wherePoll)}
                    totalGoingParticipants={acceptedParticipants.length}
                    hideQuestion={true}
                    isRealTimeUpdate={realTimeUpdates.has(wherePoll.id)}
                    isLoading={loadingPollId === wherePoll.id}
                  />
                </View>
              ) : isInYesGang ? (
                <View style={styles.pollContainer}>
                  <View style={styles.pollHeader}>
                    <MapPin size={18} color={Colors.light.text} style={styles.pollIcon} />
                    <Text style={styles.pollTitle}>Where should we meet?</Text>
                  </View>
                  <View style={styles.emptyPollContainer}>
                    <Text style={styles.emptyPollText}>No location has been set yet</Text>
                    <TouchableOpacity 
                      style={styles.createPollButton}
                      onPress={() => handleCreatePoll('where')}
                    >
                      <Text style={styles.createPollButtonText}>Suggest a location</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              
              {/* Custom Polls */}
              {customPolls.map((poll) => (
                <View key={poll.id} style={styles.pollContainer}>
                  <PollDisplay
                    pollId={poll.id}
                    question={poll.question}
                    options={preparePollForDisplay(poll).options}
                    onVote={(optionId) => handlePollVote(poll.id, optionId)}
                    userVotes={getUserVotesForPoll(poll.id)}
                    totalVotes={getTotalVotesForPoll(poll.id)}
                    canVote={isInYesGang}
                    onEdit={() => handleCreatePoll('custom', poll)}
                    totalGoingParticipants={acceptedParticipants.length}
                    onDelete={() => handleDeletePoll(poll.id)}
                    isRealTimeUpdate={realTimeUpdates.has(poll.id)}
                    isLoading={loadingPollId === poll.id || deletingPollId === poll.id}
                    loadingText={deletingPollId === poll.id ? "Deleting poll..." : "Updating poll..."}
                  />
                </View>
              ))}
              
              {/* Create Poll Button */}
              {isInYesGang && (
                <View style={styles.pollContainer}>
                  <Text style={styles.createPollSectionTitle}>Need to decide something else?</Text>
                  <TouchableOpacity 
                    style={styles.createPollButton}
                    onPress={() => handleCreatePoll('custom')}
                  >
                    <Text style={styles.createPollButtonText}>Create a poll</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Message for non-going users when no polls exist */}
              {!isInYesGang && !whenPoll && !wherePoll && customPolls.length === 0 && (
                <View style={styles.notSetContainer}>
                  <Text style={styles.notSetText}>Time and location haven't been decided yet</Text>
                  <Text style={styles.notSetSubtext}>Put "Going" to be the first one to suggest when and where to meet!</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Participants Section with Invitations */}
          <PlanParticipants
            acceptedParticipants={acceptedParticipants}
            maybeParticipants={maybeParticipants}
            pendingParticipants={pendingParticipants}
            onInvite={handleInviteFriends}
            canInvite={isInYesGang}
            isInYesGang={isInYesGang}
          />
          
          {/* Manual plan completion voting removed; plans auto-complete after 24h */}
          
          {/* User Status Section */}
          <PlanUserStatus
            currentStatus={currentUserStatus}
            onStatusChange={handleStatusChange}
            participants={latestPlan.participants}
            currentUserId={user.id}
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
                currentUserId={user.id}
                disableKeyboardAvoidance={true}
              />
            </KeyboardAvoidingView>
          )}
        </Animated.View>
      </PanGestureHandler>
      
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
          pollId={currentPollId || ''}
          options={(() => {
            const poll = polls.find(p => p.id === currentPollId);
            if (!poll) return [];
            return preparePollForDisplay(poll).options;
          })()}
          onVote={handleVoteSubmit}
          userVotes={getUserVotesForPoll(currentPollId)}
          currentUserId={user.id}
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
        onCreateInvitationPoll={handleInviteUsers}
        plan={latestPlan}
      />
      
      {/* Response Confirmation Modal */}
      <Modal
        visible={showConfirmationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleConfirmationComplete}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationModal}>
            <Check size={36} color={Colors.light.onlineGreen} style={styles.confirmationIcon} />
            <Text style={styles.confirmationTitle}>Your status is set to</Text>
            <Text style={styles.confirmationStatus}>{confirmationMessage}</Text>
            <Text style={styles.confirmationSubtext}>You can find this plan in the Plans tab.</Text>
            <TouchableOpacity
              style={styles.confirmationButton}
              onPress={handleConfirmationComplete}
            >
              <Text style={styles.confirmationButtonText}>Go to Plans</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 0,
  },
  section: {
    marginBottom: 16,
    backgroundColor: Colors.light.background,
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
  
  chatContainer: {
    flex: 1,
  },
  pollContainer: {
    marginBottom: 16,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pollIcon: {
    marginRight: 8,
  },
  pollTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  createPollSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  confirmationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModal: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmationIcon: {
    marginBottom: 12,
  },
  confirmationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
    marginBottom: 4,
    textAlign: 'center',
  },
  confirmationStatus: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmationButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  confirmationButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});