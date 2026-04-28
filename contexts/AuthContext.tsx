import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import { Platform, Alert } from 'react-native';
import { logger } from '@/lib/logger';
import { API_URL } from '@/constants/config';
import {
  identifyUser,
  resetAnalytics,
  trackSignUp,
  trackSignIn,
  trackSignOut,
  trackOnboardingCompleted,
} from '@/lib/analytics';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AppleAuthenticationCredential } from 'expo-apple-authentication';
import {
  createAppleAuthNonce,
  hashNonceForAppleNativeRequest,
} from '@/lib/apple-auth';
import { signInWithGoogleNative } from '@/lib/google-native-auth';
import {
  clearPendingInviteRef,
  getPendingInviteRef,
} from '@/lib/pending-invite-ref';
import usePlansStore from '@/store/plansStore';
import useFriendsStore from '@/store/friendsStore';
import useHangStore from '@/store/hangStore';
import { deactivatePushToken } from '@/utils/pushNotifications';

const IS_PLACEHOLDER_KEY = !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                           process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'PLACEHOLDER_ANON_KEY_PANE_SIIA_ÕIGE_VÕTI';

// Mock mode is only allowed in development builds - never in production
const AUTH_MOCK_MODE = IS_PLACEHOLDER_KEY && __DEV__;

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
  deleteAccount: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const OAUTH_PLACEHOLDER_NAME = 'Pending setup';

function getAppleCredentialName(credential: AppleAuthenticationCredential): string | null {
  const fullName = credential.fullName;
  const parts = [
    fullName?.givenName,
    fullName?.middleName,
    fullName?.familyName,
  ]
    .map(part => part?.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : null;
}

function isTemporaryUsername(username?: string | null): boolean {
  return !username || username.startsWith('tmp_');
}

function getKnownProfileName(
  userData: any,
  authUser: User,
  preferredName?: string | null
): string | null {
  const candidate =
    preferredName ||
    userData?.name ||
    authUser.user_metadata?.name ||
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.display_name;

  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed === OAUTH_PLACEHOLDER_NAME) return null;
  return trimmed;
}

function isAppleAuthUser(authUser: User): boolean {
  const provider = authUser.app_metadata?.provider;
  const providers = authUser.app_metadata?.providers;
  return (
    provider === 'apple' ||
    (Array.isArray(providers) && providers.includes('apple')) ||
    authUser.identities?.some(identity => identity.provider === 'apple') === true
  );
}

