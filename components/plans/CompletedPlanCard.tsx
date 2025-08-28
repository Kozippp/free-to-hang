import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Users, Check, X, Clock, HelpCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan } from '@/store/plansStore';

interface CompletedPlanCardProps {
  plan: Plan;
  onPress: (plan: Plan) => void;
  userAttended?: boolean | null; // null = not answered, true = attended, false = didn't attend
}

export default function CompletedPlanCard({ plan, onPress, userAttended }: CompletedPlanCardProps) {
  // Get participants who actually joined (going status)
  const joinedParticipants = plan.participants.filter(p => p.status === 'going');
  
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

  // Get status icon based on user's participation
  const getStatusIcon = () => {
    if (userAttended === true) {
      return <Check size={16} color={Colors.light.onlineGreen} />;
    } else if (userAttended === false) {
      return <X size={16} color="#FF6B6B" />;
    } else {
      return <HelpCircle size={16} color={Colors.light.secondaryText} />;
    }
  };

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
          <View style={styles.statusIcon}>
            {getStatusIcon()}
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
  statusIcon: {
    marginRight: 8,
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