import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';
import useNotificationsStore from '@/store/notificationsStore';
import NotificationDot from '@/components/NotificationDot';

interface PlanTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  planId: string;
}

export default function PlanTabs({ activeTab, onTabChange, planId }: PlanTabsProps) {
  const { getNotificationCounts } = useNotificationsStore();
  const notificationCounts = getNotificationCounts();
  
  const controlPanelCount = notificationCounts.byPlan[planId]?.controlPanel || 0;
  const chatCount = notificationCounts.byPlan[planId]?.chat || 0;
  
  const tabs = [
    { name: 'Control Panel', count: controlPanelCount },
    { name: 'Chat', count: chatCount }
  ];
  
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={[
            styles.tab,
            activeTab === tab.name && styles.activeTab
          ]}
          onPress={() => onTabChange(tab.name)}
        >
          <View style={styles.tabContent}>
            <Text
              style={[
                styles.tabText,
                activeTab === tab.name && styles.activeTabText
              ]}
            >
              {tab.name}
            </Text>
            
            <NotificationDot 
              count={tab.count}
              size="medium"
              showCount={true}
              style={{
                position: 'absolute',
                top: -8,
                right: -12,
              }}
            />
          </View>
          
          {activeTab === tab.name && <View style={styles.indicator} />}
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
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
});