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
  
  // Animated toggle glow
  const toggleGlow = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Gradient animation - slower
    const createGradientAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 8000,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 8000,
            useNativeDriver: false,
          }),
        ])
      );
    };
    
    // Toggle glow animation
    const createToggleAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(toggleGlow, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(toggleGlow, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      );
    };
    
    const gradientAnimation = createGradientAnimation();
    const toggleAnimation = createToggleAnimation();
    
    gradientAnimation.start();
    toggleAnimation.start();
    
    return () => {
      gradientAnimation.stop();
      toggleAnimation.stop();
    };
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

  const gradientColors1 = animatedValue.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [
      'rgba(173, 216, 255, 0.4)',  // blue
      'rgba(255, 192, 203, 0.4)',  // pink
      'rgba(216, 191, 216, 0.4)',  // lavender
      'rgba(173, 216, 255, 0.4)'   // back to blue
    ]
  });

  const gradientColors2 = animatedValue.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [
      'rgba(255, 218, 185, 0.3)',  // peach
      'rgba(216, 191, 216, 0.3)',  // lavender
      'rgba(173, 216, 255, 0.3)',  // blue
      'rgba(255, 192, 203, 0.3)'   // pink
    ]
  });

  const toggleGlowOpacity = toggleGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1]
  });

  const toggleGlowScale = toggleGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05]
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.gradientBackground, { backgroundColor: gradientColors1 }]}>
          <Animated.View style={[styles.gradientOverlay, { backgroundColor: gradientColors2 }]}>
            <LinearGradient
              colors={['transparent', 'rgba(255, 255, 255, 0.05)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientOverlay}
            />
          </Animated.View>
        </Animated.View>
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.content}>
              {/* Brand Logo */}
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}></Text> //free to hang käib siia
              </View>

              {/* Toggle */}
              <Animated.View 
                style={[
                  styles.toggleWrapper,
                  {
                    opacity: toggleGlowOpacity,
                    transform: [{ scale: toggleGlowScale }]
                  }
                ]}
              >
                <View style={styles.toggleBackground}>
                  <Animated.View style={[styles.toggleKnob, { opacity: toggleGlowOpacity }]} />
                </View>
              </Animated.View>

              {/* Welcome text */}
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>See who's free to hang</Text>
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
    paddingTop: 120,
    zIndex: 2,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    zIndex: 3,
  },
  toggleWrapper: {
    alignSelf: 'center',
    marginTop: -50,
    marginBottom: 48,
    shadowColor: Colors.light.onlineGreen,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  toggleBackground: {
    width: 96,
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  toggleKnob: {
    width: 38,
    height: 38,
    backgroundColor: Colors.light.onlineGreen,
    borderRadius: 19,
    alignSelf: 'flex-end',
    shadowColor: Colors.light.onlineGreen,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '200',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 16,
  },

  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 36,
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