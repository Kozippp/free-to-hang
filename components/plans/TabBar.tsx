import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';
import useNotificationsStore from '@/store/notificationsStore';
import NotificationDot from '@/components/NotificationDot';

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  const { getNotificationCounts } = useNotificationsStore();
  const notificationCounts = getNotificationCounts();
  
  const getTabNotificationCount = (tab: string): number => {
    switch(tab) {
      case 'Invitations':
        return notificationCounts.bySection.invitations;
      case 'Plan':
        return notificationCounts.bySection.active;
      case 'Completed':
        return notificationCounts.bySection.completed;
      default:
        return 0;
    }
  };
  
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tab,
            activeTab === tab && styles.activeTab
          ]}
          onPress={() => onTabChange(tab)}
        >
          <View style={styles.tabTextContainer}>
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText
              ]}
            >
              {tab}
            </Text>
            
            {/* Näita punast punkti, kui on teavitusi */}
            <NotificationDot 
              count={getTabNotificationCount(tab)}
              size="small"
              style={{
                position: 'relative',
                marginLeft: 4,
                top: 0,
                right: 0,
              }}
            />
          </View>
          
          {activeTab === tab && <View style={styles.indicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    backgroundColor: Colors.light.background,
  },
  tabTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.secondaryText,
  },
  activeTabText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.light.primary,
  },
});