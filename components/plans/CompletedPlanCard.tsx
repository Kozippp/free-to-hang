import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Plan } from '@/store/plansStore';

interface CompletedPlanCardProps {
  plan: Plan;
  onPress: (plan: Plan) => void;
}

export default function CompletedPlanCard({ plan, onPress }: CompletedPlanCardProps) {
  // Get participants who actually joined (accepted status)
  const joinedParticipants = plan.participants.filter(p => p.status === 'accepted');
  
  // Format creation date
  const formatCreationDate = (createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };
  
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(plan)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{plan.title}</Text>
            <Text style={styles.dateLabel}>
              {formatCreationDate(plan.createdAt)}
            </Text>
          </View>
          {plan.description && (
            <Text style={styles.description} numberOfLines={2}>
              {plan.description}
            </Text>
          )}
        </View>
        
        <View style={styles.footer}>
          <View style={styles.participantsInfo}>
            <Users size={16} color={Colors.light.secondaryText} style={styles.icon} />
            <Text style={styles.participantsText}>
              {joinedParticipants.length} {joinedParticipants.length === 1 ? 'person' : 'people'} joined
            </Text>
          </View>
          
          <View style={styles.avatarsContainer}>
            {joinedParticipants.slice(0, 3).map((participant, index) => (
              <View 
                key={participant.id} 
                style={[
                  styles.avatarWrapper,
                  { zIndex: 3 - index, marginLeft: index > 0 ? -12 : 0 }
                ]}
              >
                <Image source={{ uri: participant.avatar }} style={styles.avatar} />
              </View>
            ))}
            
            {joinedParticipants.length > 3 && (
              <View style={[styles.avatarWrapper, styles.moreAvatars, { marginLeft: -12 }]}>
                <Text style={styles.moreAvatarsText}>+{joinedParticipants.length - 3}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cardContent: {
    flexDirection: 'column',
  },
  header: {
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  description: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
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
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.light.background,
    position: 'relative',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  moreAvatars: {
    backgroundColor: Colors.light.buttonBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAvatarsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
}); 