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
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Animated
} from 'react-native';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();
  
  // Animated gradient
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const createAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: false,
          }),
        ])
      );
    };
    
    const animation = createAnimation();
    animation.start();
    
    return () => animation.stop();
  }, []);

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

  const animatedColors = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      'rgba(173, 216, 255, 0.3)', // Light baby blue
      'rgba(255, 192, 203, 0.3)', // Light baby pink  
      'rgba(173, 216, 255, 0.3)'  // Back to light baby blue
    ]
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.gradientBackground, { backgroundColor: animatedColors }]}>
          <LinearGradient
            colors={['rgba(173, 216, 255, 0.15)', 'rgba(255, 192, 203, 0.15)', 'rgba(173, 216, 255, 0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientOverlay}
          />
        </Animated.View>
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.content}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                <Image 
                  source={require('@/assets/images/Logo ready.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              {/* Welcome text */}
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>See who's down to hang 👋</Text>
                <Text style={styles.welcomeSubtitle}>One tap to show you're free — and see which friends are too.</Text>
              </View>

              {/* Sign in options */}
              <View style={styles.signInOptions}>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity 
                    style={[styles.signInButton, styles.appleButton]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                  >
                    <View style={styles.buttonContent}>
                      <Image 
                        source={require('@/assets/images/Apple_logo_white.svg.png')} 
                        style={styles.appleIconImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.appleButtonText}>Continue with Apple</Text>
                    </View>
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
              <View style={styles.buttonContent}>
                <Mail size={20} color="white" />
                <Text style={styles.emailButtonText}>Continue with Email</Text>
              </View>
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
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  gradientOverlay: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    zIndex: 2,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoImage: {
    width: 280,
    height: 110,
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
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  appleIconImage: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
}); 