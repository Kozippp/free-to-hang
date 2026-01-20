import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { NotificationSender } from '@/store/notificationsStore';
import { Calendar, Bell } from 'lucide-react-native';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import CachedAvatar from '@/components/CachedAvatar';

interface Props {
  actors: NotificationSender[];
  type: string;
  onPress?: (user: NotificationSender) => void;
}

export default function NotificationAvatarStack({ actors, type, onPress }: Props) {
  const safeActors = Array.isArray(actors) ? actors.filter(Boolean) : [];

  // If no actors (system notification), show icon
  if (safeActors.length === 0) {
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
  if (safeActors.length === 1) {
    const actor = safeActors[0];
    const actorName = actor?.name?.trim() || 'User';
    const fallbackUri = generateDefaultAvatar(actorName, actor?.id);
    return (
      <TouchableOpacity 
        style={styles.container} 
        onPress={() => onPress && onPress(actor)}
        activeOpacity={0.8}
      >
        <CachedAvatar
          userId={actor?.id}
          uri={actor?.avatar_url}
          fallbackUri={fallbackUri}
          style={styles.avatarLarge}
        />
      </TouchableOpacity>
    );
  }

  // Multiple actors (Stack)
  // Show max 2 avatars stacked
  const displayActors = safeActors.slice(0, 2);

  return (
    <View style={[styles.container, { width: 50, height: 50, marginRight: 8 }]}>
      {displayActors.map((actor, index) => {
        const actorName = actor?.name?.trim() || 'User';
        const fallbackUri = generateDefaultAvatar(actorName, actor?.id);
        return (
          <TouchableOpacity
            key={actor.id}
            activeOpacity={0.9}
            onPress={() => onPress && onPress(actor)}
            style={[
              styles.stackedAvatarContainer,
              index === 0 ? styles.stackBottom : styles.stackTop
            ]}
          >
            <CachedAvatar
              userId={actor?.id}
              uri={actor?.avatar_url}
              fallbackUri={fallbackUri}
              style={styles.avatarSmall}
            />
          </TouchableOpacity>
        );
      })}
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
