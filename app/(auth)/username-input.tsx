import React, { useState, useEffect } from 'react';
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
import { Check, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function UsernameInputScreen() {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();

  // Debounced username checking
  useEffect(() => {
    if (username.length < 3) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        // Simulate API call to check username availability
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Simulate some usernames being taken
        const takenUsernames = ['admin', 'test', 'user', 'free2hang', 'mihkel'];
        const available = !takenUsernames.includes(username.toLowerCase());
        setIsAvailable(available);
      } catch (error) {
        console.error('Error checking username:', error);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleContinue = async () => {
    if (!username.trim()) {
      Alert.alert('Username Required', 'Please enter a username to continue');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Username Too Short', 'Username must be at least 3 characters long');
      return;
    }

    if (!isAvailable) {
      Alert.alert('Username Not Available', 'Please choose a different username');
      return;
    }

    setIsLoading(true);
    try {
      // Here you would save the username to your backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      router.push({
        pathname: '/(auth)/vibe-input',
        params: { name, username: username.trim() }
      });
    } catch (error) {
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

  const getAvailabilityIndicator = () => {
    if (username.length < 3) return null;
    
    if (isChecking) {
      return (
        <View style={styles.checkingContainer}>
          <Text style={styles.checkingText}>checking...</Text>
        </View>
      );
    }

    if (isAvailable === true) {
      return (
        <View style={styles.availableContainer}>
          <Check size={16} color="#4CAF50" />
          <Text style={styles.availableText}>Available</Text>
        </View>
      );
    }

    if (isAvailable === false) {
      return (
        <View style={styles.unavailableContainer}>
          <X size={16} color="#F44336" />
          <Text style={styles.unavailableText}>Unavailable</Text>
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
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Free2Hang</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Create a username</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                maxLength={20}
              />
              
              {getAvailabilityIndicator()}
            </View>

            <TouchableOpacity 
              style={[
                styles.continueButton,
                (!username.trim() || isLoading || !isAvailable) && styles.disabledButton
              ]}
              onPress={handleContinue}
              disabled={!username.trim() || isLoading || !isAvailable}
            >
              <Text style={[
                styles.continueButtonText,
                (!username.trim() || isLoading || !isAvailable) && styles.disabledButtonText
              ]}>
                {isLoading ? 'creating...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardView: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 80,
    marginBottom: 120,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 60,
  },
  inputContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  usernameInput: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    minWidth: 200,
    marginBottom: 16,
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkingText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  availableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  availableText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  unavailableText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: 'white',
    borderRadius: 50,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 40,
  },
  disabledButton: {
    backgroundColor: '#333',
  },
  continueButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#666',
  },
}); 