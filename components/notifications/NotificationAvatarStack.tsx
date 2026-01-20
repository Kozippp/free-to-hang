import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { NotificationSender } from '@/store/notificationsStore';
import { Calendar, Bell } from 'lucide-react-native';

interface Props {
  actors: NotificationSender[];
  type: string;
  onPress?: (user: NotificationSender) => void;
}

export default function NotificationAvatarStack({ actors, type, onPress }: Props) {
  // If no actors (system notification), show icon
  if (!actors || actors.length === 0) {
    return (
      <View style={[styles.container, styles.iconContainer]}>
        {type.includes('plan') ? (
          <Calendar size={24} color="#fff" />
        ) : (
          <Bell size={24} color="#fff" />
        )}
      </View>
    );
  }

  // Single actor
  if (actors.length === 1) {
    const actor = actors[0];
    return (
      <TouchableOpacity 
        style={styles.container} 
        onPress={() => onPress && onPress(actor)}
        activeOpacity={0.8}
      >
        <Image 
          source={{ uri: actor.avatar_url || `https://ui-avatars.com/api/?name=${actor.name}&background=random` }} 
          style={styles.avatarLarge} 
        />
      </TouchableOpacity>
    );
  }

  // Multiple actors (Stack)
  // Show max 2 avatars stacked
  const displayActors = actors.slice(0, 2);

  return (
    <View style={[styles.container, { width: 50, height: 50, marginRight: 8 }]}>
      {displayActors.map((actor, index) => (
        <TouchableOpacity
          key={actor.id}
          activeOpacity={0.9}
          onPress={() => onPress && onPress(actor)}
          style={[
            styles.stackedAvatarContainer,
            index === 0 ? styles.stackBottom : styles.stackTop
          ]}
        >
          <Image
            source={{ uri: actor.avatar_url || `https://ui-avatars.com/api/?name=${actor.name}&background=random` }}
            style={styles.avatarSmall}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000', // Black background for system icons
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#f0f0f0',
  },
  stackedAvatarContainer: {
    position: 'absolute',
    borderRadius: 20, // slightly larger than radius to cover border
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  stackBottom: {
    bottom: 2,
    right: 2,
    zIndex: 2, // Front
  },
  stackTop: {
    top: 2,
    left: 2,
    zIndex: 1, // Back
  },
});
