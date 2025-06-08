import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView,
  Alert
} from 'react-native';
import { Mail, RefreshCw, ArrowLeft } from 'lucide-react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function EmailConfirmationScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendConfirmation } = useAuth();

  const handleResendConfirmation = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address is missing');
      return;
    }

    setIsLoading(true);
    
    try {
      await resendConfirmation(email);
      Alert.alert('Success!', 'Confirmation email has been sent again. Please check your inbox.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred while sending the email. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignUp = () => {
    router.back();
  };

  const handleBackToSignIn = () => {
    router.push('/(auth)/sign-in');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Back button in top left corner */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackToSignUp}
        >
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Mail size={80} color={Colors.light.primary} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Check your email</Text>
          
          {/* Description */}
          <Text style={styles.description}>
            We sent a confirmation link to:
          </Text>
          <Text style={styles.email}>{email}</Text>
          
          <Text style={styles.description}>
            Please click the link in your email to confirm your email address. If you can't find the email, also check your spam folder.
          </Text>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.resendButton, isLoading && styles.buttonDisabled]}
              onPress={handleResendConfirmation}
              disabled={isLoading}
            >
              <RefreshCw 
                size={20} 
                color={Colors.light.primary} 
                style={isLoading ? { marginRight: 8, opacity: 0.6 } : { marginRight: 8 }} 
              />
              <Text style={[styles.resendButtonText, isLoading && { opacity: 0.6 }]}>
                {isLoading ? 'Sending...' : 'Resend Email'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleBackToSignIn}
            >
              <Text style={styles.signInButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Help text */}
          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              If you're having trouble, please contact us or try again later.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 1,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 32,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 12,
    height: 56,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  signInButtonText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  helpContainer: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  helpText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 