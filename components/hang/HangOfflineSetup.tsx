import React, { useState, useEffect, useCallback } from 'react';
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

export default function HangOfflineSetup({
  userName,
  userAvatar,
  initialActivity,
  onGoOnline,
}: HangOfflineSetupProps) {
  const [activity, setActivity] = useState(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
  const [inputHeight, setInputHeight] = useState(60);
  const [selectedDuration, setSelectedDuration] = useState<number | 'tonight' | null>(null);

  useEffect(() => {
    setActivity(initialActivity.slice(0, MAX_ACTIVITY_LENGTH));
  }, [initialActivity]);

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

  return (
    <View style={styles.root}>
        <LinearGradient
          colors={[`${Colors.light.primary}14`, `${Colors.light.primary}06`, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroGradient}
        />

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Sparkles size={22} color={Colors.light.primary} strokeWidth={2} />
          </View>
          <Text style={styles.heroEyebrow}>Hang</Text>
          <Text style={styles.heroTitle}>Hey, {userName}</Text>
          <Text style={styles.heroSubtitle}>
            Let friends see you&apos;re free and discover who&apos;s up for plans tonight — all in one
            place.
          </Text>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.toggleSection}>
            <View style={styles.toggleRow}>
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Free to hang</Text>
                <Text style={styles.toggleHint}>
                  Turn on when you&apos;re ready — same as &quot;I&apos;m ready&quot; below.
                </Text>
              </View>
              <StatusToggle isOn={false} onToggle={submit} />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>What do you feel like doing?</Text>
            <Text style={styles.sectionSub}>
              Optional — add a vibe so friends know what you&apos;re in the mood for.
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

            <TouchableOpacity style={styles.cta} onPress={submit} activeOpacity={0.9}>
              <Text style={styles.ctaText}>I&apos;m ready to hang</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 220,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: `${Colors.light.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${Colors.light.primary}20`,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.light.primary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    maxWidth: 340,
    fontWeight: '400',
  },
  mainCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.light.background,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
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
  toggleSection: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: Colors.light.cardBackground,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 0,
  },
  toggleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  toggleHint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.light.secondaryText,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.border,
    marginHorizontal: 20,
  },
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  sectionSub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.secondaryText,
    marginBottom: 16,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: Colors.light.cardBackground,
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
    fontWeight: '600',
    color: Colors.light.secondaryText,
    marginTop: 18,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingBottom: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.buttonBackground,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cta: {
    marginTop: 22,
    backgroundColor: Colors.light.primary,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bottomSpacer: {
    height: 32,
  },
});
