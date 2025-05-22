import React from 'react';
import { StyleSheet, View, Text, Pressable, Animated } from 'react-native';
import Colors from '@/constants/colors';
import { useRef, useEffect } from 'react';

interface StatusToggleProps {
  isOn: boolean;
  onToggle: () => void;
  size?: 'small' | 'large';
  hideText?: boolean;
}

export default function StatusToggle({ isOn, onToggle, size = 'large', hideText = false }: StatusToggleProps) {
  const translateX = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: isOn ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [isOn, translateX]);
  
  const toggleSize = size === 'large' ? styles.largeToggle : styles.smallToggle;
  const thumbSize = size === 'large' ? styles.largeThumb : styles.smallThumb;
  const textStyle = size === 'large' ? styles.largeText : styles.smallText;
  
  // Only use increased width for the offline toggle (when isOn is false and size is large)
  const trackWidth = size === 'large' && !isOn ? 160 : size === 'large' ? 120 : 70;
  const thumbWidth = size === 'large' ? 60 : 35;
  
  // Adjust the translation distance to keep the thumb inside the track
  const translateDistance = trackWidth - thumbWidth - 8; // 8px padding to keep thumb inside track
  
  return (
    <Pressable onPress={onToggle}>
      <View style={[
        styles.toggleContainer, 
        toggleSize,
        isOn ? styles.toggleOn : styles.toggleOff,
        // Apply custom width
        { width: trackWidth }
      ]}>
        <Animated.View 
          style={[
            styles.thumb, 
            thumbSize,
            { 
              width: thumbWidth,
              transform: [{ translateX: translateX.interpolate({
                inputRange: [0, 1],
                outputRange: [4, translateDistance], // Start at 4px to keep inside track
              }) }] 
            }
          ]}
        >
          {!hideText && (
            <Text style={[textStyle, isOn ? styles.textOn : styles.textOff]}>
              {isOn ? 'Online' : 'Offline'}
            </Text>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggleContainer: {
    borderRadius: 30,
    padding: 4,
    justifyContent: 'center',
  },
  largeToggle: {
    height: 60,
  },
  smallToggle: {
    height: 30,
  },
  toggleOn: {
    backgroundColor: Colors.light.onlineGreen,
  },
  toggleOff: {
    backgroundColor: Colors.light.offlineGray,
  },
  thumb: {
    borderRadius: 28,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  largeThumb: {
    height: 52,
  },
  smallThumb: {
    height: 22,
  },
  largeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 10,
    fontWeight: '600',
  },
  textOn: {
    color: Colors.light.onlineGreen,
  },
  textOff: {
    color: Colors.light.offlineGray,
  },
});