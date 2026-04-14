import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadCount?: number;
  unreadTab?: string;
}

export default function TabBar({
  tabs,
  activeTab,
  onTabChange,
  unreadCount = 0,
  unreadTab = 'Active',
}: TabBarProps) {
  const windowWidth = Dimensions.get('window').width;
  const containerPadding = 16;
  const tabWidth = (windowWidth - containerPadding * 2) / tabs.length;
  
  const slideAnim = useRef(new Animated.Value(tabs.indexOf(activeTab))).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: tabs.indexOf(activeTab),
      useNativeDriver: true,
      bounciness: 0,
      speed: 12,
    }).start();
  }, [activeTab]);

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.activeBackground,
            {
              width: tabWidth,
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, tabs.length - 1],
                  outputRange: [0, tabWidth * (tabs.length - 1)]
                })
              }]
            }
          ]} 
        />
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab;
          
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => onTabChange(tab)}
              activeOpacity={0.8}
            >
              <View style={styles.tabTextContainer}>
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.activeTabText
                  ]}
                >
                  {tab}
                </Text>
                
                {/* Show red dot for unread invitations/active feed */}
                {tab === unreadTab && unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F5', // Soft gray background for the segmented control
    borderRadius: 12,
    padding: 3, // Padding around the pills
    position: 'relative',
  },
  activeBackground: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93', // iOS system gray
  },
  activeTabText: {
    color: Colors.light.text, // Darker text for active
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    paddingHorizontal: 5,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});