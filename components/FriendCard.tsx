import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import Colors from '@/constants/colors';
import { CheckCircle, HelpCircle, Eye, EyeOff } from 'lucide-react-native';

interface FriendCardProps {
  id: string;
  name: string;
  avatar: string;
  activity?: string;
  lastActive?: string;
  selected: boolean;
  onSelect: (id: string) => void;
  status?: 'available' | 'offline' | 'pinged';
  responseStatus?: 'accepted' | 'maybe' | 'pending' | 'seen' | 'unseen';
}

export default function FriendCard({
  id,
  name,
  avatar,
  activity,
  lastActive,
  selected,
  onSelect,
  status = 'available',
  responseStatus = 'pending',
}: FriendCardProps) {
  // Render the appropriate status indicator based on response status
  const renderStatusIndicator = () => {
    switch (responseStatus) {
      case 'accepted':
        return (
          <View style={[styles.statusDot, styles.acceptedDot]}>
            <CheckCircle size={10} color="white" strokeWidth={0} fill="white" />
          </View>
        );
      case 'maybe':
        return (
          <View style={[styles.statusDot, styles.maybeDot]}>
            <HelpCircle size={10} color="white" strokeWidth={0} fill="white" />
          </View>
        );
      case 'seen':
        return (
          <View style={[styles.statusDot, styles.seenDot]}>
            <View style={styles.eyeShape}>
              <View style={styles.pupil} />
            </View>
          </View>
        );
      case 'unseen':
        return (
          <View style={[styles.statusDot, styles.unseenDot]}>
            <View style={styles.eyeShape}>
              <View style={styles.crossedEye} />
            </View>
          </View>
        );
      default:
        // For available/offline/pinged status
        return (
          <View style={[
            styles.statusDot,
            status === 'available' && styles.onlineDot,
            status === 'offline' && styles.offlineDot,
            status === 'pinged' && styles.pingedDot,
          ]} />
        );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.selectedCard]}
      onPress={() => onSelect(id)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        {renderStatusIndicator()}
      </View>
      
      <View style={styles.infoContainer}>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{name}</Text>
          {lastActive && status === 'available' && (
            <Text style={styles.timeAgo}>{lastActive}</Text>
          )}
        </View>
        {activity && (
          <Text style={styles.activity}>{activity}</Text>
        )}
        {status === 'offline' && lastActive && (
          <Text style={styles.lastSeen}>Last seen {lastActive}</Text>
        )}
      </View>
      
      {selected && (
        <View style={styles.selectedIndicator} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: `${Colors.light.primary}12`, // 12% opacity of primary color
    borderColor: Colors.light.primary,
    borderWidth: 2,
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.15,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.light.cardBackground,
  },
  onlineDot: {
    backgroundColor: Colors.light.onlineGreen,
  },
  offlineDot: {
    backgroundColor: Colors.light.offlineGray,
  },
  pingedDot: {
    backgroundColor: '#FFC107', // Amber color for pinged status
  },
  acceptedDot: {
    backgroundColor: Colors.light.onlineGreen,
  },
  maybeDot: {
    backgroundColor: '#FFC107', // Yellow for maybe
  },
  seenDot: {
    backgroundColor: Colors.light.offlineGray, // Gray for seen
    justifyContent: 'center',
    alignItems: 'center',
  },
  unseenDot: {
    backgroundColor: Colors.light.offlineGray, // Gray for unseen
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeShape: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.offlineGray,
  },
  crossedEye: {
    width: 8,
    height: 2,
    backgroundColor: Colors.light.offlineGray,
    transform: [{ rotate: '45deg' }],
  },
  infoContainer: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  timeAgo: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    opacity: 0.8,
    fontWeight: '400',
  },
  activity: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  lastSeen: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    opacity: 0.8,
    marginTop: 2,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});