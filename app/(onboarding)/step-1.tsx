import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Heart, MapPin, Coffee, Music, Camera, Users, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function OnboardingStep1Screen() {
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const interests = [
    { id: 'outdoor', label: 'Outdoor Adventures', icon: MapPin },
    { id: 'food', label: 'Food & Drinks', icon: Coffee },
    { id: 'music', label: 'Music & Concerts', icon: Music },
    { id: 'culture', label: 'Culture & Arts', icon: Camera },
    { id: 'sports', label: 'Sports & Fitness', icon: Heart },
    { id: 'social', label: 'Social Events', icon: Users },
  ];

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev => 
      prev.includes(interestId) 
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleContinue = async () => {
    if (!user || isLoading) return;

    setIsLoading(true);
    try {
      // Save bio and interests to user profile
      const interestsString = selectedInterests.join(',');
      
      const { error } = await supabase
        .from('users')
        .update({ 
          bio: bio.trim() || null,
          // Store interests in bio for now, later we can create separate interests table
          interests: interestsString
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving profile:', error);
        Alert.alert('Error', 'Failed to save your profile. Please try again.');
        return;
      }

      router.push('/(onboarding)/step-2');
    } catch (error) {
      console.error('Error in handleContinue:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/step-2');
  };

  const handleBack = () => {
    // Go back to sign-in or previous screen
    router.replace('/(tabs)');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Header with progress and navigation */}
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <ArrowLeft size={24} color={Colors.light.secondaryText} />
              </TouchableOpacity>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressStep, styles.activeStep]} />
                  <View style={styles.progressStep} />
                  <View style={styles.progressStep} />
                </View>
              </View>
              
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>skip</Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>what's your vibe?</Text>
              <Text style={styles.subtitle}>
                tell us your favorite vibe for hanging out
              </Text>

              {/* Interests selection */}
              <View style={styles.interestsContainer}>
                {interests.map((interest) => {
                  const Icon = interest.icon;
                  const isSelected = selectedInterests.includes(interest.id);
                  
                  return (
                    <TouchableOpacity
                      key={interest.id}
                      style={[
                        styles.interestCard,
                        isSelected && styles.selectedInterestCard
                      ]}
                      onPress={() => toggleInterest(interest.id)}
                    >
                      <Icon 
                        size={24} 
                        color={isSelected ? Colors.light.primary : Colors.light.secondaryText} 
                      />
                      <Text style={[
                        styles.interestText,
                        isSelected && styles.selectedInterestText
                      ]}>
                        {interest.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Vibe input */}
              <View style={styles.vibeContainer}>
                <Text style={styles.vibeLabel}>
                  describe your perfect hangout vibe
                </Text>
                <TextInput
                  style={styles.vibeInput}
                  placeholder="Chill coffee talks, spontaneous adventures, cozy movie nights..."
                  multiline
                  numberOfLines={3}
                  value={bio}
                  onChangeText={setBio}
                  maxLength={120}
                  textAlignVertical="top"
                />
                <Text style={styles.characterCount}>{bio.length}/120</Text>
              </View>

              {/* Continue button */}
              <TouchableOpacity 
                style={[
                  styles.continueButton,
                  (selectedInterests.length === 0 || isLoading) && styles.disabledButton
                ]}
                onPress={handleContinue}
                disabled={selectedInterests.length === 0 || isLoading}
              >
                <Text style={[
                  styles.continueButtonText,
                  (selectedInterests.length === 0 || isLoading) && styles.disabledButtonText
                ]}>
                  {isLoading ? 'saving...' : 'continue'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 40,
    marginBottom: 30,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    maxWidth: 120,
  },
  progressStep: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  activeStep: {
    backgroundColor: Colors.light.primary,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  content: {
    flex: 1,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
  },
  interestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: Colors.light.buttonBackground,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 8,
  },
  selectedInterestCard: {
    backgroundColor: `${Colors.light.primary}15`,
    borderColor: Colors.light.primary,
  },
  interestText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  selectedInterestText: {
    color: Colors.light.primary,
    fontWeight: '500',
  },
  vibeContainer: {
    marginBottom: 40,
  },
  vibeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 12,
  },
  vibeInput: {
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  characterCount: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    textAlign: 'right',
    marginTop: 8,
  },
  continueButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#E5E5E5',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  disabledButtonText: {
    color: Colors.light.secondaryText,
  },
}); 