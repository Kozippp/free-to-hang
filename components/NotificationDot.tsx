import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NotificationDotProps {
  count?: number;
  showCount?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: object;
}

export default function NotificationDot({ 
  count = 0, 
  showCount = false, 
  size = 'small', 
  style 
}: NotificationDotProps) {
  // Kui pole teavitusi, ära näita midagi
  if (count === 0) return null;
  
  const sizeConfig = {
    small: { width: 7, height: 7, borderRadius: 3.5, fontSize: 10 },
    medium: { width: 12, height: 12, borderRadius: 6, fontSize: 10 },
    large: { width: 18, height: 18, borderRadius: 9, fontSize: 12 },
  };
  
  const config = sizeConfig[size];
  
  return (
    <View 
      style={[
        styles.dot,
        {
          width: showCount && count > 9 ? config.width + 8 : config.width,
          height: config.height,
          borderRadius: config.borderRadius,
          minWidth: config.width,
        },
        style
      ]}
    >
      {showCount && count > 0 && (
        <Text 
          style={[
            styles.countText, 
            { fontSize: config.fontSize }
          ]}
        >
          {count > 99 ? '99+' : count.toString()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: '#FF3B30', // Instagram-stiilis punane
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  countText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
}); 