import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { X, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'available' | 'offline' | 'pinged';
}

interface PlanSuggestionParticipantsProps {
  friends: Friend[];
  onRemoveFriend: (friendId: string) => void;
  currentUserId?: string;
}

export default function PlanSuggestionParticipants({
  friends,
  onRemoveFriend,
  currentUserId
}: PlanSuggestionParticipantsProps) {
  // Group friends by status
  const goingFriends = friends.filter(friend =>
    friend.status === 'available' || friend.status === 'pinged' || friend.id === currentUserId
  );
  const maybeFriends: Friend[] = []; // No maybe status in plan creation
  const pendingFriends = friends.filter(friend => friend.status === 'offline');

  const renderParticipant = (friend: Friend, showRemoveButton: boolean = true) => {
    return (
      <View key={friend.id} style={styles.participantRow}>
        <View style={styles.participantInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: friend.avatar }} style={styles.avatar} />
            <View style={[
              styles.statusIndicator,
              friend.status === 'available' && styles.availableIndicator,
              friend.status === 'offline' && styles.offlineIndicator,
              friend.status === 'pinged' && styles.pingedIndicator,
            ]}>
              {(friend.status === 'available' || friend.id === currentUserId) && (
                <Check size={10} color="white" />
              )}
              {friend.status === 'pinged' && (
                <View style={styles.pingDot} />
              )}
              {friend.status === 'offline' && (
                <View style={styles.offlineDot} />
              )}
            </View>
          </View>
          <Text style={styles.participantName}>
            {friend.name}
          </Text>
        </View>

        {showRemoveButton && friend.id !== currentUserId && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemoveFriend(friend.id)}
          >
            <X size={14} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>People ({friends.length})</Text>

      <ScrollView
        style={styles.participantsScrollContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        <View style={styles.participantsContainer}>
          {goingFriends.length > 0 && (
            <View style={styles.participantGroup}>
              <Text style={styles.groupTitle}>
                Invited ({goingFriends.length})
              </Text>
              {goingFriends.map(friend => renderParticipant(friend, friend.id !== currentUserId))}
            </View>
          )}

          {pendingFriends.length > 0 && (
            <View style={styles.participantGroup}>
              <Text style={styles.groupTitle}>
                Offline ({pendingFriends.length})
              </Text>
              {pendingFriends.map(friend => renderParticipant(friend))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  participantsScrollContainer: {
    maxHeight: 300, // Limit height to make it scrollable
  },
  participantsContainer: {
    // Container for all participant groups
  },
  participantGroup: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 8,
    fontWeight: '500',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 8,
    marginBottom: 4,
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    borderColor: Colors.light.buttonBackground,
  },
  availableIndicator: {
    backgroundColor: Colors.light.onlineGreen,
  },
  offlineIndicator: {
    backgroundColor: Colors.light.offlineGray,
  },
  pingedIndicator: {
    backgroundColor: '#FFC107', // Amber color for pinged status
  },
  pingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  participantName: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  removeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: Colors.light.buttonBackground,
  },
});
