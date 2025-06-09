import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
} from 'react-native';
import { ArrowLeft, Code } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function EmailSignInScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [devEmails, setDevEmails] = useState<string[]>([]);
  const [loadingDevEmails, setLoadingDevEmails] = useState(false);
  const router = useRouter();

  const handleContinue = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      // Send OTP code via email using Supabase
      console.log('Sending OTP code to:', email.trim());
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
        }
      });

      if (error) {
        throw error;
      }

      // Go to verification screen - user status will be determined after OTP verification
      router.push({
        pathname: '/(auth)/email-verification',
        params: { 
          email: email.trim()
        }
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const loadDevEmails = async () => {
    setLoadingDevEmails(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading dev emails:', error);
        Alert.alert('Error', 'Failed to load developer emails');
        return;
      }

      const emails = data?.map((user: { email: string }) => user.email).filter(Boolean) || [];
      setDevEmails(emails);
    } catch (error) {
      console.error('Error loading dev emails:', error);
      Alert.alert('Error', 'Failed to load developer emails');
    } finally {
      setLoadingDevEmails(false);
    }
  };

  const handleDevSignIn = async (devEmail: string) => {
    setShowDevOptions(false);
    setIsLoading(true);
    try {
      console.log('Dev sign-in for:', devEmail);
      
      // For development, use a known OTP pattern to bypass
      // This sends OTP but immediately directs to verification with auto-verify
      const { data, error } = await supabase.auth.signInWithOtp({
        email: devEmail,
        options: {
          shouldCreateUser: false,
        }
      });

      if (error) {
        throw error;
      }

      // Direct to verification with dev flag for auto-verification
      router.push({
        pathname: '/(auth)/email-verification',
        params: { 
          email: devEmail,
          isDev: 'true'
        }
      });
    } catch (error: any) {
      Alert.alert('Dev Sign-in Error', error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevOptionsPress = () => {
    if (!showDevOptions) {
      loadDevEmails();
    }
    setShowDevOptions(!showDevOptions);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={24} color={Colors.light.text} />
            </TouchableOpacity>
            
            {/* Developer Options Button */}
            {__DEV__ && (
              <TouchableOpacity 
                style={styles.devButton} 
                onPress={handleDevOptionsPress}
              >
                <Code size={20} color={Colors.light.secondaryText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>what's your email?</Text>
            <Text style={styles.subtitle}>
              we'll send you a verification code
            </Text>

            <TextInput
              style={styles.emailInput}
              placeholder="Enter your email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />

            <TouchableOpacity 
              style={[
                styles.continueButton,
                (!email.trim() || isLoading) && styles.disabledButton
              ]}
              onPress={handleContinue}
              disabled={!email.trim() || isLoading}
            >
              <Text style={[
                styles.continueButtonText,
                (!email.trim() || isLoading) && styles.disabledButtonText
              ]}>
                {isLoading ? 'sending code...' : 'continue'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By continuing, you agree to receive emails from Free2Hang
            </Text>
          </View>
        </KeyboardAvoidingView>

        {/* Developer Options Modal */}
        <Modal
          visible={showDevOptions}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDevOptions(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Developer Sign-in</Text>
              <Text style={styles.modalSubtitle}>Choose an existing account:</Text>
              
              {loadingDevEmails ? (
                <Text style={styles.loadingText}>Loading accounts...</Text>
              ) : (
                <ScrollView style={styles.emailList} showsVerticalScrollIndicator={false}>
                  {devEmails.map((devEmail, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.emailItem}
                      onPress={() => handleDevSignIn(devEmail)}
                    >
                      <Text style={styles.emailText}>{devEmail}</Text>
                    </TouchableOpacity>
                  ))}
                  {devEmails.length === 0 && (
                    <Text style={styles.noEmailsText}>No accounts found</Text>
                  )}
                </ScrollView>
              )}
              
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowDevOptions(false)}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 48,
  },
  emailInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 32,
  },
  continueButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    height: 56,
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
  disabledButton: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
  termsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
  devButton: {
    position: 'absolute',
    right: 24,
    top: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    padding: 20,
  },
  emailList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  emailItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    color: Colors.light.text,
    textAlign: 'center',
  },
  noEmailsText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    padding: 20,
  },
  modalCloseButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '600',
  },
}); 