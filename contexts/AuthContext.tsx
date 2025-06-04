import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import { Platform } from 'react-native';

// TEMPORARY: Mock mode for database setup
// Automatically enabled when placeholder keys are used
const AUTH_MOCK_MODE = !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'PLACEHOLDER_ANON_KEY_PANE_SIIA_ÕIGE_VÕTI';

interface AuthContextType {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (AUTH_MOCK_MODE) {
      // In mock mode, immediately set loading to false and no user
      setLoading(false);
      setUser(null);
      return;
    }

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // User is not logged in and not in auth group
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup) {
      // User is logged in and is in auth group
      router.replace('/(tabs)');
    }
  }, [user, segments, loading]);

  const signIn = async (email: string, password: string) => {
    if (AUTH_MOCK_MODE) {
      // In mock mode, just show a message and don't actually sign in
      throw new Error('Mock mode: Please setup the database first. Go to Supabase dashboard and run the SQL setup.');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw error;
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

  return (
    <AuthContext.Provider
      value={{
        user,
        signIn,
        signUp,
        signOut,
        signInWithApple,
        signInWithGoogle,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
} 