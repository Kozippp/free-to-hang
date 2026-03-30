import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  Image,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Sparkles } from 'lucide-react-native';
import StatusToggle from '@/components/StatusToggle';
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
  userName: string;
  userAvatar: string;
  initialActivity: string;
  onGoOnline: (activity: string, durationMinutes: number | null) => void;
}

const { height: windowHeight, width: windowWidth } = Dimensions.get('window');

export default function HangOfflineSetup({
  userName,
  userAvatar,
  initialActivity,
  onGoOnline,
}: HangOfflineSetupProps) {
  const [activity, setActivity] = useState(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
  const [inputHeight, setInputHeight] = useState(60);
  const [selectedDuration, setSelectedDuration] = useState<number | 'tonight' | null>(null);

  // Animation values for gradient
  const animatedValue = useRef(new Animated.Value(0)).current;
  const toggleGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setActivity(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
  }, [initialActivity]);

  useEffect(() => {
    // Gradient animation loop
    const gradientAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: false,
        }),
      ])
    );

    // Toggle glow pulse
    const toggleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(toggleGlow, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(toggleGlow, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );

    gradientAnimation.start();
    toggleAnimation.start();

    return () => {
      gradientAnimation.stop();
      toggleAnimation.stop();
    };
  }, [animatedValue, toggleGlow]);

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

  const gradientColors1 = animatedValue.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [
      'rgba(173, 216, 255, 0.2)',  // blue
      'rgba(255, 192, 203, 0.2)',  // pink
      'rgba(216, 191, 216, 0.2)',  // lavender
      'rgba(173, 216, 255, 0.2)'   // back to blue
    ]
  });

  const gradientColors2 = animatedValue.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [
      'rgba(255, 218, 185, 0.15)',  // peach
      'rgba(216, 191, 216, 0.15)',  // lavender
      'rgba(173, 216, 255, 0.15)',  // blue
      'rgba(255, 192, 203, 0.15)'   // pink
    ]
  });

  const toggleGlowOpacity = toggleGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1]
  });

  const toggleGlowScale = toggleGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05]
  });

  return (
    <View style={[styles.root, { minHeight: windowHeight }]}>
      {/* Absolute Animated Gradient Background */}
      <Animated.View style={[styles.gradientBackground, { backgroundColor: gradientColors1 }]}>
        <Animated.View style={[styles.gradientOverlay, { backgroundColor: gradientColors2 }]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.5)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientOverlay}
          />
        </Animated.View>
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
            <View style={styles.heroTextContent}>
              <Text style={styles.heroEyebrow}>Free to hang</Text>
              <Text style={styles.heroTitle}>Hey, {userName}</Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>
            Let friends see you're free and discover who's up for plans tonight.
          </Text>
        </View>

        {/* Central Toggle Action */}
        <View style={styles.toggleWrapper}>
          <Text style={styles.toggleInstruction}>Ready to hang?</Text>
          <Animated.View 
            style={[
              styles.toggleGlowContainer,
              {
                opacity: toggleGlowOpacity,
                transform: [{ scale: toggleGlowScale }]
              }
            ]}
          >
            <View style={styles.toggleGlowEffect} />
          </Animated.View>
          <View style={styles.toggleComponentWrap}>
            <StatusToggle isOn={false} onToggle={submit} size="large" />
          </View>
          <Text style={styles.toggleHint}>Slide to go online</Text>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.formSection}>
            <View style={styles.sectionHeaderRow}>
              <Sparkles size={20} color={Colors.light.primary} style={styles.sparkleIcon} />
              <Text style={styles.sectionHeading}>What do you feel like doing?</Text>
            </View>
            <Text style={styles.sectionSub}>
              Optional — let friends know your vibe for tonight.
            </Text>

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

            <Text style={styles.chipsLabel}>How long stay visible?</Text>
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
    // Make sure we have no hidden overflows so the gradient can bleed if needed
  },
  gradientBackground: {
    position: 'absolute',
    top: -500, // Extend well beyond the safe area bounds
    left: -500,
    right: -500,
    bottom: -500,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  hero: {
    paddingVertical: 16,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  heroTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.light.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.secondaryText,
    fontWeight: '500',
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
    paddingTop: 24,
    paddingBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sparkleIcon: {
    marginTop: -2,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.secondaryText,
    marginBottom: 20,
  },
  inputWrap: {
    position: 'relative',
    marginBottom: 20,
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
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.secondaryText,
    marginTop: 8,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingBottom: 8,
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
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  toggleInstruction: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  toggleGlowContainer: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    width: 140,
    height: 80,
    zIndex: 0,
  },
  toggleGlowEffect: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 40,
    opacity: 0.25,
    filter: [{ blur: 20 }] as any, // Web/newer RN shadow fallback
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  toggleComponentWrap: {
    zIndex: 1,
    transform: [{ scale: 1.2 }], // Make it nicely prominent
    marginBottom: 24,
  },
  toggleHint: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.secondaryText,
    letterSpacing: 0.2,
  },
  bottomSpacer: {
    height: 60,
  },
});
