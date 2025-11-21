import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { 
  Clock, 
  MapPin, 
  Users,
  X,
  Calendar,
  RotateCcw,
  UserPlus,
  Check,
  Eye
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan, Poll, Participant } from '@/store/plansStore';
import PlanTabs from './PlanTabs';
import ChatView from '../chat/ChatView';
import PlanSuggestionSheet from './PlanSuggestionSheet';
import PollDisplay from './PollDisplay';
import useChatStore from '@/store/chatStore';
import useHangStore from '@/store/hangStore';
import usePlansStore from '@/store/plansStore';
import { useAuth } from '@/contexts/AuthContext';

interface CompletedPlanDetailViewProps {
  plan: Plan;
  onClose: () => void;
  onAttendanceUpdate?: (planId: string, userId: string, attended: boolean) => void;
}

type FriendSelection = {
  id: string;
  name: string;
  avatar: string;
  status: 'available' | 'offline' | 'pinged';
  activity?: string;
  lastActive?: string;
  lastSeen?: string;
};

const DEFAULT_AVATAR_URI = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
const noop = () => {};

export default function CompletedPlanDetailView({ plan, onClose, onAttendanceUpdate }: CompletedPlanDetailViewProps) {
  const { getUnreadCount } = useChatStore();
  const { user: hangUser, friends } = useHangStore();
  const { user: authUser } = useAuth();
  const { completedPlans } = usePlansStore();
  const [activeTab, setActiveTab] = useState('Details');
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [isAnonymousPlan, setIsAnonymousPlan] = useState(false);

  if (!authUser) {
    console.log('🔒 CompletedPlanDetailView: No authenticated user found, returning null');
    return null;
  }
  
  // Get the latest plan data from store to reflect attendance updates
  const latestPlan = completedPlans.find(p => p.id === plan.id) || plan;
  
  // Group participants by status
  const acceptedParticipants = latestPlan.participants.filter(p => p.status === 'going');
  const maybeParticipants = latestPlan.participants.filter(p => 
    p.status === 'maybe' || p.status === 'conditional'
  );
  const pendingParticipants = latestPlan.participants.filter(p => p.status === 'pending');
  const declinedParticipants = latestPlan.participants.filter(p => p.status === 'declined');
  const attendedParticipants = acceptedParticipants;
  const interestedParticipants = maybeParticipants;
  const didntRespondParticipants = pendingParticipants;
  const didNotAttendParticipants = declinedParticipants;
  const hasAttendanceData = [
    attendedParticipants.length,
    interestedParticipants.length,
    didntRespondParticipants.length,
    didNotAttendParticipants.length
  ].some(count => count > 0);
  
  // Get final poll results
  const polls = latestPlan.polls || [];
  const whenPoll = polls.find(poll => poll.type === 'when');
  const wherePoll = polls.find(poll => poll.type === 'where');
  const customPolls = polls.filter(poll => poll.type === 'custom');
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };
  
  // Format plan date for footer
  const formatPlanDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };
  
  const planDateLabel = formatPlanDate(latestPlan.date || latestPlan.createdAt);
  
  // Get unread message count for this plan
  const unreadCount = getUnreadCount(latestPlan.id, 'current');

  // Plan creation handlers
  const handleOpenPlanBuilder = (anonymous: boolean = false) => {
    setTimeout(() => {
      setIsAnonymousPlan(anonymous);
      setShowPlanSheet(true);
    }, 0);
  };
  
  const handleClosePlanSheet = () => {
    setTimeout(() => {
      setShowPlanSheet(false);
      setIsAnonymousPlan(false);
    }, 0);
  };

  const handlePlanSubmitted = () => {
    setTimeout(() => {
      handleClosePlanSheet();
      // Optionally close the detail view and navigate to the new plan
      onClose();
    }, 0);
  };

  // Convert plan participants to the format expected by PlanSuggestionSheet
  const getSelectedFriendsData = useCallback((): FriendSelection[] => {
    const currentUserId = hangUser?.id;

    return latestPlan.participants
      .filter((participant) => {
        if (participant.id === 'current') {
          return false;
        }

        if (currentUserId && participant.id === currentUserId) {
          return false;
        }

        return true;
      })
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        avatar: participant.avatar || '',
        status: 'available' as const,
        activity: '',
        lastActive: '',
        lastSeen: ''
      }));
  }, [latestPlan, hangUser?.id]);

  const [recreatedPlanFriends, setRecreatedPlanFriends] = useState<FriendSelection[]>(() => getSelectedFriendsData());

  useEffect(() => {
    setRecreatedPlanFriends(getSelectedFriendsData());
  }, [getSelectedFriendsData]);

  const availableFriendsForModal = useMemo(() => {
    const selectedIds = new Set(recreatedPlanFriends.map(friend => friend.id));
    const safeFriends = friends || [];

    return safeFriends
      .filter(friend => !selectedIds.has(friend.id))
      .map(friend => ({
        id: friend.id,
        name: friend.name,
        avatar: friend.avatar,
        status: friend.status,
        activity: friend.activity,
        lastActive: friend.lastActive,
        lastSeen: friend.lastSeen
      }));
  }, [friends, recreatedPlanFriends]);

  const handleFriendsUpdated = useCallback((updatedFriends: FriendSelection[]) => {
    setRecreatedPlanFriends(updatedFriends);
  }, []);

  const handleAddMoreFriends = useCallback(() => {
    // No-op handler to display the Add More button.
    // The actual friend list updates are handled via onFriendsUpdated.
  }, []);

  // Helper function to get total unique voters for a poll
  const getTotalVotesForPoll = (poll?: Poll) => {
    if (!poll) return 0;

    const uniqueVoters = new Set<string>();
    poll.options.forEach(option => {
      option.votes.forEach(voterId => uniqueVoters.add(voterId));
    });

    return uniqueVoters.size;
  };

  const preparePollForDisplay = (poll: Poll) => ({
    ...poll,
    options: poll.options.map(option => ({
      ...option,
      votes: option.votes.length,
      voters: option.votes.map(voterId => {
        const participant = latestPlan.participants.find(p => p.id === voterId);
        return participant ? {
          id: participant.id,
          name: participant.name,
          avatar: participant.avatar || DEFAULT_AVATAR_URI
        } : {
          id: voterId,
          name: `User ${voterId}`,
          avatar: DEFAULT_AVATAR_URI
        };
      })
    }))
  });

  const renderAttendanceParticipant = (participant: Participant) => {
    const avatarUri = participant.avatar || DEFAULT_AVATAR_URI;
    return (
      <View key={`${participant.id}-${participant.status}`} style={styles.participantRow}>
        <View style={styles.participantInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <View style={[
              styles.statusIndicator,
              participant.status === 'going' && styles.acceptedIndicator,
              participant.status === 'maybe' && styles.maybeIndicator,
              participant.status === 'conditional' && styles.conditionalIndicator,
              participant.status === 'pending' && styles.pendingIndicator,
              participant.status === 'declined' && styles.declinedIndicator,
            ]}>
              {participant.status === 'going' && (
                <Check size={10} color="white" />
              )}
              {participant.status === 'maybe' && (
                <Text style={styles.questionMark}>?</Text>
              )}
              {participant.status === 'conditional' && (
                <Eye size={10} color="white" />
              )}
              {participant.status === 'pending' && (
                <View style={styles.eyeIcon}>
                  <View style={styles.eyePupil} />
                </View>
              )}
              {participant.status === 'declined' && (
                <X size={10} color="white" />
              )}
            </View>
          </View>
          <Text style={styles.participantName}>
            {participant.id === 'current' ? 'You' : participant.name}
          </Text>
        </View>
      </View>
    );
  };

  const renderAttendanceGroup = (title: string, participants: Participant[]) => {
    if (!participants.length) {
      return null;
    }

    return (
      <View key={title} style={styles.participantGroup}>
        <Text style={styles.groupTitle}>
          {title} ({participants.length})
        </Text>
        {participants.map(renderAttendanceParticipant)}
      </View>
    );
  };

  const renderCompletedPoll = (
    poll: Poll,
    config?: {
      title?: string;
      icon?: React.ReactNode;
      hideQuestion?: boolean;
    }
  ) => (
    <View key={poll.id} style={styles.pollContainer}>
      {config?.title && (
        <View style={styles.pollHeader}>
          {config.icon}
          <Text style={styles.pollTitle}>{config.title}</Text>
        </View>
      )}
      <PollDisplay
        pollId={poll.id}
        question={poll.question}
        options={preparePollForDisplay(poll).options}
        onVote={noop}
        userVotes={[]}
        totalVotes={getTotalVotesForPoll(poll)}
        canVote={false}
        totalGoingParticipants={acceptedParticipants.length}
        hideQuestion={config?.hideQuestion ?? false}
        readOnly
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <PlanTabs 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        unreadCount={unreadCount}
        customTabs={['Details', 'Chat']}
      />
      
      {activeTab === 'Details' && (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        >
          {/* Description */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            {latestPlan.description ? (
              <Text style={styles.planDescription}>{latestPlan.description}</Text>
            ) : (
              <Text style={styles.planDescriptionPlaceholder}>
                This plan didn't include a description.
              </Text>
            )}
          </View>

          {/* Poll Results */}
          {(whenPoll || wherePoll || customPolls.length > 0) && (
            <View style={styles.section}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Poll Results</Text>
              </View>
              
              {whenPoll && renderCompletedPoll(whenPoll, {
                title: 'When did it work best?',
                icon: <Clock size={18} color={Colors.light.text} style={styles.pollIcon} />,
                hideQuestion: true
              })}
              
              {wherePoll && renderCompletedPoll(wherePoll, {
                title: 'Where you met',
                icon: <MapPin size={18} color={Colors.light.text} style={styles.pollIcon} />,
                hideQuestion: true
              })}
              
              {customPolls.map((poll) => renderCompletedPoll(poll))}
            </View>
          )}

          {/* Who Attended */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Users size={20} color={Colors.light.text} style={styles.headerIcon} />
              <Text style={styles.sectionTitle}>Who Attended</Text>
            </View>
            <View style={styles.participantsContainer}>
              {renderAttendanceGroup('Attended', attendedParticipants)}
              {renderAttendanceGroup('Interested', interestedParticipants)}
              {renderAttendanceGroup("Didn't respond", didntRespondParticipants)}
              {renderAttendanceGroup('Did not attend', didNotAttendParticipants)}
              {!hasAttendanceData && (
                <Text style={styles.emptyParticipantsText}>
                  Attendance responses will appear here once everyone has replied.
                </Text>
              )}
            </View>
          </View>

          {/* Want to do this again? */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <RotateCcw size={20} color={Colors.light.text} style={styles.headerIcon} />
              <Text style={styles.sectionTitle}>Recreate this plan</Text>
            </View>
            
            <Text style={styles.doItAgainDescription}>
              You can modify the details before sending.
            </Text>
            
            <View style={styles.planButtonsContainer}>
              <TouchableOpacity 
                style={[styles.planButton, styles.createPlanButton]}
                onPress={() => handleOpenPlanBuilder(false)}
                activeOpacity={0.8}
              >
                <UserPlus size={16} color="white" style={styles.planButtonIcon} />
                <Text style={styles.createPlanButtonText}>Create Plan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.planButton, styles.anonymousPlanButton]}
                onPress={() => handleOpenPlanBuilder(true)}
                activeOpacity={0.8}
              >
                <UserPlus size={16} color="white" style={styles.planButtonIcon} />
                <Text style={styles.anonymousPlanButtonText}>Anonymous Plan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Plan Date */}
          {planDateLabel && (
            <View style={styles.planDateFooter}>
              <Calendar size={16} color={Colors.light.secondaryText} style={styles.planDateIcon} />
              <Text style={styles.planDateFooterText}>
                Plan took place on {planDateLabel}
              </Text>
            </View>
          )}
          
          {/* Bottom padding for better scrolling */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
      
      {activeTab === 'Chat' && (
        <View style={styles.chatContainer}>
          <KeyboardAvoidingView 
            style={styles.chatKeyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
            <ChatView 
              plan={latestPlan} 
              currentUserId={authUser.id} 
              disableKeyboardAvoidance={true}
            />
          </KeyboardAvoidingView>
        </View>
      )}
      
      {/* Plan Creation Modal */}
      <PlanSuggestionSheet
        visible={showPlanSheet}
        onClose={handleClosePlanSheet}
        selectedFriends={recreatedPlanFriends}
        availableFriends={availableFriendsForModal}
        isAnonymous={isAnonymousPlan}
        onPlanSubmitted={handlePlanSubmitted}
        onFriendsUpdated={handleFriendsUpdated}
        onAddMoreFriends={handleAddMoreFriends}
        prefilledTitle={latestPlan.title}
        prefilledDescription={latestPlan.description}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
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
  planDescription: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    lineHeight: 22,
    marginBottom: 0,
  },
  planDescriptionPlaceholder: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    lineHeight: 22,
    opacity: 0.8,
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
  participantsContainer: {
    marginBottom: 8,
  },
  participantGroup: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.secondaryText,
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.background,
    backgroundColor: Colors.light.border,
  },
  acceptedIndicator: {
    backgroundColor: Colors.light.onlineGreen,
  },
  maybeIndicator: {
    backgroundColor: '#FFC107',
  },
  conditionalIndicator: {
    backgroundColor: Colors.light.primary,
  },
  pendingIndicator: {
    backgroundColor: Colors.light.offlineGray,
  },
  declinedIndicator: {
    backgroundColor: Colors.light.destructive,
  },
  questionMark: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  eyeIcon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyePupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.offlineGray,
  },
  participantName: {
    fontSize: 14,
    color: Colors.light.text,
  },
  emptyParticipantsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
  doItAgainDescription: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 16,
  },
  planButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  planButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createPlanButton: {
    backgroundColor: Colors.light.primary,
  },
  createPlanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  anonymousPlanButton: {
    backgroundColor: Colors.light.secondary,
  },
  anonymousPlanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  planButtonIcon: {
    // No marginRight needed since text has marginLeft
  },
  chatContainer: {
    flex: 1,
  },
  chatKeyboardView: {
    flex: 1,
  },
  planDateFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  planDateIcon: {
    marginRight: 8,
  },
  planDateFooterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
}); 