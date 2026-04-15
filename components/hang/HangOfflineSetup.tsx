import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import StatusToggle from '@/components/StatusToggle';
import CachedAvatar from '@/components/CachedAvatar';
import { activities } from '@/constants/mockData';
import Colors from '@/constants/colors';
import { MAX_ACTIVITY_LENGTH } from '@/constants/limits';

type DurationOptionValue = number | 'tonight' | null;

const DURATION_OPTIONS: { label: string; value: DurationOptionValue }[] = [
  { label: 'Forever', value: null },
  { label: 'Till tonight', value: 'tonight' },
  { label: '6 hours', value: 360 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
];

function calculateDurationMinutes(value: number | 'tonight' | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number') return value;

  if (value === 'tonight') {
    const now = new Date();
    const endOfNight = new Date();
    endOfNight.setDate(now.getDate() + 1);
    endOfNight.setHours(4, 0, 0, 0);
    const diffMs = endOfNight.getTime() - now.getTime();
    return Math.round(diffMs / (1000 * 60));
  }

  return null;
}

export interface HangOfflineSetupProps {
  userId?: string;
  userName: string;
  userAvatar: string;
  initialActivity: string;
  onGoOnline: (activity: string, durationMinutes: number | null) => void;
}

const { height: windowHeight } = Dimensions.get('window');

export default function HangOfflineSetup({
  userId,
  userName,
  userAvatar,
  initialActivity,
  onGoOnline,
}: HangOfflineSetupProps) {
  const [activity, setActivity] = useState(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
  const [inputHeight, setInputHeight] = useState(60);
  const [selectedDuration, setSelectedDuration] = useState<number | 'tonight' | null>(null);

  const toggleGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setActivity(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
  }, [initialActivity]);

  useEffect(() => {
    // Toggle glow pulse
    const toggleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(toggleGlow, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(toggleGlow, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    toggleAnimation.start();

    return () => {
      toggleAnimation.stop();
    };
  }, [toggleGlow]);

  const handleActivityChange = (text: string) => {
    setActivity(text.slice(0, MAX_ACTIVITY_LENGTH));
  };

  const submit = useCallback(() => {
    Keyboard.dismiss();
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const finalActivity = activity.trim().slice(0, MAX_ACTIVITY_LENGTH);
    const durationMinutes = calculateDurationMinutes(selectedDuration);
    onGoOnline(finalActivity, durationMinutes);
    setActivity('');
    setInputHeight(60);
    setSelectedDuration(null);
  }, [activity, selectedDuration, onGoOnline]);

  const handleActivitySelect = (activityName: string) => {
    setActivity((prev) => {
      const trimmed = prev.trim();
      const toAdd = trimmed ? `, ${activityName}` : activityName;
      const newText = trimmed + toAdd;
      return newText.slice(0, MAX_ACTIVITY_LENGTH);
    });
  };

  const togglePulseOpacity = toggleGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1]
  });

  const toggleGlowScale = toggleGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1]
  });

  return (
    <View style={[styles.root, { minHeight: windowHeight }]}>
      <View style={styles.content}>
        <View style={styles.heroCenter}>
          <View style={styles.avatarWrapper}>
            <CachedAvatar userId={userId || userName || userAvatar} uri={userAvatar} style={styles.avatarLarge} />
          </View>

          <Text style={styles.heroTitle}>Ready to hang, {userName}?</Text>
          <Text style={styles.heroSubtitle}>
            Go online to see who's free tonight
          </Text>

          <View style={styles.toggleContainer}>
            {/* Multiple animated layers for a soft, diffuse neon glow */}
            <Animated.View 
              style={[
                styles.glowOuter,
                { transform: [{ scale: toggleGlowScale }], opacity: togglePulseOpacity }
              ]}
            />
            <Animated.View 
              style={[
                styles.glowMid,
                { transform: [{ scale: toggleGlowScale }], opacity: togglePulseOpacity }
              ]}
            />
            <Animated.View 
              style={[
                styles.glowCore,
                { transform: [{ scale: toggleGlowScale }], opacity: togglePulseOpacity }
              ]}
            />
            <StatusToggle isOn={false} onToggle={submit} size="large" />
          </View>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>What do you feel like doing?</Text>

            <View style={styles.inputWrap}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputWithCounter,
                  { height: Math.min(140, Math.max(60, inputHeight)) },
                ]}
                value={activity}
                onChangeText={handleActivityChange}
                placeholder="E.g., Coffee, movie night, walk in the park…"
                placeholderTextColor={Colors.light.secondaryText}
                maxLength={MAX_ACTIVITY_LENGTH}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
              />
              <Text
                style={[
                  styles.charCount,
                  activity.length >= MAX_ACTIVITY_LENGTH && styles.charCountLimit,
                ]}
                pointerEvents="none"
              >
                {activity.length}/{MAX_ACTIVITY_LENGTH}
              </Text>
            </View>

            <Text style={styles.chipsLabel}>Quick suggestions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chipsRow}
            >
              {activities.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.chip}
                  onPress={() => handleActivitySelect(item.name)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chipText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.chipsLabel}>How long stay Free to Hang?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chipsRow}
            >
              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.chip, selectedDuration === option.value && styles.chipSelected]}
                  onPress={() => setSelectedDuration(option.value)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedDuration === option.value && styles.chipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    position: 'relative',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroCenter: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  avatarWrapper: {
    marginBottom: 20,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 10,
    paddingVertical: 10, 
  },
  glowCore: {
    position: 'absolute',
    width: 170,
    height: 70,
    borderRadius: 35,
    backgroundColor: `${Colors.light.onlineGreen}25`,
    shadowColor: Colors.light.onlineGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  glowMid: {
    position: 'absolute',
    width: 200,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.light.onlineGreen}12`,
    shadowColor: Colors.light.onlineGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  glowOuter: {
    position: 'absolute',
    width: 240,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${Colors.light.onlineGreen}06`,
  },
  mainCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.3,
    marginBottom: 20,
  },
  inputWrap: {
    position: 'relative',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(224, 224, 224, 0.8)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: Colors.light.text,
    minHeight: 60,
  },
  inputWithCounter: {
    paddingRight: 56,
    paddingBottom: 28,
  },
  charCount: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  charCountLimit: {
    color: Colors.light.secondary,
    fontWeight: '600',
  },
  chipsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.secondaryText,
    marginTop: 4,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingBottom: 12,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(224, 224, 224, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  chipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 60,
  },
});
