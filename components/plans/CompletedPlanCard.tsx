import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Users, Check, X, Eye, HelpCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan, ParticipantStatus } from '@/store/plansStore';

interface CompletedPlanCardProps {
  plan: Plan;
  onPress: (plan: Plan) => void;
  userAttended?: boolean | null; // null = not answered, true = attended, false = didn't attend
  currentUserId?: string;
}

export default function CompletedPlanCard({ plan, onPress, userAttended, currentUserId }: CompletedPlanCardProps) {
  // Get participants who actually joined (going status)
  const joinedParticipants = plan.participants.filter(p => p.status === 'going');
  const currentUserParticipant = plan.participants.find(participant => {
    if (participant.id === 'current') {
      return true;
    }
    if (currentUserId) {
      return participant.id === currentUserId;
    }
    return false;
  });
  
  // Format creation date to short format
  const formatDate = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short'
      });
    }
  };

  const getStatusIndicatorConfig = (
    status?: ParticipantStatus,
    attendanceValue?: boolean | null
  ) => {
    switch (status) {
      case 'going':
        return {
          containerStyle: styles.acceptedIndicator,
          content: <Check size={12} color="white" />
        };
      case 'maybe':
        return {
          containerStyle: styles.maybeIndicator,
          content: <Text style={styles.statusSymbol}>?</Text>
        };
      case 'conditional':
        return {
          containerStyle: styles.conditionalIndicator,
          content: <Eye size={12} color="white" />
        };
      case 'pending':
        return {
          containerStyle: styles.pendingIndicator,
          content: (
            <View style={styles.pendingEye}>
              <View style={styles.pendingPupil} />
            </View>
          )
        };
      case 'declined':
        return {
          containerStyle: styles.declinedIndicator,
          content: <X size={12} color="white" />
        };
      default:
        if (attendanceValue === true) {
          return {
            containerStyle: styles.acceptedIndicator,
            content: <Check size={12} color="white" />
          };
        }
        if (attendanceValue === false) {
          return {
            containerStyle: styles.declinedIndicator,
            content: <X size={12} color="white" />
          };
        }
        return {
          containerStyle: styles.unknownIndicator,
          content: <HelpCircle size={12} color="white" />
        };
    }
  };

  const { containerStyle, content } = getStatusIndicatorConfig(
    currentUserParticipant?.status,
    userAttended
  );

  return (
    <View style={styles.container}>
      {/* Top Separator */}
      <View style={styles.separator} />
      
      <TouchableOpacity
        style={styles.activeArea}
        onPress={() => onPress(plan)}
        activeOpacity={0.7}
      >
        {/* Status and Date Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, containerStyle]}>
            {content}
          </View>
          <Text style={styles.dateText}>
            {formatDate(plan.createdAt)}
          </Text>
        </View>
        
        {/* Plan Title */}
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {plan.title}
        </Text>
        
        {/* Participants Info */}
        <View style={styles.participantsRow}>
          <View style={styles.participantsInfo}>
            <Users size={14} color={Colors.light.secondaryText} style={styles.participantsIcon} />
            <Text style={styles.participantsText}>
              {joinedParticipants.length} joined
            </Text>
          </View>
          
          <View style={styles.avatarsContainer}>
            {joinedParticipants.slice(0, 3).map((participant, index) => (
              <View 
                key={participant.id} 
                style={[
                  styles.avatarWrapper,
                  { zIndex: 3 - index, marginLeft: index > 0 ? -8 : 0 }
                ]}
              >
                <Image source={{ uri: participant.avatar }} style={styles.avatar} />
              </View>
            ))}
            
            {joinedParticipants.length > 3 && (
              <View style={[styles.avatarWrapper, styles.moreAvatars, { marginLeft: -8 }]}>
                <Text style={styles.moreAvatarsText}>+{joinedParticipants.length - 3}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  separator: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  activeArea: {
    backgroundColor: Colors.light.background,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
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
  unknownIndicator: {
    backgroundColor: Colors.light.border,
  },
  statusSymbol: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pendingEye: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingPupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.offlineGray,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  participantsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsIcon: {
    marginRight: 8,
  },
  participantsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.light.background,
    position: 'relative',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  moreAvatars: {
    backgroundColor: Colors.light.buttonBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAvatarsText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
}); 