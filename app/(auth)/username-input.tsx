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
        const takenUsernames = ['admin', 'test', 'user', 'freetohang', 'mihkelkk'];
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
          <Check size={16} color={Colors.light.onlineGreen} />
          <Text style={styles.availableText}>Available</Text>
        </View>
      );
    }

    if (isAvailable === false) {
      return (
        <View style={styles.unavailableContainer}>
          <X size={16} color={Colors.light.destructive} />
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
            <View style={styles.logoWrapper}>
              <View style={styles.logoCircles}>
                <View style={styles.logoCircle1} />
                <View style={styles.logoCircle2} />
                <View style={styles.logoCircle3} />
              </View>
            </View>
            <Text style={styles.logoText}>freetohang</Text>
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
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                maxLength={20}
              />
            </View>
            
            {getAvailabilityIndicator()}

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
    backgroundColor: 'white',
  },
  keyboardView: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: 120,
  },
  logoWrapper: {
    marginBottom: 16,
  },
  logoCircles: {
    width: 60,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: -8,
  },
  logoCircle1: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
  },
  logoCircle2: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + '80',
  },
  logoCircle3: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + '40',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
  checkingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  checkingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: '400',
  },
  availableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 6,
  },
  availableText: {
    fontSize: 14,
    color: Colors.light.onlineGreen,
    fontWeight: '600',
  },
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 6,
  },
  unavailableText: {
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