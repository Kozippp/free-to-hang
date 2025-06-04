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
  const { signIn } = useAuth(); // Removed OAuth methods since they need proper setup

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

  const handleOAuthNotAvailable = (provider: string) => {
    Alert.alert(
      `${provider} Sign-In`, 
      `${provider} authentication is not configured yet. Please use email and password to sign in.`,
      [{ text: 'OK', style: 'default' }]
    );
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

              {/* Sign in form */}
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Mail size={20} color={Colors.light.secondaryText} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Lock size={20} color={Colors.light.secondaryText} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={Colors.light.secondaryText} />
                    ) : (
                      <Eye size={20} color={Colors.light.secondaryText} />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.signInButton, isLoading && styles.buttonDisabled]}
                  onPress={handleSignIn}
                  disabled={isLoading}
                >
                  <Text style={styles.signInButtonText}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* OAuth Section - Currently disabled in development */}
              <View style={styles.oauthSection}>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>
                
                <View style={styles.oauthButtons}>
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity 
                      style={[styles.oauthButton, styles.appleButton, styles.disabledButton]}
                      onPress={() => handleOAuthNotAvailable('Apple')}
                    >
                      <Text style={styles.appleButtonText}>🍎 Sign in with Apple</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={[styles.oauthButton, styles.googleButton, styles.disabledButton]}
                    onPress={() => handleOAuthNotAvailable('Google')}
                  >
                    <Text style={styles.googleButtonText}>G Sign in with Google</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.oauthNote}>
                  OAuth providers require additional setup for production use
                </Text>
              </View>

              {/* Sign up link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/sign-up' as any)}>
                  <Text style={styles.signUpLink}>Sign Up</Text>
                </TouchableOpacity>
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
    backgroundColor: Colors.light.background,
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
    marginBottom: 30,
  },
  logoWrapper: {
    marginBottom: 16,
  },
  logoToggle: {
    width: 60,
    height: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    position: 'relative',
  },
  logoKnob: {
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    position: 'absolute',
    top: 5,
    left: 5,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  eyeIcon: {
    padding: 4,
  },
  signInButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  forgotPassword: {
    alignSelf: 'center',
  },
  forgotPasswordText: {
    fontSize: 16,
    color: Colors.light.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  signUpLink: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  oauthSection: {
    marginBottom: 32,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.secondaryText,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  oauthButtons: {
    gap: 12,
    marginBottom: 12,
  },
  oauthButton: {
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleButton: {
    backgroundColor: Colors.light.appleButton,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  googleButton: {
    backgroundColor: Colors.light.googleButton,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.5,
  },
  oauthNote: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 