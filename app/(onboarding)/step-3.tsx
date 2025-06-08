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
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.completedStep]} />
              <View style={[styles.progressStep, styles.completedStep]} />
              <View style={[styles.progressStep, styles.activeStep]} />
            </View>
            <Text style={styles.progressText}>Step 3 of 3</Text>
          </View>

          {/* Navigation buttons */}
          <View style={styles.navigationContainer}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={20} color={Colors.light.secondaryText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipForNow}>
              <Text style={styles.skipText}>skip</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Users size={60} color={Colors.light.primary} />
            </View>
            
            <Text style={styles.title}>invite your friends</Text>
            <Text style={styles.subtitle}>
              free2hang is way more fun with friends! 
            </Text>
            <Text style={styles.funnyText}>
              (seriously, it's pretty useless without them 😅)
            </Text>

            {/* Search for existing users */}
            <View style={styles.searchContainer}>
              <Text style={styles.sectionTitle}>Find friends already on Free2Hang</Text>
              <View style={styles.searchBox}>
                <Search size={20} color={Colors.light.secondaryText} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by username or email"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={handleSearchContacts}
                />
              </View>
              <TouchableOpacity 
                style={styles.searchButton} 
                onPress={handleSearchContacts}
              >
                <UserPlus size={20} color={Colors.light.primary} />
                <Text style={styles.searchButtonText}>Search Users</Text>
              </TouchableOpacity>
            </View>

            {/* Invite via sharing */}
            <View style={styles.inviteContainer}>
              <Text style={styles.sectionTitle}>Invite friends to join</Text>
              <Text style={styles.inviteDescription}>
                Share Free2Hang with your friends so they can join you!
              </Text>
              
              <TouchableOpacity 
                style={styles.inviteButton} 
                onPress={handleInviteFriends}
              >
                <Share2 size={20} color="white" />
                <Text style={styles.inviteButtonText}>Invite Friends</Text>
              </TouchableOpacity>
            </View>

            {/* Alternative contact options */}
            <View style={styles.alternativeContainer}>
              <Text style={styles.alternativeText}>
                You can also invite friends later from your profile
              </Text>
            </View>

            {/* Finish button */}
            <TouchableOpacity 
              style={styles.finishButton}
              onPress={handleFinishOnboarding}
            >
              <Text style={styles.finishButtonText}>
                Let's Get Started!
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
  progressContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressStep: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
  },
  activeStep: {
    backgroundColor: Colors.light.primary,
  },
  completedStep: {
    backgroundColor: Colors.light.primary,
  },
  progressText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
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
  searchContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${Colors.light.primary}15`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    gap: 8,
    alignSelf: 'flex-start',
  },
  searchButtonText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  inviteContainer: {
    marginBottom: 30,
  },
  inviteDescription: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 16,
    lineHeight: 20,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  alternativeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  alternativeText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
  finishButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
}); 