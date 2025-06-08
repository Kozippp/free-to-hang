import React, { useState } from 'react';
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
  Image,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    
    try {
      await signIn(email, password);
      // Navigation happens automatically in AuthContext
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Unable to sign in. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    Alert.alert(
      'Apple Sign-In', 
      'Apple authentication is not configured yet. Please use phone number to sign in.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleGoogleSignIn = async () => {
    Alert.alert(
      'Google Sign-In', 
      'Google authentication is not configured yet. Please use phone number to sign in.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleEmailSignIn = () => {
    router.push('/(auth)/email-signin');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.content}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                <View style={styles.logoWrapper}>
                  <View style={styles.logoToggle}>
                    <View style={styles.logoKnob} />
                  </View>
                </View>
                <Text style={styles.logoText}>Free2Hang</Text>
              </View>

              {/* Welcome text */}
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>welcome back</Text>
                <Text style={styles.welcomeSubtitle}>sign in to continue</Text>
              </View>

              {/* Sign in options */}
              <View style={styles.signInOptions}>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity 
                    style={[styles.signInButton, styles.appleButton]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                  >
                    <Text style={styles.appleButtonText}>🍎 Continue with Apple</Text>
                  </TouchableOpacity>
                )}
                
                {Platform.OS === 'android' && (
                  <TouchableOpacity 
                    style={[styles.signInButton, styles.googleButton]}
                    onPress={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <Text style={styles.googleButtonText}>G Continue with Google</Text>
                  </TouchableOpacity>
                )}
                
                            <TouchableOpacity 
              style={[styles.signInButton, styles.emailButton]}
              onPress={handleEmailSignIn}
              disabled={isLoading}
            >
              <Text style={styles.emailButtonText}>✉️ Continue with Email</Text>
            </TouchableOpacity>
              </View>

              {/* Terms */}
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    backgroundColor: Colors.light.primary,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoToggle: {
    width: 60,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  logoKnob: {
    width: 24,
    height: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  signInOptions: {
    gap: 16,
    marginBottom: 32,
  },
  signInButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  appleButton: {
    backgroundColor: '#000',
  },
  appleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  emailButton: {
    backgroundColor: Colors.light.primary,
  },
  emailButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  termsContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  termsText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
}); 