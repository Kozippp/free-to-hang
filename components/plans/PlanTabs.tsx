import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

interface PlanTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  controlBadge?: number;
  chatBadge?: number;
  customTabs?: string[];
  scrollX?: Animated.Value; // New prop for animation
}

export default function PlanTabs({ 
  activeTab, 
  onTabChange, 
  controlBadge = 0, 
  chatBadge = 0, 
  customTabs,
  scrollX 
}: PlanTabsProps) {
  const tabs = customTabs || ['Control Panel', 'Chat'];
  const { width } = Dimensions.get('window');
  const tabWidth = width / tabs.length;
  
  // Indicator animation
  // If scrollX is provided (totalX from parent, 0 to -width), we interpolate it
  // 0 (CP) -> 0
  // -width (Chat) -> tabWidth
  const indicatorTranslateX = scrollX ? scrollX.interpolate({
    inputRange: [-width, 0],
    outputRange: [tabWidth, 0],
    extrapolate: 'clamp' // Don't move indicator for exit swipe
  }) : new Animated.Value(activeTab === tabs[1] ? tabWidth : 0);

  // If no scrollX provided, we might want to animate based on activeTab (fallback)
  const fallbackAnim = useRef(new Animated.Value(activeTab === tabs[1] ? 1 : 0)).current;
  
  useEffect(() => {
    if (!scrollX) {
      Animated.spring(fallbackAnim, {
        toValue: activeTab === tabs[1] ? 1 : 0,
        useNativeDriver: true,
      }).start();
    }
  }, [activeTab, scrollX]);

  const finalIndicatorX = scrollX ? indicatorTranslateX : fallbackAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth]
  });
  
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
          <View style={styles.tabContent}>
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText
              ]}
            >
              {tab}
            </Text>
            
            {tab === 'Chat' && chatBadge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {chatBadge > 99 ? '99+' : chatBadge}
                </Text>
              </View>
            )}

            {tab === 'Control Panel' && controlBadge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {controlBadge > 99 ? '99+' : controlBadge}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
      
      <Animated.View 
        style={[
          styles.indicator, 
          { width: tabWidth, transform: [{ translateX: finalIndicatorX }] }
        ]} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    position: 'relative', // Needed for absolute indicator
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
    zIndex: 1, // Text above indicator
  },
  activeTab: {
    backgroundColor: 'transparent',
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
    height: 2,
    backgroundColor: Colors.light.primary,
    zIndex: 0,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: Colors.light.secondary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});