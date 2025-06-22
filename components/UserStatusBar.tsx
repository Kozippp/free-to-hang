import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import StatusToggle from './StatusToggle';
import Colors from '@/constants/colors';
import { MapPin } from 'lucide-react-native';

interface UserStatusBarProps {
  avatar: string;
  name: string;
  isAvailable: boolean;
  activity?: string;
  onToggle: () => void;
}

export default function UserStatusBar({ 
  avatar, 
  name,
  isAvailable, 
  activity, 
  onToggle 
}: UserStatusBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={[
            styles.statusDot,
            isAvailable ? styles.statusOnline : styles.statusOffline
          ]} />
        </View>
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.userName}>{name}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              {isAvailable ? 'Free to hang' : 'Unavailable'}
            </Text>
          </View>
          {activity ? (
            <View style={styles.activityContainer}>
              <MapPin size={14} color={Colors.light.secondaryText} />
              <Text style={styles.activity}>
                {activity}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.toggleContainer}>
        <StatusToggle 
          isOn={isAvailable} 
          onToggle={onToggle} 
          size="small" 
          hideText={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 46, // 15% larger than friend avatars (which are 40px)
    height: 46,
    borderRadius: 23,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.light.cardBackground,
  },
  statusContainer: {
    flexDirection: 'column',
    gap: 2, // Reduced gap between status and activity
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusOnline: {
    backgroundColor: Colors.light.onlineGreen,
  },
  statusOffline: {
    backgroundColor: Colors.light.offlineGray,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.secondaryText,
  },
  activityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2, // Reduced gap
  },
  activity: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginLeft: 4,
  },
  toggleContainer: {
    marginLeft: 'auto',
    alignSelf: 'center',
    paddingRight: 8,
  },
});