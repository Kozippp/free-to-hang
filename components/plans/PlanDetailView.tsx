import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  TextInput,
  Animated,
  Platform,
  Alert,
  Keyboard,
  Modal,
  Dimensions,
  RefreshControl
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
// import useChatStore from '@/store/chatStore';
import useUnseenStore from '@/store/unseenStore';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { plansService } from '@/lib/plans-service';

const noop = () => {};

interface PlanDetailViewProps {
  plan: Plan;
  onClose: () => void;
  onRespond: (planId: string, response: ParticipantStatus, conditionalFriends?: string[]) => Promise<void>;
  editedTitle?: string;
  onEditPermissionChange?: (canEdit: boolean) => void;
  initialTab?: string;
}

export default function PlanDetailView({ plan, onClose, onRespond, editedTitle, onEditPermissionChange, initialTab }: PlanDetailViewProps) {
  const { user } = useAuth();
  const { 
    voteOnPollOptimistic,
    invitations,
    activePlans,
    loadPlans,
    loadPlan,
    checkAndRestartSubscriptions
    // markPlanAsSeen // TODO: Enable when backend is ready
  } = usePlansStore();
  // const { getUnreadCount } = useChatStore();
  const { markControlPanelSeen, markChatSeen, plans: unseenPlans } = useUnseenStore();
  const router = useRouter();
  
  // Early return if user is not authenticated
  if (!user) {
    console.log('🔒 PlanDetailView: No user authenticated, returning null');
    return null;
  }
  
  // Get the latest plan data from store
  const latestPlan = [...invitations, ...activePlans].find(p => p.id === plan.id) || plan;
  
  const [activeTab, setActiveTab] = useState(initialTab || 'Control Panel');
  const [description, setDescription] = useState(plan.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [highlightNewPlan, setHighlightNewPlan] = useState(false);
  const displayTitle = editedTitle ?? plan.title;
  
  // Poll voting state - track loading per option (not per poll)
  // Key format: `${pollId}-${optionId}`
  const [votingInProgress, setVotingInProgress] = useState<Record<string, boolean>>({});
  const voteTimeoutRef = useRef<Record<string, NodeJS.Timeout | number>>({});
  // Track pending votes locally to handle rapid clicking/race conditions
  const pendingVotesRef = useRef<Record<string, string[]>>({});
  const cleanupTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Confirmation states removed
  // const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  // const [confirmationMessage, setConfirmationMessage] = useState('');
  // const [pendingResponse, setPendingResponse] = useState<{
  //   status: ParticipantStatus;
  //   conditionalFriends?: string[];
  // } | null>(null);
  
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
  const [isRefreshingPlan, setIsRefreshingPlan] = useState(false);
  const hasMarkedControlPanelRef = useRef(false);
  const previousActiveTabRef = useRef(activeTab);

  // Load fresh plan data on mount so polls are always visible when opening a plan.
  // [plan.id] dependency means it re-runs if a different plan is shown in the same component.
  React.useEffect(() => {
    if (!user?.id) return;
    setIsRefreshingPlan(true);
    loadPlan(plan.id, user.id)
      .catch(() => {})
      .finally(() => setIsRefreshingPlan(false));
  }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  
  // Decline animation states
  const [isClosing, setIsClosing] = useState(false);
  const declineAnimation = useRef(new Animated.Value(1)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  
  // Get current user's status from latest plan data
  const currentUser = latestPlan.participants.find(p => p.id === user.id);
  const currentUserStatus = currentUser?.status || 'pending';
  
  // Check edit permissions
  const isInYesGang = currentUserStatus === 'going';
  const isPlanCreator = latestPlan.creator?.id === 'current';
  const canEditPlan = isInYesGang || isPlanCreator;

  React.useEffect(() => {
    onEditPermissionChange?.(canEditPlan);
  }, [canEditPlan, latestPlan, onEditPermissionChange]);

  React.useEffect(() => {
    hasMarkedControlPanelRef.current = false;
  }, [plan.id]);

  React.useEffect(() => {
    if (activeTab === 'Control Panel' && !hasMarkedControlPanelRef.current) {
      hasMarkedControlPanelRef.current = true;
      void markControlPanelSeen(plan.id);
    } else if (activeTab === 'Chat') {
      markChatSeen(plan.id);
    }
  }, [activeTab, markControlPanelSeen, markChatSeen, plan.id]);

  React.useEffect(() => {
    const previousActiveTab = previousActiveTabRef.current;
    previousActiveTabRef.current = activeTab;

    if (!user?.id || previousActiveTab !== 'Chat' || activeTab !== 'Control Panel') {
      return;
    }

    setIsRefreshingPlan(true);

    Promise.allSettled([
      checkAndRestartSubscriptions(user.id, { force: true }),
      loadPlan(plan.id, user.id)
    ]).finally(() => {
      setIsRefreshingPlan(false);
    });
  }, [activeTab, checkAndRestartSubscriptions, loadPlan, plan.id, user?.id]);

  // Swipe gesture state
  const { width } = Dimensions.get('window');
  const translateX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView | null>(null);
  
  // Group participants by status
  const acceptedParticipants = latestPlan.participants.filter(p => p.status === 'going');
  const maybeParticipants = latestPlan.participants.filter(p =>
    p.status === 'maybe' || p.status === 'conditional'
  );
  const pendingParticipants = latestPlan.participants.filter(p => p.status === 'pending');
  const declinedParticipants = latestPlan.participants.filter(p => p.status === 'declined');
  
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
          // Animate smoothly to create swipe effect, then change tab
          Animated.timing(translateX, {
            toValue: -width * 0.3, // Animate to 30% of screen width
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            // Change tab after partial animation
            setActiveTab('Chat');
            // Animate the remaining distance smoothly
            Animated.timing(translateX, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start();
          });
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
          // Animate smoothly to create swipe effect, then change tab
          Animated.timing(translateX, {
            toValue: width * 0.3, // Animate to 30% of screen width
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            // Change tab after partial animation
            setActiveTab('Control Panel');
            // Animate the remaining distance smoothly
            Animated.timing(translateX, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start();
          });
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
  // For non-swipe transitions (like tapping tab buttons)
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      translateX.setValue(0);
    }, 350); // Delay to allow swipe animations to complete (300ms) plus buffer

    return () => clearTimeout(timeout);
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

  const handleManualRefresh = () => {
    if (!user?.id) return;
    setIsRefreshingPlan(true);
    loadPlan(latestPlan.id, user.id)
      .catch(() => {})
      .finally(() => setIsRefreshingPlan(false));
  };
  
  const handleDescriptionSave = () => {
    // In a real app, this would update the plan in the backend
    setEditingDescription(false);
    // Only people who are going can edit description
  };

  const handleBackgroundPress = () => {
    if (!editingDescription) {
      return;
    }

    Keyboard.dismiss();
    handleDescriptionSave();
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

      // Close modal immediately to provide instant feedback
      setShowInviteModal(false);

      // Directly invite users (no voting) - this returns the updated plan
      const updatedPlan = await plansService.inviteUsers(latestPlan.id, friendIds);

      console.log('✅ Users invited successfully, received updated plan');
      
      // Immediately reload the specific plan to show updated participant list
      // This ensures the UI is in sync with the backend
      console.log('🔄 Reloading plan data to show updated participants...');
      await loadPlan(latestPlan.id, user?.id);
      console.log('✅ Plan data reloaded successfully');
      
      Alert.alert(
        'Friends Invited!',
        `${friendIds.length} friend${friendIds.length > 1 ? 's have' : ' has'} been invited to the plan.`,
        [{ text: 'OK' }]
      );
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

    // Handle going, maybe, conditional responses - INSTANT UPDATE without modal
    try {
      await onRespond(plan.id, status, conditionalFriends);
    } catch (error) {
      console.error('Error changing status:', error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  // Helper function to get user votes for a poll
  const getUserVotesForPoll = (pollId: string): string[] => {
    // 1. Check pending local votes first (High Priority)
    // This ensures UI reflects immediate user action regardless of store state/glitches
    if (pendingVotesRef.current[pollId] !== undefined) {
      return pendingVotesRef.current[pollId];
    }

    // 2. Fallback to store data
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return [];

    const userVotes = poll.options
      .filter(option => option.votes.includes(user.id))
      .map(option => option.id);

    return userVotes;
  };
  
  // Helper function to get total votes for a poll
  const getTotalVotesForPoll = (pollId: string): number => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return 0;
    
    // Use prepared poll data to get accurate counts that include local optimistic updates
    const preparedPoll = preparePollForDisplay(poll);
    
    // Count unique voters from the prepared options
    const uniqueVoters = new Set<string>();
    preparedPoll.options.forEach(option => {
      // We need to look at the voters array which contains objects with IDs
      option.voters.forEach(voter => {
        uniqueVoters.add(voter.id);
      });
    });
    
    return uniqueVoters.size;
  };
  
  // Prepare poll data for display
  const preparePollForDisplay = (poll: Poll) => {
    // Get the authoritative user votes (local pending OR store)
    const currentUserVotes = getUserVotesForPoll(poll.id);

    return {
      ...poll,
      options: poll.options.map(option => {
        // Calculate effective votes by patching store data with local state
        let effectiveVoteIds = [...option.votes];
        const storeIncludesUser = effectiveVoteIds.includes(user.id);
        const localIncludesUser = currentUserVotes.includes(option.id);

        // Apply local override
        if (localIncludesUser && !storeIncludesUser) {
           effectiveVoteIds.push(user.id);
        } else if (!localIncludesUser && storeIncludesUser) {
           effectiveVoteIds = effectiveVoteIds.filter(id => id !== user.id);
        }

        return {
          ...option,
          votes: effectiveVoteIds.length,
          voters: effectiveVoteIds.map(voterId => {
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
        };
      })
    };
  };
  
  // Get unseen counts for this plan
  const planUnseen = unseenPlans[latestPlan.id] || { chat: 0, control: 0 };

  // Helper function to handle poll voting with multiple selections
  const handlePollVote = async (pollId: string, optionId: string) => {
    // Create unique key for this specific vote animation state if needed
    const voteKey = `${pollId}-${optionId}`;
    
    try {
      // Determine current votes: always use pending local state if available as base
      const currentVotes = pendingVotesRef.current[pollId] !== undefined 
        ? pendingVotesRef.current[pollId] 
        : getUserVotesForPoll(pollId); // This will fallback to store if no pending
      
      let newVotes: string[];

      if (currentVotes.includes(optionId)) {
        // Remove vote if already selected
        newVotes = currentVotes.filter(id => id !== optionId);
      } else {
        // Add vote if not selected
        newVotes = [...currentVotes, optionId];
      }
      
      // 1. Update local pending state immediately
      pendingVotesRef.current[pollId] = newVotes;
      
      // 2. Extend/Refresh cleanup timer
      // We keep the pending state active for a safety window (e.g. 3s) to bridge 
      // the gap between optimistic update -> realtime glitch -> final realtime update
      if (cleanupTimeoutRef.current[pollId]) {
        clearTimeout(cleanupTimeoutRef.current[pollId]);
      }
      
      cleanupTimeoutRef.current[pollId] = setTimeout(() => {
        delete pendingVotesRef.current[pollId];
        // Force re-render to switch to store source
        // We use setVotingInProgress as a trigger, though the value doesn't matter much
        setVotingInProgress(prev => ({ ...prev }));
      }, 3000);

      // 3. Optimistic update - update UI store immediately
      // This ensures other views (dashboard etc) get updated too
      console.log('🚀 Optimistic vote update:', { pollId, newVotes });
      voteOnPollOptimistic(plan.id, pollId, newVotes, user.id);

      // 4. Debounce the API call
      // Clear any existing timeout for this poll
      if (voteTimeoutRef.current[pollId]) {
        clearTimeout(voteTimeoutRef.current[pollId]);
      }
      
      // Set new timeout to send votes to server
      voteTimeoutRef.current[pollId] = setTimeout(async () => {
        try {
          console.log('🗳️ Voting on poll via edge function (debounced):', { pollId, newVotes });
          
          // Get the latest votes from ref to ensure we send the most recent state
          // (in case multiple clicks happened within the timeout)
          const finalVotes = pendingVotesRef.current[pollId] || newVotes;
          
          await plansService.voteOnPoll(plan.id, pollId, finalVotes);
          console.log('✅ Vote submitted successfully via edge function');
          
          // NOTE: We do NOT delete pendingVotesRef here anymore.
          // We rely on the cleanupTimeout to clear it after the safety window.
          // This prevents the UI from flickering back to an old Realtime state 
          // that might arrive shortly after this call.
          
        } catch (error: any) {
          console.error('❌ Error submitting votes:', error);
          
          // Clear pending state so UI shows the error state (reverted)
          delete pendingVotesRef.current[pollId];
          
          // Force UI update to remove optimistic state
          setVotingInProgress(prev => ({ ...prev }));

          // Revert optimistic update by reloading plans (safely)
          console.log('🔄 Reverting optimistic update due to error');
          loadPlans(user.id).catch(err => console.log('Silent loadPlans fail:', err));
          
          let errorMessage = 'Failed to submit vote. Please try again.';
          let errorTitle = 'Error Voting';

          // Robust error handling for network issues
          const msg = error?.message || (typeof error === 'string' ? error : '');
          
          if (msg.includes('Authentication')) {
            errorMessage = 'Your session has expired. Please sign out and sign back in.';
          } else if (msg.includes('403')) {
            errorMessage = 'You need to respond "Going" to the plan to vote on polls.';
          } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
            errorTitle = 'No Internet Connection';
            errorMessage = 'Your vote could not be saved because the internet connection was lost. Please check your connection and try again.';
          } else if (msg) {
            errorMessage = msg;
          }

          Alert.alert(
            errorTitle,
            errorMessage,
            [{ text: 'OK', style: 'default' }]
          );
        }
      }, 500); // 500ms debounce delay
      
    } catch (error) {
      console.error('❌ Error processing vote:', error);
      // If something fails locally, try to reload
      loadPlans(user.id);
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
    <TouchableWithoutFeedback 
      onPress={handleBackgroundPress} 
      accessible={false}
      disabled={!editingDescription}
    >
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
        controlBadge={planUnseen.control}
        chatBadge={planUnseen.chat}
      />
      
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetX={activeTab === 'Chat' ? [-10, 10000] : undefined}
        simultaneousHandlers={scrollViewRef}
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
              ref={scrollViewRef}
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingPlan}
                  onRefresh={handleManualRefresh}
                  tintColor={Colors.light.primary}
                  colors={[Colors.light.primary]}
                />
              }
            >
          {/* Description Section - Title moved to modal header */}
          <PlanTitle 
            title={displayTitle}
            description={description}
            isEditingTitle={false}
            isEditingDescription={editingDescription}
            onEditTitle={noop}
            onEditDescription={() => canEditPlan && setEditingDescription(true)}
            onSaveTitle={noop}
            onSaveDescription={handleDescriptionSave}
            onChangeTitle={noop}
            onChangeDescription={setDescription}
            canEdit={canEditPlan}
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
                    loadingText="Updating poll..."
                    votingInProgress={votingInProgress}
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
                    loadingText="Updating poll..."
                    votingInProgress={votingInProgress}
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
                    votingInProgress={votingInProgress}
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
            declinedParticipants={declinedParticipants}
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
            <View style={styles.chatContainer}>
              <ChatView
                plan={latestPlan}
                currentUserId={user.id}
              />
            </View>
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
      </View>
    </TouchableWithoutFeedback>
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