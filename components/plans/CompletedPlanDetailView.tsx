import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  KeyboardAvoidingView,
  Alert
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
  HelpCircle
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan, Poll } from '@/store/plansStore';
import PlanTabs from './PlanTabs';
import ChatView from '../chat/ChatView';
import PlanSuggestionSheet from './PlanSuggestionSheet';
import useChatStore from '@/store/chatStore';
import useHangStore from '@/store/hangStore';
import usePlansStore from '@/store/plansStore';

interface CompletedPlanDetailViewProps {
  plan: Plan;
  onClose: () => void;
  onAttendanceUpdate?: (planId: string, userId: string, attended: boolean) => void;
}

export default function CompletedPlanDetailView({ plan, onClose, onAttendanceUpdate }: CompletedPlanDetailViewProps) {
  const { getUnreadCount } = useChatStore();
  const { user } = useHangStore();
  const { completedPlans } = usePlansStore();
  const [activeTab, setActiveTab] = useState('Details');
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [isAnonymousPlan, setIsAnonymousPlan] = useState(false);
  
  // Get the latest plan data from store to reflect attendance updates
  const latestPlan = completedPlans.find(p => p.id === plan.id) || plan;
  
  // Get attendance status from latest plan's attendanceRecord
  const currentUserAttended = latestPlan.attendanceRecord?.['current'] ?? null;
  
  // Group participants by status
  const acceptedParticipants = latestPlan.participants.filter(p => p.status === 'accepted');
  const maybeParticipants = latestPlan.participants.filter(p => 
    p.status === 'maybe' || p.status === 'conditional'
  );
  const pendingParticipants = latestPlan.participants.filter(p => p.status === 'pending');
  const declinedParticipants = latestPlan.participants.filter(p => p.status === 'declined');
  
  // Get final poll results
  const polls = latestPlan.polls || [];
  const whenPoll = polls.find(poll => poll.type === 'when');
  const wherePoll = polls.find(poll => poll.type === 'where');
  const customPolls = polls.filter(poll => poll.type === 'custom');
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };
  
  // Format creation date and time
  const formatCompletionInfo = (createdAt: string) => {
    const date = new Date(createdAt);
    return {
      date: date.toLocaleDateString('en-GB', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    };
  };
  
  const completionInfo = formatCompletionInfo(latestPlan.createdAt);
  
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

  // Enhanced attendance handling
  const handleAttendanceConfirmation = (attended: boolean) => {
    if (attended) {
      // User attended - record attendance
      onAttendanceUpdate?.(latestPlan.id, 'current', true);
      // In a real app, this would also update the backend/store
      Alert.alert(
        'Attendance Recorded',
        'Thanks for confirming! This plan is now marked as attended.',
        [{ text: 'OK', style: 'default' }]
      );
    } else {
      // User didn't attend - show deletion prompt
      Alert.alert(
        'Plan Removal',
        'Would you like to delete this from your completed plans?',
        [
          {
            text: 'Keep',
            style: 'cancel',
            onPress: () => {
              onAttendanceUpdate?.(latestPlan.id, 'current', false);
            }
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              // In a real app, this would remove the plan from completed plans
              Alert.alert(
                'Plan Deleted',
                'This plan has been removed from your completed plans.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      onClose(); // Close the detail view since plan is deleted
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    }
  };

  // Convert plan participants to the format expected by PlanSuggestionSheet
  const getSelectedFriendsData = () => {
    return latestPlan.participants
      .filter(p => p.id !== 'current') // Exclude current user
      .map(participant => ({
        id: participant.id,
        name: participant.name,
        avatar: participant.avatar,
        status: 'available' as const, // Assume they're available for simplicity
        activity: '',
        lastActive: '',
        lastSeen: ''
      }));
  };

  // Helper function to get poll results
  const getPollResults = (poll: Poll) => {
    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.length, 0);
    const winningOption = poll.options.reduce((winner, current) => 
      current.votes.length > winner.votes.length ? current : winner
    );
    
    return {
      totalVotes,
      winningOption,
      options: poll.options.map(option => ({
        ...option,
        percentage: totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0
      }))
    };
  };

  const renderParticipant = (participant: any) => (
    <View key={participant.id} style={styles.participantItem}>
      <Image source={{ uri: participant.avatar }} style={styles.participantAvatar} />
      <Text style={styles.participantName}>
        {participant.id === 'current' ? 'You' : participant.name}
      </Text>
    </View>
  );

  const renderPollResults = (poll: Poll) => {
    const results = getPollResults(poll);
    
    return (
      <View key={poll.id} style={styles.pollResultsContainer}>
        <Text style={styles.pollStats}>
          {results.totalVotes} {results.totalVotes === 1 ? 'vote' : 'votes'}
          {results.totalVotes > 0 && (
            <Text style={styles.winnerIndicator}> • Winner: {results.winningOption.text}</Text>
          )}
        </Text>
        
        <View style={styles.pollOptionsContainer}>
          {results.options.map((option) => (
            <View key={option.id} style={styles.pollOption}>
              <View style={styles.pollOptionHeader}>
                <Text style={[
                  styles.pollOptionText,
                  option.id === results.winningOption.id && styles.winnerText
                ]}>
                  {option.text}
                </Text>
                <Text style={styles.pollOptionPercentage}>{option.percentage}%</Text>
              </View>
              <View style={styles.pollOptionBar}>
                <View 
                  style={[
                    styles.pollOptionProgress,
                    { 
                      width: `${option.percentage}%`,
                      backgroundColor: option.id === results.winningOption.id 
                        ? Colors.light.primary 
                        : Colors.light.buttonBackground
                    }
                  ]} 
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

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
          {/* Plan Summary */}
          <View style={styles.section}>
            {/* Status and Date Row */}
            <View style={styles.statusRow}>
              <View style={styles.statusIcon}>
                {currentUserAttended === true ? (
                  <Check size={16} color={Colors.light.onlineGreen} />
                ) : currentUserAttended === false ? (
                  <X size={16} color="#FF6B6B" />
                ) : (
                  <HelpCircle size={16} color={Colors.light.secondaryText} />
                )}
              </View>
              <Text style={styles.dateText}>
                {completionInfo.date}
              </Text>
            </View>
            
            {/* Plan Title */}
            <Text style={styles.planTitle}>{latestPlan.title}</Text>
            
            {/* Plan Description */}
            {latestPlan.description && (
              <Text style={styles.planDescription}>{latestPlan.description}</Text>
            )}
          </View>

          {/* Want to do this again? Section */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <RotateCcw size={20} color={Colors.light.text} style={styles.headerIcon} />
              <Text style={styles.sectionTitle}>Want to do this again?</Text>
            </View>
            
            <Text style={styles.doItAgainDescription}>
              Recreate this plan with the same people. You can modify the details before sending.
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

          {/* Final Decisions */}
          {(whenPoll || wherePoll || customPolls.length > 0) && (
            <View style={styles.section}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Final Decisions</Text>
              </View>
              
              {whenPoll && (
                <View style={styles.decisionContainer}>
                  <Text style={styles.decisionTitle}>What time worked best</Text>
                  {renderPollResults(whenPoll)}
                </View>
              )}
              
              {wherePoll && (
                <View style={styles.decisionContainer}>
                  <Text style={styles.decisionTitle}>Where you met</Text>
                  {renderPollResults(wherePoll)}
                </View>
              )}
              
              {customPolls.map((poll) => (
                <View key={poll.id} style={styles.decisionContainer}>
                  {renderPollResults(poll)}
                </View>
              ))}
            </View>
          )}

          {/* Final Attendance */}
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Users size={20} color={Colors.light.text} style={styles.headerIcon} />
              <Text style={styles.sectionTitle}>Who Attended</Text>
            </View>
            
            {/* Attended Section */}
            {(currentUserAttended === true || acceptedParticipants.filter(p => p.id !== 'current').length > 0) && (
              <View style={styles.participantGroup}>
                <Text style={styles.groupTitle}>
                  Attended ({(currentUserAttended === true ? 1 : 0) + acceptedParticipants.filter(p => p.id !== 'current').length})
                </Text>
                <View style={styles.participantsList}>
                  {/* Show current user first if they attended */}
                  {currentUserAttended === true && (
                    <View style={styles.participantItem}>
                      <Image 
                        source={{ uri: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' }} 
                        style={styles.participantAvatar} 
                      />
                      <Text style={styles.participantName}>You</Text>
                    </View>
                  )}
                  {/* Then show others who attended */}
                  {acceptedParticipants.filter(p => p.id !== 'current').map(renderParticipant)}
                </View>
              </View>
            )}
            
            {/* Haven't Responded Section */}
            {(currentUserAttended === null || maybeParticipants.length > 0 || pendingParticipants.length > 0) && (
              <View style={styles.participantGroup}>
                <Text style={styles.groupTitle}>
                  Haven't Responded ({(currentUserAttended === null ? 1 : 0) + maybeParticipants.length + pendingParticipants.length})
                </Text>
                <View style={styles.participantsList}>
                  {/* Show current user if they haven't responded */}
                  {currentUserAttended === null && (
                    <View style={styles.participantItem}>
                      <Image 
                        source={{ uri: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' }} 
                        style={styles.participantAvatar} 
                      />
                      <Text style={styles.participantName}>You</Text>
                    </View>
                  )}
                  {/* Show maybe and pending participants */}
                  {maybeParticipants.map(renderParticipant)}
                  {pendingParticipants.map(renderParticipant)}
                </View>
              </View>
            )}
            
            {/* Did Not Attend Section */}
            {(currentUserAttended === false || declinedParticipants.length > 0) && (
              <View style={styles.participantGroup}>
                <Text style={styles.groupTitle}>
                  Did Not Attend ({(currentUserAttended === false ? 1 : 0) + declinedParticipants.length})
                </Text>
                <View style={styles.participantsList}>
                  {/* Show current user if they didn't attend */}
                  {currentUserAttended === false && (
                    <View style={styles.participantItem}>
                      <Image 
                        source={{ uri: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' }} 
                        style={styles.participantAvatar} 
                      />
                      <Text style={styles.participantName}>You</Text>
                    </View>
                  )}
                  {/* Show declined participants */}
                  {declinedParticipants.map(renderParticipant)}
                </View>
              </View>
            )}
            
            {/* Your Attendance Status Toggle */}
            <View style={styles.attendanceStatusContainer}>
              <Text style={styles.attendanceStatusLabel}>Did you actually attend this hangout?</Text>
              <View style={styles.attendanceToggleContainer}>
                <TouchableOpacity 
                  style={[
                    styles.attendanceToggleButton,
                    currentUserAttended === true && styles.attendanceToggleButtonActive
                  ]}
                  onPress={() => {
                    handleAttendanceConfirmation(true);
                  }}
                >
                  <Text style={[
                    styles.attendanceToggleText,
                    currentUserAttended === true && styles.attendanceToggleTextActive
                  ]}>
                    Yes, I attended
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.attendanceToggleButton,
                    currentUserAttended === false && styles.attendanceToggleButtonActive
                  ]}
                  onPress={() => {
                    handleAttendanceConfirmation(false);
                  }}
                >
                  <Text style={[
                    styles.attendanceToggleText,
                    currentUserAttended === false && styles.attendanceToggleTextActive
                  ]}>
                    No, I didn't attend
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {/* Bottom padding for better scrolling */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
      
      {activeTab === 'Chat' && (
        <View style={styles.chatContainer}>
          {/* Chat Deletion Warning */}
          <View style={styles.chatWarning}>
            <Text style={styles.chatWarningText}>
              💬 Chat messages will be automatically deleted in 7 days from completion
            </Text>
          </View>
          <KeyboardAvoidingView 
            style={styles.chatKeyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
            <ChatView 
              plan={latestPlan} 
              currentUserId="current" 
              disableKeyboardAvoidance={true}
            />
          </KeyboardAvoidingView>
        </View>
      )}
      
      {/* Plan Creation Modal */}
      <PlanSuggestionSheet
        visible={showPlanSheet}
        onClose={handleClosePlanSheet}
        selectedFriends={getSelectedFriendsData()}
        availableFriends={[]} // Empty since we're not showing additional friends for completed plans
        isAnonymous={isAnonymousPlan}
        onPlanSubmitted={handlePlanSubmitted}
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
  planTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    lineHeight: 22,
    marginBottom: 0,
  },
  decisionContainer: {
    marginBottom: 16,
  },
  decisionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 6,
  },
  pollResultsContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
  },
  pollStats: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    marginBottom: 12,
  },
  winnerIndicator: {
    fontWeight: '600',
    color: Colors.light.primary,
  },
  pollOptionsContainer: {
    gap: 8,
  },
  pollOption: {
    marginBottom: 4,
  },
  pollOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pollOptionText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  winnerText: {
    fontWeight: '600',
    color: Colors.light.primary,
  },
  pollOptionPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  pollOptionBar: {
    height: 6,
    backgroundColor: `${Colors.light.buttonBackground}50`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pollOptionProgress: {
    height: '100%',
    borderRadius: 3,
  },
  participantGroup: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  participantItem: {
    alignItems: 'center',
    marginBottom: 8,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 4,
  },
  participantName: {
    fontSize: 12,
    color: Colors.light.text,
    textAlign: 'center',
    maxWidth: 60,
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
  chatWarning: {
    backgroundColor: `${Colors.light.warning}15`,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  chatWarningText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.warning,
  },
  attendanceStatusContainer: {
    marginTop: 16,
  },
  attendanceStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  attendanceToggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  attendanceToggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  attendanceToggleButtonActive: {
    borderColor: Colors.light.primary,
    backgroundColor: `${Colors.light.primary}15`,
  },
  attendanceToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  attendanceToggleTextActive: {
    color: Colors.light.primary,
  },
  chatKeyboardView: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIcon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
}); 