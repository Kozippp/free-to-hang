import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Users, Search, UserPlus, Share2, Smartphone, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function OnboardingStep3Screen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const router = useRouter();
  const { user } = useAuth();

  const handleInviteFriends = async () => {
    try {
      const result = await Share.share({
        message: `Hey! I'm using Free2Hang to organize hangouts with friends. Join me here: https://freetohang.com/download`,
        title: 'Join me on Free2Hang!',
      });
      
      if (result.action === Share.sharedAction) {
        Alert.alert('Great!', 'Thanks for sharing Free2Hang with your friends!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleSearchContacts = () => {
    // This would search for existing users by username/email
    // For now, just show a placeholder
    Alert.alert('Coming Soon', 'User search functionality will be available soon!');
  };

  const handleFinishOnboarding = async () => {
    if (!user) return;

    try {
      // TEMPORARY: Skip database update until migration is run
      // TODO: Uncomment this after running the onboarding database migration
      /*
      const { error } = await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (error) {
        console.error('Error completing onboarding:', error);
        Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
        return;
      }
      */

      // For now, just navigate to main app
      console.log('Onboarding completed successfully (temporary mode)');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error in handleFinishOnboarding:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleSkipForNow = () => {
    Alert.alert(
      'Skip for now?',
      'Free2Hang is much more fun with friends! You can always invite them later from your profile.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Skip for Now', onPress: handleFinishOnboarding },
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header with progress and navigation */}
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressStep, styles.completedStep]} />
                <View style={[styles.progressStep, styles.completedStep]} />
                <View style={[styles.progressStep, styles.activeStep]} />
              </View>
            </View>
            
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipForNow}>
              <Text style={styles.skipText}>skip</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Users size={60} color={Colors.light.primary} />
            </View>
            
            <Text style={styles.title}>invite friends</Text>
            <Text style={styles.subtitle}>
              free2hang is way more fun with friends! 
            </Text>
            <Text style={styles.funnyText}>
              (seriously, it's pretty useless without them 😅)
            </Text>

            {/* Invite options */}
            <View style={styles.inviteOptionsContainer}>
              <TouchableOpacity 
                style={styles.primaryInviteButton} 
                onPress={handleInviteFriends}
              >
                <View style={styles.inviteIconContainer}>
                  <Share2 size={20} color="white" />
                </View>
                <Text style={styles.primaryInviteText}>Share with Friends</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.secondaryInviteButton} 
                onPress={handleSearchContacts}
              >
                <View style={styles.searchIconContainer}>
                  <Search size={20} color={Colors.light.primary} />
                </View>
                <Text style={styles.secondaryInviteText}>Find Friends</Text>
              </TouchableOpacity>
            </View>

            {/* Alternative text */}
            <Text style={styles.alternativeText}>
              You can always invite friends later from your profile
            </Text>

            {/* Finish button */}
            <TouchableOpacity 
              style={styles.finishButton}
              onPress={handleFinishOnboarding}
            >
              <Text style={styles.finishButtonText}>
                let's get started!
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  completedStep: {
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
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
    lineHeight: 22,
  },
  funnyText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 40,
    fontStyle: 'italic',
  },
  inviteOptionsContainer: {
    gap: 12,
    marginBottom: 40,
  },
  primaryInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    gap: 12,
  },
  inviteIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryInviteText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  secondaryInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    gap: 12,
  },
  searchIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.light.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryInviteText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  alternativeText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  finishButton: {
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
  finishButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
}); 