function getAppleFallbackProfileName(authUser: User): string {
  const email = authUser.email?.trim().toLowerCase();
  if (!email || email.endsWith('@privaterelay.appleid.com')) {
    return 'Apple User';
  }

  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  if (!localPart || localPart.includes('+')) {
    return 'Apple User';
  }

  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

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
  const [hasRecheckedOnboardingRoute, setHasRecheckedOnboardingRoute] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const [initialSessionChecked, setInitialSessionChecked] = useState(false);
  const hasCheckedOnboardingRef = useRef(false);
  const pendingAppleProfileNameRef = useRef<string | null>(null);
  const pendingAppleRequiresUsernameSelectionRef = useRef(false);
  const lastOnboardingRequiredRef = useRef<boolean | null>(null);
  const onboardingCheckInFlightRef = useRef(false);
  const socialSignInNavigationPendingRef = useRef(false);
  const router = useRouter();
  const segments = useSegments();

  // Access to realtime subscription stores
  const { startRealTimeUpdates: startPlansRealtime, checkAndRestartSubscriptions } = usePlansStore();
  const { startRealTimeUpdates: startFriendsRealtime } = useFriendsStore();
  const { startRealTimeUpdates: startHangRealtime } = useHangStore();

  useEffect(() => {
    hasCheckedOnboardingRef.current = hasCheckedOnboarding;
  }, [hasCheckedOnboarding]);

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
        logger.log('🔍 Checking for existing session on app startup...');
        
        // Get current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting session:', error);
          setUser(null);
          setLoading(false);
          setNavigationReady(true);
          setInitialSessionChecked(true);
          return;
        }

        if (session?.user) {
          logger.log('✅ Found existing session for user:', session.user.email);
          setUser(session.user);
          // Don't set loading to false yet - wait for onboarding check
        } else {
          logger.log('❌ No existing session found');
          setUser(null);
          setLoading(false);
          setNavigationReady(true);
        }
        
        setInitialSessionChecked(true);
      } catch (error) {
        logger.error('Error in initial session check:', error);
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
          logger.log('📡 Auth event:', event, 'Session:', !!session);
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          logger.log('✅ User signed in:', session.user.email);
          identifyUser(session.user.id, {
            email: session.user.email,
            name: session.user.user_metadata?.name,
          });
          // Don't reset onboarding status if it was already checked during signIn
          if (
            !hasCheckedOnboardingRef.current &&
            !socialSignInNavigationPendingRef.current
          ) {
            hasCheckedOnboardingRef.current = false;
            setHasCheckedOnboarding(false);
            setIsCheckingOnboarding(false);
            setHasRecheckedOnboardingRoute(false);
            setNavigationReady(false);
          }

          // Note: Realtime subscriptions are managed by individual stores
          // and will start automatically when needed. No manual restart required.
        }
        
        if (event === 'SIGNED_OUT') {
          logger.log('👋 User signed out');
          // Note: Push token already deactivated in signOut() function
          // No need to deactivate again here as user is already signed out
          
          hasCheckedOnboardingRef.current = false;
          setHasCheckedOnboarding(false);
          setIsCheckingOnboarding(false);
          setHasRecheckedOnboardingRoute(false);
          setNavigationReady(true);
          pendingAppleProfileNameRef.current = null;
          pendingAppleRequiresUsernameSelectionRef.current = false;
          lastOnboardingRequiredRef.current = null;
          onboardingCheckInFlightRef.current = false;
          socialSignInNavigationPendingRef.current = false;
        }
        
        if (event === 'TOKEN_REFRESHED') {
          if (__DEV__) {
            logger.log('🔄 Token refreshed');
          }

          // Check and restart realtime subscriptions after token refresh
          if (session?.user) {
            logger.log('🔄 Checking realtime subscriptions after token refresh');
            setTimeout(() => {
              try {
                checkAndRestartSubscriptions(session.user.id);
                logger.log('✅ Realtime subscriptions checked after token refresh');
              } catch (error) {
                logger.error('❌ Error checking realtime subscriptions after token refresh:', error);
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
            if (hasCheckedOnboardingRef.current) {
              logger.log('✅ User signed in, onboarding already checked, setting loading false');
              setLoading(false);
            } else {
              // Keep loading true until onboarding status is determined
              logger.log('⏳ User signed in, keeping loading true until onboarding check completes');
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
        logger.log('🔗 Deep link received:', url);
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
              logger.error('Auth callback error:', error);
            }
            // Only show error if it's a real auth callback issue, not normal app usage
            if (!error.message.includes('expired') && !error.message.includes('invalid')) {
              Alert.alert('Error', 'An error occurred while confirming your email: ' + error.message);
            }
          } else if (data.session) {
            if (__DEV__) {
              logger.log('✅ Email confirmed successfully');
            }
            Alert.alert('Success!', 'Your email address has been successfully confirmed!');
          }
        } catch (error) {
          // Fallback - just log the error and continue
          if (__DEV__) {
            logger.error('Error processing auth callback:', error);
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
      logger.log('🔄 Redirecting to sign-in (no user)');
      hasCheckedOnboardingRef.current = false;
      setHasCheckedOnboarding(false);
      setHasRecheckedOnboardingRoute(false);
      router.replace('/(auth)/sign-in');
    } else if (
      user &&
      inAuthGroup &&
      !hasCheckedOnboarding &&
      !isCheckingOnboarding &&
      !socialSignInNavigationPendingRef.current
    ) {
      // User is logged in but in auth group - check onboarding status once
      logger.log('🔍 Checking onboarding status from auth group');
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
      logger.log('🔍 Checking onboarding status from main app');
      checkOnboardingStatus();
    } else if (user && inTabsGroup && !hasCheckedOnboarding && !isCheckingOnboarding) {
      // User is already in tabs but onboarding hasn't been checked - this can happen on app restart
      logger.log('🔍 User already in tabs, checking onboarding status to complete loading');
      checkOnboardingStatus();
    } else if (
      user &&
      inOnboardingGroup &&
      hasCheckedOnboarding &&
      navigationReady &&
      !isCheckingOnboarding &&
      !hasRecheckedOnboardingRoute &&
      lastOnboardingRequiredRef.current !== true
    ) {
      // If a completed user lands on onboarding via stale navigation/dev reload, verify and move them out.
      logger.log('🔍 User is in onboarding after previous check, verifying destination');
      setHasRecheckedOnboardingRoute(true);
      checkOnboardingStatus();
    } else if (user && hasCheckedOnboarding && navigationReady) {
      // User is logged in, onboarding has been checked, and navigation is ready - ensure loading is false
      logger.log('✅ User authenticated and onboarding checked, ensuring loading is complete');
      setLoading(false);
    }
  }, [
    user,
    segments,
    loading,
    hasCheckedOnboarding,
    navigationReady,
    isCheckingOnboarding,
    hasRecheckedOnboardingRoute,
    initialSessionChecked,
  ]);

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
      logger.log('⚠️ Maximum loading time reached, forcing loading to complete');
      if (user) {
        // If the check stalls, keep account setup safe instead of exposing an incomplete profile.
        hasCheckedOnboardingRef.current = true;
        setHasCheckedOnboarding(true);
        setNavigationReady(true);
        setLoading(false);
        router.replace('/(onboarding)/step-1');
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
    if (!subject || onboardingCheckInFlightRef.current) {
      logger.log('🚫 Skipping onboarding check:', {
        hasUser: !!subject,
        isCheckingOnboarding,
        onboardingCheckInFlight: onboardingCheckInFlightRef.current,
      });
      return;
    }

    onboardingCheckInFlightRef.current = true;
    let completed = false;
    const finishOnboardingCheck = () => {
      if (completed) return false;
      completed = true;
      onboardingCheckInFlightRef.current = false;
      socialSignInNavigationPendingRef.current = false;
      setIsCheckingOnboarding(false);
      return true;
    };

    setIsCheckingOnboarding(true);
    hasCheckedOnboardingRef.current = true;
    setHasCheckedOnboarding(true); // Mark that we've checked to prevent loops
    logger.log('🔍 Starting onboarding status check for user:', subject.email);

    // Set a timeout to ensure this function always completes
    const timeoutId = setTimeout(() => {
      logger.log('⚠️ Onboarding check timeout - forcing completion');
      if (!finishOnboardingCheck()) return;
      setNavigationReady(true);
      setLoading(false);
      // Default to onboarding if the check cannot prove setup is complete.
      if (subject && segments[0] !== '(onboarding)') {
        lastOnboardingRequiredRef.current = true;
        router.replace('/(onboarding)/step-1');
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
      if (completed) return;

      if (error) {
        // If user doesn't exist in users table (404/PGRST116), they need onboarding
        if (error.code === 'PGRST116') {
          logger.log('👤 User not found in users table. Directing to onboarding.');
          lastOnboardingRequiredRef.current = true;
          router.replace('/(onboarding)/step-1');
          setNavigationReady(true);
          setLoading(false);
          finishOnboardingCheck();
          return;
        }
        
        logger.error('❌ Error checking user existence:', error);
        // On other errors, keep setup gated instead of exposing an incomplete profile.
        logger.log('🔄 Defaulting to onboarding due to profile check error');
        lastOnboardingRequiredRef.current = true;
        router.replace('/(onboarding)/step-1');
        setNavigationReady(true);
        setLoading(false);
        finishOnboardingCheck();
        return;
      }

      // User exists, check onboarding status
      if (userData) {
        logger.log('👤 User found in database:', { 
          id: userData.id, 
          name: userData.name, 
          username: userData.username,
          onboarding_completed: userData.onboarding_completed 
        });
        
        const goMainApp = () => {
          pendingAppleProfileNameRef.current = null;
          lastOnboardingRequiredRef.current = false;
          if (segments[0] !== '(tabs)') {
            router.replace('/(tabs)');
          }
          setNavigationReady(true);
          setLoading(false);
          finishOnboardingCheck();
        };

        const goOnboarding = () => {
          lastOnboardingRequiredRef.current = true;
          const knownProfileName = getKnownProfileName(
            userData,
            subject,
            pendingAppleProfileNameRef.current
          );
          const profileName =
            knownProfileName ?? (isAppleAuthUser(subject) ? getAppleFallbackProfileName(subject) : null);
          const username =
            !pendingAppleRequiresUsernameSelectionRef.current &&
            typeof userData.username === 'string' &&
            !isTemporaryUsername(userData.username)
              ? userData.username
              : null;

          if (!profileName) {
            router.replace('/(onboarding)/step-1');
          } else if (!username) {
            pendingAppleProfileNameRef.current = profileName;
            router.replace({
              pathname: '/(onboarding)/step-2',
              params: { name: profileName },
            });
          } else {
            pendingAppleProfileNameRef.current = profileName;
            router.replace({
              pathname: '/(onboarding)/step-3',
              params: { name: profileName, username },
            });
          }
          setNavigationReady(true);
          setLoading(false);
          finishOnboardingCheck();
        };

        // Prefer explicit onboarding flag so OAuth / trigger placeholder rows still go through onboarding
        if (userData.onboarding_completed === true) {
          logger.log('✅ User has onboarding_completed = true, directing to main app');
          goMainApp();
          return;
        }
        if (userData.onboarding_completed === false) {
          logger.log('📝 onboarding_completed is false, directing to onboarding');
          goOnboarding();
          return;
        }
        // Legacy rows (onboarding_completed null / column missing in older DBs)
        if (userData.name && userData.username) {
          logger.log('✅ Legacy profile complete (name + username), directing to main app');
          goMainApp();
          return;
        }

        logger.log('📝 User needs onboarding, directing to step-1');
        goOnboarding();
      } else {
        // No user data found, need onboarding
        logger.log('📝 No user data found, directing to onboarding');
        lastOnboardingRequiredRef.current = true;
        router.replace('/(onboarding)/step-1');
        setNavigationReady(true);
        setLoading(false);
        finishOnboardingCheck();
      }
    } catch (error) {
      // Clear the timeout
      clearTimeout(timeoutId);
      if (completed) return;
      
      logger.error('❌ Error in checkOnboardingStatus:', error);
      // On unexpected errors, keep setup gated instead of exposing an incomplete profile.
      logger.log('🔄 Defaulting to onboarding due to unexpected error');
      if (segments[0] !== '(onboarding)') {
        lastOnboardingRequiredRef.current = true;
        router.replace('/(onboarding)/step-1');
      }
      setNavigationReady(true);
      setLoading(false);
      finishOnboardingCheck();
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
      trackSignIn({ userId: data.user.id, method: 'email', success: true });
      logger.log('✅ Sign in successful, checking user onboarding status immediately...');
      
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
            logger.log('👤 New user detected during sign in - will direct to onboarding');
            // Set a flag that this user needs onboarding
            lastOnboardingRequiredRef.current = true;
            hasCheckedOnboardingRef.current = true;
            setHasCheckedOnboarding(true);
            setNavigationReady(true);
            return; // The useEffect will handle navigation to onboarding
          }
          
          logger.error('❌ Error checking user existence during sign in:', userError);
          // On errors, default to onboarding for safety
          lastOnboardingRequiredRef.current = true;
          hasCheckedOnboardingRef.current = true;
          setHasCheckedOnboarding(true);
          setNavigationReady(true);
          return;
        }

        // User exists, check if they need onboarding
        if (userData) {
          logger.log('👤 Existing user found during sign in:', { 
            id: userData.id, 
            name: userData.name, 
            username: userData.username,
            onboarding_completed: userData.onboarding_completed 
          });
          
          const markReady = (requiresOnboarding: boolean) => {
            lastOnboardingRequiredRef.current = requiresOnboarding;
            hasCheckedOnboardingRef.current = true;
            setHasCheckedOnboarding(true);
            setNavigationReady(true);
          };

          if (userData.onboarding_completed === true) {
            logger.log('✅ Existing user onboarding completed - will direct to main app');
            markReady(false);
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
            return;
          }
          if (userData.onboarding_completed === false) {
            logger.log('📝 Existing user must finish onboarding');
            markReady(true);
            setTimeout(() => {
              router.replace('/(onboarding)/step-1');
            }, 100);
            return;
          }
          if (userData.name && userData.username) {
            logger.log('✅ Legacy profile complete - will direct to main app');
            markReady(false);
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
            return;
          }

          logger.log('📝 Existing user needs onboarding - will direct to onboarding');
          markReady(true);
          return;
        } else {
          // No user data found, need onboarding
          logger.log('📝 No user data found during sign in - will direct to onboarding');
          lastOnboardingRequiredRef.current = true;
          hasCheckedOnboardingRef.current = true;
          setHasCheckedOnboarding(true);
          setNavigationReady(true);
          return;
        }
      } catch (error) {
        logger.error('❌ Error checking user status during sign in:', error);
        // On unexpected errors, default to onboarding for safety
        lastOnboardingRequiredRef.current = true;
        hasCheckedOnboardingRef.current = true;
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
    if (data.user) {
      trackSignUp({ userId: data.user.id, email, method: 'email' });
    }
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

    // Deactivate push token before signing out
    try {
      logger.log('🔕 Deactivating push token...');
      await deactivatePushToken();
    } catch (error) {
      logger.error('⚠️ Failed to deactivate push token, continuing with sign out:', error);
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    trackSignOut();
    resetAnalytics();
  };

  const deleteAccount = async () => {
    if (AUTH_MOCK_MODE) {
      return;
    }

    try {
      await deactivatePushToken();
    } catch (error) {
      logger.error('⚠️ Failed to deactivate push token before account deletion:', error);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No active session. Please sign in again.');
    }

    const response = await fetch(`${API_URL}/user/me`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      let message = 'Failed to delete account. Please try again.';
      try {
        const body = await response.json();
        if (typeof body?.error === 'string') message = body.error;
      } catch {
        // Keep default message if the backend did not return JSON.
      }
      throw new Error(message);
    }

    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error('⚠️ Sign out after account deletion failed:', error);
    }
    trackSignOut();
    resetAnalytics();
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

    const rawNonce = await createAppleAuthNonce();
    const nonceForAppleRequest = await hashNonceForAppleNativeRequest(rawNonce);

    let credential: AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: nonceForAppleRequest,
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

    const appleFullName = getAppleCredentialName(credential);
    pendingAppleProfileNameRef.current = appleFullName ?? 'Apple User';
    pendingAppleRequiresUsernameSelectionRef.current = true;
    if (__DEV__) {
      logger.log('🍎 Apple credential profile name:', appleFullName ?? '(not returned)');
      logger.log('🍎 Apple credential fullName fields:', credential.fullName);
    }

    socialSignInNavigationPendingRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        throw error;
      }

      if (data.user && appleFullName) {
        await supabase.auth.updateUser({
          data: {
            name: appleFullName,
            full_name: appleFullName,
          },
        });

        const { error: profileNameError } = await supabase
          .from('users')
          .update({
            name: appleFullName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.user.id)
          .or('onboarding_completed.is.false,onboarding_completed.is.null');

        if (profileNameError) {
          logger.error('⚠️ Failed to sync Apple name to profile placeholder:', profileNameError);
        }
      }

      if (data.user) {
        trackSignIn({ userId: data.user.id, method: 'apple', success: true });
        await checkOnboardingStatus(data.user);
      } else {
        socialSignInNavigationPendingRef.current = false;
      }
    } catch (error) {
      socialSignInNavigationPendingRef.current = false;
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    if (AUTH_MOCK_MODE) {
      throw new Error('Mock mode: Google sign-in is unavailable.');
    }
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      throw new Error('Google sign-in is only available on the mobile app.');
    }

    const googleResult = await signInWithGoogleNative();
    if (googleResult.cancelled) {
      return;
    }

    socialSignInNavigationPendingRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleResult.idToken,
        ...(googleResult.accessToken
          ? { access_token: googleResult.accessToken }
          : {}),
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        trackSignIn({ userId: data.user.id, method: 'google', success: true });
        await checkOnboardingStatus(data.user);
      } else {
        socialSignInNavigationPendingRef.current = false;
      }
    } catch (error) {
      socialSignInNavigationPendingRef.current = false;
      throw error;
    }
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
        deleteAccount,
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