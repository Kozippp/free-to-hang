import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import { Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AppleAuthenticationCredential } from 'expo-apple-authentication';
import { createAppleAuthNonce } from '@/lib/apple-auth';
import {
  clearPendingInviteRef,
  getPendingInviteRef,
} from '@/lib/pending-invite-ref';
import usePlansStore from '@/store/plansStore';
import useFriendsStore from '@/store/friendsStore';
import useHangStore from '@/store/hangStore';

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
  const [initialSessionChecked, setInitialSessionChecked] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  // Access to realtime subscription stores
  const { startRealTimeUpdates: startPlansRealtime, checkAndRestartSubscriptions } = usePlansStore();
  const { startRealTimeUpdates: startFriendsRealtime } = useFriendsStore();
  const { startRealTimeUpdates: startHangRealtime } = useHangStore();

  // Initial session check on app startup
  useEffect(() => {
    if (AUTH_MOCK_MODE) {
      // In mock mode, immediately set loading to false and no user
      setLoading(false);
      setUser(null);
      setNavigationReady(true);
      setInitialSessionChecked(true);
      return;
    }

    const checkInitialSession = async () => {
      try {
        console.log('🔍 Checking for existing session on app startup...');
        
        // Get current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setUser(null);
          setLoading(false);
          setNavigationReady(true);
          setInitialSessionChecked(true);
          return;
        }

        if (session?.user) {
          console.log('✅ Found existing session for user:', session.user.email);
          setUser(session.user);
          // Don't set loading to false yet - wait for onboarding check
        } else {
          console.log('❌ No existing session found');
          setUser(null);
          setLoading(false);
          setNavigationReady(true);
        }
        
        setInitialSessionChecked(true);
      } catch (error) {
        console.error('Error in initial session check:', error);
        setUser(null);
        setLoading(false);
        setNavigationReady(true);
        setInitialSessionChecked(true);
      }
    };

    checkInitialSession();
  }, []);

  useEffect(() => {
    if (AUTH_MOCK_MODE || !initialSessionChecked) {
      return;
    }

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (__DEV__) {
          console.log('📡 Auth event:', event, 'Session:', !!session);
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in:', session.user.email);
          // Don't reset onboarding status if it was already checked during signIn
          if (!hasCheckedOnboarding) {
            setHasCheckedOnboarding(false);
            setIsCheckingOnboarding(false);
            setNavigationReady(false);
          }

          // Note: Realtime subscriptions are managed by individual stores
          // and will start automatically when needed. No manual restart required.
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
          setHasCheckedOnboarding(false);
          setIsCheckingOnboarding(false);
          setNavigationReady(true);
        }
        
        if (event === 'TOKEN_REFRESHED') {
          if (__DEV__) {
            console.log('🔄 Token refreshed');
          }

          // Check and restart realtime subscriptions after token refresh
          if (session?.user) {
            console.log('🔄 Checking realtime subscriptions after token refresh');
            setTimeout(() => {
              try {
                checkAndRestartSubscriptions(session.user.id);
                console.log('✅ Realtime subscriptions checked after token refresh');
              } catch (error) {
                console.error('❌ Error checking realtime subscriptions after token refresh:', error);
              }
            }, 500);
          }
        }
        
        setUser(session?.user ?? null);
        
        // Small delay to ensure UI state is stable before navigation
        setTimeout(() => {
          // Keep loading true if we need to check onboarding
          if (session?.user) {
            // If onboarding was already checked during signIn, we can set loading to false
            if (hasCheckedOnboarding) {
              console.log('✅ User signed in, onboarding already checked, setting loading false');
              setLoading(false);
            } else {
              // Keep loading true until onboarding status is determined
              console.log('⏳ User signed in, keeping loading true until onboarding check completes');
            }
          } else {
            setLoading(false);
            setNavigationReady(true);
          }
        }, 100);
      }
    );

    return () => subscription.unsubscribe();
  }, [initialSessionChecked]);

  // Handle deep links (e-posti kinnituse lingid)
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (__DEV__) {
        console.log('🔗 Deep link received:', url);
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
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(url);
          
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
              console.log('✅ Email confirmed successfully');
            }
            Alert.alert('Success!', 'Your email address has been successfully confirmed!');
          }
        } catch (error) {
          // Fallback - just log the error and continue
          if (__DEV__) {
            console.error('Error processing auth callback:', error);
          }
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
    if (loading || isCheckingOnboarding || !initialSessionChecked) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inInviteRoute = segments[0] === 'invite';

    if (__DEV__) {
      console.log('🧭 AuthContext navigation check:', { 
        user: !!user, 
        segments: segments[0], 
        hasCheckedOnboarding,
        inAuthGroup,
        inOnboardingGroup,
        inTabsGroup,
        inInviteRoute,
        navigationReady,
        isCheckingOnboarding,
        initialSessionChecked
      });
    }

    if (!user && !inAuthGroup && navigationReady && !inInviteRoute) {
      // User is not logged in and not in auth group
      console.log('🔄 Redirecting to sign-in (no user)');
      setHasCheckedOnboarding(false);
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup && !hasCheckedOnboarding && !isCheckingOnboarding) {
      // User is logged in but in auth group - check onboarding status once
      console.log('🔍 Checking onboarding status from auth group');
      checkOnboardingStatus();
    } else if (
      user &&
      !inOnboardingGroup &&
      !inAuthGroup &&
      !inInviteRoute &&
      !hasCheckedOnboarding &&
      !isCheckingOnboarding
    ) {
      // User is logged in and not in onboarding/auth - check if onboarding is completed once
      console.log('🔍 Checking onboarding status from main app');
      checkOnboardingStatus();
    } else if (user && inTabsGroup && !hasCheckedOnboarding && !isCheckingOnboarding) {
      // User is already in tabs but onboarding hasn't been checked - this can happen on app restart
      console.log('🔍 User already in tabs, checking onboarding status to complete loading');
      checkOnboardingStatus();
    } else if (user && hasCheckedOnboarding && navigationReady) {
      // User is logged in, onboarding has been checked, and navigation is ready - ensure loading is false
      console.log('✅ User authenticated and onboarding checked, ensuring loading is complete');
      setLoading(false);
    }
  }, [user, segments, loading, hasCheckedOnboarding, navigationReady, isCheckingOnboarding, initialSessionChecked]);

  // After sign-in / onboarding, resume invite deep link from AsyncStorage
  useEffect(() => {
    if (!user?.id || !hasCheckedOnboarding || loading || !navigationReady) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const pending = await getPendingInviteRef();
      if (!pending || cancelled) return;
      await clearPendingInviteRef();
      if (cancelled) return;
      router.replace(`/invite/${encodeURIComponent(pending)}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, hasCheckedOnboarding, loading, navigationReady, router]);

  // Failsafe: Set a maximum loading time to prevent infinite loading
  useEffect(() => {
    if (!loading) return;
    
    const maxLoadingTime = setTimeout(() => {
      console.log('⚠️ Maximum loading time reached, forcing loading to complete');
      if (user) {
        // If we have a user but still loading, assume they're ready for main app
        setHasCheckedOnboarding(true);
        setNavigationReady(true);
        setLoading(false);
        router.replace('/(tabs)');
      } else {
        // If no user, go to auth
        setLoading(false);
        setNavigationReady(true);
        router.replace('/(auth)/sign-in');
      }
    }, 10000); // 10 seconds max loading time

    return () => clearTimeout(maxLoadingTime);
  }, [loading, user]);

  const checkOnboardingStatus = async (sessionUser?: User | null) => {
    const subject = sessionUser ?? user;
    if (!subject || isCheckingOnboarding) {
      console.log('🚫 Skipping onboarding check:', { hasUser: !!subject, isCheckingOnboarding });
      return;
    }

    setIsCheckingOnboarding(true);
    setHasCheckedOnboarding(true); // Mark that we've checked to prevent loops
    console.log('🔍 Starting onboarding status check for user:', subject.email);

    // Set a timeout to ensure this function always completes
    const timeoutId = setTimeout(() => {
      console.log('⚠️ Onboarding check timeout - forcing completion');
      setIsCheckingOnboarding(false);
      setNavigationReady(true);
      setLoading(false);
      // Default to main app if we have a user
      if (subject && segments[0] !== '(tabs)') {
        router.replace('/(tabs)');
      }
    }, 5000); // 5 second timeout

    try {
      // Small delay to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // First check if user exists in our users table
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', subject.id)
        .single();

      // Clear the timeout since we got a response
      clearTimeout(timeoutId);

      if (error) {
        // If user doesn't exist in users table (404/PGRST116), they need onboarding
        if (error.code === 'PGRST116') {
          console.log('👤 User not found in users table. Directing to onboarding.');
          router.replace('/(onboarding)/step-1');
          setNavigationReady(true);
          setLoading(false);
          setIsCheckingOnboarding(false);
          return;
        }
        
        console.error('❌ Error checking user existence:', error);
        // On other errors, default to main app for better UX
        console.log('🔄 Defaulting to main app due to error');
        router.replace('/(tabs)');
        setNavigationReady(true);
        setLoading(false);
        setIsCheckingOnboarding(false);
        return;
      }

      // User exists, check onboarding status
      if (userData) {
        console.log('👤 User found in database:', { 
          id: userData.id, 
          name: userData.name, 
          username: userData.username,
          onboarding_completed: userData.onboarding_completed 
        });
        
        const goMainApp = () => {
          if (segments[0] !== '(tabs)') {
            router.replace('/(tabs)');
          }
          setNavigationReady(true);
          setLoading(false);
          setIsCheckingOnboarding(false);
        };

        const goOnboarding = () => {
          router.replace('/(onboarding)/step-1');
          setNavigationReady(true);
          setLoading(false);
          setIsCheckingOnboarding(false);
        };

        // Prefer explicit onboarding flag so OAuth / trigger placeholder rows still go through onboarding
        if (userData.onboarding_completed === true) {
          console.log('✅ User has onboarding_completed = true, directing to main app');
          goMainApp();
          return;
        }
        if (userData.onboarding_completed === false) {
          console.log('📝 onboarding_completed is false, directing to step-1');
          goOnboarding();
          return;
        }
        // Legacy rows (onboarding_completed null / column missing in older DBs)
        if (userData.name && userData.username) {
          console.log('✅ Legacy profile complete (name + username), directing to main app');
          goMainApp();
          return;
        }

        console.log('📝 User needs onboarding, directing to step-1');
        goOnboarding();
      } else {
        // No user data found, need onboarding
        console.log('📝 No user data found, directing to onboarding');
        router.replace('/(onboarding)/step-1');
        setNavigationReady(true);
        setLoading(false);
        setIsCheckingOnboarding(false);
      }
    } catch (error) {
      // Clear the timeout
      clearTimeout(timeoutId);
      
      console.error('❌ Error in checkOnboardingStatus:', error);
      // On unexpected errors, default to main app for better UX
      console.log('🔄 Defaulting to main app due to unexpected error');
      if (segments[0] !== '(tabs)') {
        router.replace('/(tabs)');
      }
      setNavigationReady(true);
      setLoading(false);
      setIsCheckingOnboarding(false);
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
      console.log('✅ Sign in successful, checking user onboarding status immediately...');
      
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
            console.log('👤 New user detected during sign in - will direct to onboarding');
            // Set a flag that this user needs onboarding
            setHasCheckedOnboarding(true);
            setNavigationReady(true);
            return; // The useEffect will handle navigation to onboarding
          }
          
          console.error('❌ Error checking user existence during sign in:', userError);
          // On errors, default to onboarding for safety
          setHasCheckedOnboarding(true);
          setNavigationReady(true);
          return;
        }

        // User exists, check if they need onboarding
        if (userData) {
          console.log('👤 Existing user found during sign in:', { 
            id: userData.id, 
            name: userData.name, 
            username: userData.username,
            onboarding_completed: userData.onboarding_completed 
          });
          
          const markReady = () => {
            setHasCheckedOnboarding(true);
            setNavigationReady(true);
          };

          if (userData.onboarding_completed === true) {
            console.log('✅ Existing user onboarding completed - will direct to main app');
            markReady();
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
            return;
          }
          if (userData.onboarding_completed === false) {
            console.log('📝 Existing user must finish onboarding');
            markReady();
            setTimeout(() => {
              router.replace('/(onboarding)/step-1');
            }, 100);
            return;
          }
          if (userData.name && userData.username) {
            console.log('✅ Legacy profile complete - will direct to main app');
            markReady();
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
            return;
          }

          console.log('📝 Existing user needs onboarding - will direct to onboarding');
          markReady();
          return;
        } else {
          // No user data found, need onboarding
          console.log('📝 No user data found during sign in - will direct to onboarding');
          setHasCheckedOnboarding(true);
          setNavigationReady(true);
          return;
        }
      } catch (error) {
        console.error('❌ Error checking user status during sign in:', error);
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
      needsEmailConfirmation: !!(data.user && !data.user.email_confirmed_at)
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
    if (AUTH_MOCK_MODE) {
      throw new Error('Mock mode: Apple sign-in is unavailable.');
    }
    if (Platform.OS !== 'ios') {
      throw new Error('Apple sign-in is only available on iOS.');
    }

    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      throw new Error('Apple sign-in is not available on this device.');
    }

    const nonce = await createAppleAuthNonce();

    let credential: AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String((e as { code?: string }).code)
          : '';
      if (code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      throw e;
    }

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token. Please try again.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce,
    });

    if (error) {
      throw error;
    }

    const gn = credential.fullName?.givenName;
    const fn = credential.fullName?.familyName;
    const displayName = [gn, fn].filter(Boolean).join(' ').trim();
    if (displayName) {
      await supabase.auth.updateUser({
        data: {
          name: displayName,
          full_name: displayName,
        },
      });
    }

    if (data.user) {
      await checkOnboardingStatus(data.user);
    }
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