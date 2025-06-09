import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function EmailVerificationScreen() {
  const { email, isDev } = useLocalSearchParams<{ 
    email: string;
    isDev?: string;
  }>();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<TextInput[]>([]);
  const router = useRouter();

  // Auto-focus first input when component mounts OR auto-verify for dev
  useEffect(() => {
    if (isDev === 'true') {
      // Auto-verify for development with a dummy code
      const timer = setTimeout(() => {
        handleDevVerify();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDev]);

  // Start resend timer on mount
  useEffect(() => {
    setResendTimer(60);
    const timer = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    // Handle pasted code
    if (text.length > 1) {
      const pastedCode = text.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setCode(newCode);
      
      // Auto-verify if 6 digits pasted
      if (pastedCode.length === 6) {
        handleVerify(pastedCode.join(''));
      } else {
        // Focus next empty input
        const nextIndex = pastedCode.length < 6 ? pastedCode.length : 5;
        inputRefs.current[nextIndex]?.focus();
      }
      return;
    }

    // Handle single digit input
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when 6 digits entered
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    if (!email) {
      Alert.alert('Error', 'Email address is missing');
      return;
    }

    setIsLoading(true);
    try {
      // Verify the OTP with Supabase
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: codeToVerify,
        type: 'email'
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        console.log('OTP verified successfully, AuthContext will handle navigation');
        // AuthContext will automatically handle navigation based on user's onboarding status
        // No need to navigate manually here
      } else {
        throw new Error('Verification failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid verification code. Please try again.');
      // Clear the code inputs
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0 || !email) return;

    try {
      // Resend the OTP
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
        }
      });

      if (error) {
        throw error;
      }
      
      Alert.alert('Code Sent', 'A new verification code has been sent to your email');
      setResendTimer(60);
      
      // Restart timer
      const timer = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code. Please try again.');
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleDevVerify = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address is missing');
      return;
    }

    setIsLoading(true);
    try {
      // Try common development OTP codes
      const devCodes = ['123456', '000000', '111111'];
      
      for (const code of devCodes) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            email: email,
            token: code,
            type: 'email'
          });

          if (!error && data.user) {
            console.log('Dev auto-verify successful with code:', code);
            // Let AuthContext handle navigation
            return;
          }
        } catch (devError) {
          // Continue to next code
          continue;
        }
      }
      
      // If all dev codes fail, show alert
      Alert.alert(
        'Developer Mode', 
        'Auto-verification failed. Please check your email for the OTP code or try signing in normally.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Dev verification error:', error);
      Alert.alert('Error', error.message || 'Development verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatEmail = (email: string) => {
    if (email.length > 20) {
      return email.substring(0, 10) + '...' + email.substring(email.indexOf('@'));
    }
    return email;
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
              <ArrowLeft size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>enter the code</Text>
            <Text style={styles.subtitle}>
              we sent a 6-digit code to{'\n'}
              <Text style={styles.emailText}>{formatEmail(email || '')}</Text>
              {'\n\n'}
              <Text style={styles.hintText}>You can also click the link in the email if available</Text>
            </Text>

            {/* Code input */}
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={ref => { inputRefs.current[index] = ref!; }}
                  style={[
                    styles.codeInput,
                    digit && styles.codeInputFilled
                  ]}
                  value={digit}
                  onChangeText={text => handleCodeChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={6} // Allow paste of full code
                  selectTextOnFocus
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                />
              ))}
            </View>

            {/* Resend */}
            <View style={styles.resendContainer}>
              {resendTimer > 0 ? (
                <Text style={styles.resendTimer}>
                  resend code in {resendTimer}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendCode}>
                  <Text style={styles.resendButton}>resend code</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Manual verify button (hidden when auto-verifying) */}
          {code.join('').length === 6 && (
            <View style={styles.verifyContainer}>
              <TouchableOpacity 
                style={[styles.verifyButton, isLoading && styles.disabledButton]}
                onPress={() => handleVerify()}
                disabled={isLoading}
              >
                <Text style={styles.verifyButtonText}>
                  {isLoading ? 'verifying...' : 'verify'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
    color: Colors.light.text,
  },
  hintText: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '400',
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.light.text,
  },
  codeInputFilled: {
    backgroundColor: Colors.light.primary + '20',
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendTimer: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  resendButton: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  verifyContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  verifyButton: {
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
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 