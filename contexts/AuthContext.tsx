import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import { Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';

// TEMPORARY: Mock mode for database setup
// Automatically enabled when placeholder keys are used
const AUTH_MOCK_MODE = !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'PLACEHOLDER_ANON_KEY_PANE_SIIA_ÕIGE_VÕTI';

interface AuthContextType {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{
    user: any;
    needsEmailConfirmation: boolean;
  }>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (AUTH_MOCK_MODE) {
      // In mock mode, immediately set loading to false and no user
      setLoading(false);
      setUser(null);
      setNavigationReady(true);
      return;
    }

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (__DEV__) {
          console.log('Auth event:', event, 'Session:', !!session);
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Don't reset onboarding status if it was already checked during signIn
          console.log('SIGNED_IN event received, checking if onboarding was pre-checked');
          if (!hasCheckedOnboarding) {
            setHasCheckedOnboarding(false);
            setIsCheckingOnboarding(false);
            setNavigationReady(false);
          }
        }
        
        if (event === 'SIGNED_OUT') {
          setHasCheckedOnboarding(false);
          setIsCheckingOnboarding(false);
          setNavigationReady(true);
        }
        
        if (event === 'TOKEN_REFRESHED' && __DEV__) {
          console.log('Token refreshed');
        }
        
        setUser(session?.user ?? null);
        
        // Small delay to ensure UI state is stable before navigation
        setTimeout(() => {
          // Keep loading true if we need to check onboarding
          if (session?.user) {
            // If onboarding was already checked during signIn, we can set loading to false
            if (hasCheckedOnboarding) {
              console.log('User signed in, onboarding already checked, setting loading false');
              setLoading(false);
            } else {
              // Keep loading true until onboarding status is determined
              console.log('User signed in, keeping loading true until onboarding check completes');
            }
          } else {
        setLoading(false);
            setNavigationReady(true);
          }
        }, 100);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Handle deep links (e-posti kinnituse lingid)
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (__DEV__) {
        console.log('Deep link received:', url);
      }
      
      // Handle email confirmation success
      if (url.includes('auth/confirmed')) {
        Alert.alert('Success!', 'Your email has been confirmed! You can now sign in.');
        router.replace('/(auth)/sign-in');
        return;
      }
      
      // Handle password reset
      if (url.includes('auth/reset-password')) {
        const urlParts = url.split('?');
        if (urlParts.length > 1) {
          const urlParams = new URLSearchParams(urlParts[1]);
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            router.push({
              pathname: '/(auth)/reset-password',
              params: { access_token: accessToken, refresh_token: refreshToken }
            });
            return;
          }
        }
      }
      
      // Handle general auth callbacks with tokens - but NOT regular app URLs
      if ((url.includes('#access_token=') || url.includes('?access_token=')) && 
          !url.includes('exp://') && 
          !url.includes('localhost')) {
        // This is likely an auth callback from email confirmation
        const { data, error } = await supabase.auth.getSessionFromUrl({ url });
        
        if (error) {
          if (__DEV__) {
            console.error('Auth callback error:', error);
          }
          // Only show error if it's a real auth callback issue, not normal app usage
          if (!error.message.includes('expired') && !error.message.includes('invalid')) {
            Alert.alert('Error', 'An error occurred while confirming your email: ' + error.message);
          }
        } else if (data.session) {
          if (__DEV__) {
            console.log('Email confirmed successfully');
          }
          Alert.alert('Success!', 'Your email address has been successfully confirmed!');
        }
      }
    };

    // Listen for URL changes
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (loading || isCheckingOnboarding) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (__DEV__) {
      console.log('AuthContext navigation check:', { 
        user: !!user, 
        segments: segments[0], 
        hasCheckedOnboarding,
        inAuthGroup,
        inOnboardingGroup,
        navigationReady,
        isCheckingOnboarding
      });
    }

    if (!user && !inAuthGroup && navigationReady) {
      // User is not logged in and not in auth group
      setHasCheckedOnboarding(false);
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup && !hasCheckedOnboarding && !isCheckingOnboarding) {
      // User is logged in but in auth group - check onboarding status once
      // DON'T navigate anywhere until we know where they should go
      console.log('Checking onboarding status from auth group');
      checkOnboardingStatus();
    } else if (user && !inOnboardingGroup && !inAuthGroup && !hasCheckedOnboarding && !isCheckingOnboarding) {
      // User is logged in and not in onboarding/auth - check if onboarding is completed once
      console.log('Checking onboarding status from main app');
      checkOnboardingStatus();
    }
  }, [user, segments, loading, hasCheckedOnboarding, navigationReady, isCheckingOnboarding]);

  const checkOnboardingStatus = async () => {
    if (!user || isCheckingOnboarding) return;

    setIsCheckingOnboarding(true);
    setHasCheckedOnboarding(true); // Mark that we've checked to prevent loops
    console.log('Starting onboarding status check...');

    try {
      // Small delay to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // First check if user exists in our users table
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) {
        // If user doesn't exist in users table (404/PGRST116), they need onboarding
        if (error.code === 'PGRST116') {
          console.log('User not found in users table. Directing to onboarding.');
          // Another small delay before navigation
          setTimeout(() => {
            router.replace('/(onboarding)/step-1');
            setNavigationReady(true);
            setLoading(false);
          }, 100);
          return;
        }
        
        console.error('Error checking user existence:', error);
        // On other errors, default to onboarding for safety
        setTimeout(() => {
          router.replace('/(onboarding)/step-1');
          setNavigationReady(true);
          setLoading(false);
        }, 100);
        return;
      }

      // User exists, check onboarding status
      if (userData) {
        console.log('User found in database:', { 
          id: userData.id, 
          name: userData.name, 
          username: userData.username,
          onboarding_completed: userData.onboarding_completed 
        });
        
        // If user has name and username, consider them onboarded (backward compatibility)
        if (userData.name && userData.username) {
          console.log('User has name and username, directing to main app and setting loading false');
          // Show welcome back message for existing users
          Alert.alert('Welcome back!', 'Ready to make some memories?');
          setTimeout(() => {
            router.replace('/(tabs)');
            setNavigationReady(true);
            setLoading(false);
          }, 100);
          return;
        }
        
        // If onboarding_completed field exists and is true, go to main app
        if (userData.onboarding_completed === true) {
          console.log('User has onboarding_completed = true, directing to main app and setting loading false');
          // Show welcome back message for existing users
          Alert.alert('Welcome back!', 'Ready to make some memories?');
          setTimeout(() => {
      router.replace('/(tabs)');
            setNavigationReady(true);
            setLoading(false);
          }, 100);
          return;
        } 
        
        // Otherwise, user needs onboarding
        console.log('User needs onboarding, directing to step-1');
        setTimeout(() => {
          router.replace('/(onboarding)/step-1');
          setNavigationReady(true);
          setLoading(false);
        }, 100);
      } else {
        // No user data found, need onboarding
        console.log('No user data found, directing to onboarding');
        setTimeout(() => {
          router.replace('/(onboarding)/step-1');
          setNavigationReady(true);
          setLoading(false);
        }, 100);
      }
    } catch (error) {
      console.error('Error in checkOnboardingStatus:', error);
      // On unexpected errors, default to onboarding for safety
      setTimeout(() => {
        router.replace('/(onboarding)/step-1');
        setNavigationReady(true);
        setLoading(false);
      }, 100);
    } finally {
      setTimeout(() => {
        setIsCheckingOnboarding(false);
      }, 300);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (AUTH_MOCK_MODE) {
      // In mock mode, just show a message and don't actually sign in
      throw new Error('Mock mode: Please setup the database first. Go to Supabase dashboard and run the SQL setup.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      // Check if it's an email not confirmed error
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Your email address is not yet confirmed. Please check your inbox and click the confirmation link. If you can\'t find the email, also check your spam folder.');
      }
      throw error;
    }
    
    if (data.user && !data.user.email_confirmed_at) {
      // Sign out the user if email is not confirmed
      await supabase.auth.signOut();
      throw new Error('Your email address is not yet confirmed. Please check your inbox and click the confirmation link before signing in.');
    }

    // If sign in was successful, check user's onboarding status IMMEDIATELY
    if (data.user) {
      console.log('Sign in successful, checking user onboarding status immediately...');
      
      try {
        // Check if user exists in our users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userError) {
          // If user doesn't exist in users table, they need onboarding
          if (userError.code === 'PGRST116') {
            console.log('New user detected during sign in - will direct to onboarding');
            // Set a flag that this user needs onboarding
            setHasCheckedOnboarding(true);
            setNavigationReady(true);
            return; // The useEffect will handle navigation to onboarding
          }
          
          console.error('Error checking user existence during sign in:', userError);
          // On errors, default to onboarding for safety
          setHasCheckedOnboarding(true);
          setNavigationReady(true);
          return;
        }

        // User exists, check if they need onboarding
        if (userData) {
          console.log('Existing user found during sign in:', { 
            id: userData.id, 
            name: userData.name, 
            username: userData.username,
            onboarding_completed: userData.onboarding_completed 
          });
          
          // If user has name and username, they're ready for main app
          if (userData.name && userData.username) {
            console.log('Existing user is ready - will direct to main app');
            setHasCheckedOnboarding(true);
            setNavigationReady(true);
            // Set a flag to go directly to main app
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
            return;
          }
          
          // If onboarding_completed field exists and is true, go to main app
          if (userData.onboarding_completed === true) {
            console.log('Existing user onboarding completed - will direct to main app');
            setHasCheckedOnboarding(true);
            setNavigationReady(true);
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
            return;
          } 
          
          // Otherwise, user needs onboarding
          console.log('Existing user needs onboarding - will direct to onboarding');
          setHasCheckedOnboarding(true);
          setNavigationReady(true);
          return;
        } else {
          // No user data found, need onboarding
          console.log('No user data found during sign in - will direct to onboarding');
          setHasCheckedOnboarding(true);
          setNavigationReady(true);
          return;
        }
      } catch (error) {
        console.error('Error checking user status during sign in:', error);
        // On unexpected errors, default to onboarding for safety
        setHasCheckedOnboarding(true);
        setNavigationReady(true);
        return;
      }
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (AUTH_MOCK_MODE) {
      // In mock mode, just show a message and don't actually sign up
      throw new Error('Mock mode: Please setup the database first. Go to Supabase dashboard and run the SQL setup.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          username: email.split('@')[0],
        },
      },
    });

    if (error) {
      throw error;
    }

    // Don't throw error for successful signup that needs email confirmation
    // The sign-up screen will handle this appropriately
    return {
      user: data.user,
      needsEmailConfirmation: data.user && !data.user.email_confirmed_at
    };

    // Note: User profile will be created automatically by the database trigger
    // The handle_new_user() function handles profile creation
  };

  const signOut = async () => {
    if (AUTH_MOCK_MODE) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  };

  const signInWithApple = async () => {
    throw new Error('Apple sign-in is not configured yet. Please use email and password to sign in.');
  };

  const signInWithGoogle = async () => {
    throw new Error('Google sign-in is not configured yet. Please use email and password to sign in.');
  };

  const resendConfirmation = async (email: string) => {
    if (AUTH_MOCK_MODE) {
      throw new Error('Mock mode: Please setup the database first.');
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    if (AUTH_MOCK_MODE) {
      throw new Error('Mock mode: Please setup the database first.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://freetohang.com/auth/reset-password'
    });

    if (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        signIn,
        signUp,
        signOut,
        signInWithApple,
        signInWithGoogle,
        resendConfirmation,
        resetPassword,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
} 