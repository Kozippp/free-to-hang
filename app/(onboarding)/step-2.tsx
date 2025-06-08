import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Check, X, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function UsernameInputScreen() {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const inputRef = useRef<TextInput>(null);

  // Auto focus input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Debounced username checking with reservation system
  useEffect(() => {
    if (username.length < 3) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAvailable(null);
          setIsChecking(false);
          return;
        }

        // Check if username is available using the database function
        const { data, error } = await supabase.rpc('is_username_available', {
          check_username: username.toLowerCase()
        });

        if (error) {
          console.error('Error checking username availability:', error);
          setIsAvailable(null);
        } else {
          setIsAvailable(data);
        }
      } catch (error) {
        console.error('Error checking username availability:', error);
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const isValidUsername = username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
  const canContinue = isValidUsername && isAvailable === true && !isChecking;

  const handleContinue = async () => {
    if (!canContinue) {
      if (!isValidUsername) {
        Alert.alert('Invalid Username', 'Username must be at least 3 characters long and contain only letters, numbers, and underscores.');
      } else if (isAvailable === false) {
        Alert.alert('Username Taken', 'This username is already taken. Please choose a different one.');
      } else if (isChecking) {
        Alert.alert('Please Wait', 'Still checking username availability...');
      }
      return;
    }

    setIsLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in again.');
        setIsLoading(false);
        return;
      }

      // Reserve the username
      const { data: reservationSuccess, error } = await supabase.rpc('reserve_username', {
        reserve_username: username.toLowerCase(),
        reserve_user_id: user.id
      });

      if (error) {
        console.error('Error reserving username:', error);
        Alert.alert('Error', 'Failed to reserve username. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!reservationSuccess) {
        // Username was taken between check and reservation
        Alert.alert('Username Taken', 'This username was just taken by someone else. Please choose a different one.');
        setIsAvailable(false); // Update UI to show it's no longer available
        setIsLoading(false);
        return;
      }

      // Success - username is reserved, proceed to next step
      router.push({
        pathname: '/(onboarding)/step-3',
        params: { name: name!, username: username.toLowerCase() }
      });
    } catch (error: any) {
      console.error('Error in handleContinue:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    // Only allow alphanumeric characters and underscores
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
  };

  const handleBack = () => {
    router.back();
  };

  const getAvailabilityIndicator = () => {
    if (username.length < 3) return null;
    
    if (isChecking) {
      return (
        <View style={styles.indicator}>
          <Text style={styles.checkingText}>Checking...</Text>
        </View>
      );
    }
    
    if (isAvailable === true) {
      return (
        <View style={[styles.indicator, styles.available]}>
          <Check size={16} color={Colors.light.primary} />
          <Text style={styles.availableText}>Available</Text>
        </View>
      );
    }
    
    if (isAvailable === false) {
      return (
        <View style={[styles.indicator, styles.taken]}>
          <X size={16} color="#FF4B55" />
          <Text style={styles.takenText}>Username taken</Text>
        </View>
      );
    }
    
    return null;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header with Logo and Back */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={20} color="#999" />
            </TouchableOpacity>
            <Text style={styles.logoText}>freetohang</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Create a username</Text>

            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.usernameInput}
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="username"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                maxLength={20}
              />
            </View>
            
            {getAvailabilityIndicator()}

            {/* Continue button - positioned above keyboard */}
            {username.length >= 3 && isAvailable && (
              <TouchableOpacity 
                style={[
                  styles.continueButton,
                  isLoading && styles.disabledButton
                ]}
                onPress={handleContinue}
                disabled={isLoading}
              >
                <Text style={[
                  styles.continueButtonText,
                  isLoading && styles.disabledButtonText
                ]}>
                  {isLoading ? 'creating...' : 'Continue'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 60,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  usernameInput: {
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
    height: 60,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 32,
    color: Colors.light.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  indicator: {
    alignItems: 'center',
    marginBottom: 40,
  },
  checkingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: '400',
  },
  available: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  availableText: {
    fontSize: 14,
    color: Colors.light.onlineGreen,
    fontWeight: '600',
  },
  taken: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  takenText: {
    fontSize: 14,
    color: Colors.light.destructive,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 28,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
}); 