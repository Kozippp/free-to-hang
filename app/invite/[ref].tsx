import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import UserProfileModal from '@/components/UserProfileModal';
import { resolveInviteRefToUserId } from '@/lib/invite-link';
import {
  clearPendingInviteRef,
  setPendingInviteRef,
} from '@/lib/pending-invite-ref';

export default function InviteProfileScreen() {
  const { ref: refParam } = useLocalSearchParams<{ ref: string }>();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();

  const refRaw = Array.isArray(refParam) ? refParam[0] : refParam;
  const refDecoded = refRaw
    ? (() => {
        try {
          return decodeURIComponent(refRaw);
        } catch {
          return refRaw;
        }
      })()
    : '';

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const closeToApp = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    if (!refDecoded || authLoading || !authUser?.id) {
      return () => {
        cancelled = true;
      };
    }

    setResolving(true);
    setResolveError(null);
    void (async () => {
      try {
        const id = await resolveInviteRefToUserId(refDecoded);
        if (cancelled) return;
        if (!id) {
          setResolvedUserId(null);
          setResolveError('This profile could not be found.');
        } else {
          setResolvedUserId(id);
        }
      } catch {
        if (!cancelled) {
          setResolveError('Something went wrong. Please try again.');
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refDecoded, authUser?.id, authLoading]);

  const goSignIn = async () => {
    if (refDecoded) await setPendingInviteRef(refDecoded);
    router.push('/(auth)/sign-in');
  };

  const goSignUp = async () => {
    if (refDecoded) await setPendingInviteRef(refDecoded);
    router.push('/(auth)/sign-up');
  };

  if (!refDecoded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.title}>Invalid link</Text>
          <TouchableOpacity style={styles.button} onPress={closeToApp}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!authUser?.id) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.title}>{"You're invited"}</Text>
          <Text style={styles.subtitle}>
            Sign in or create an account to view this profile and connect on Free
            to Hang.
          </Text>
          <TouchableOpacity style={styles.buttonPrimary} onPress={goSignIn}>
            <Text style={styles.buttonPrimaryText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={goSignUp}>
            <Text style={styles.buttonText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (resolving) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (resolveError || !resolvedUserId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.title}>Profile unavailable</Text>
          <Text style={styles.subtitle}>{resolveError ?? 'User not found.'}</Text>
          <TouchableOpacity style={styles.buttonPrimary} onPress={closeToApp}>
            <Text style={styles.buttonPrimaryText}>OK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.modalHost}>
      <UserProfileModal
        visible
        userId={resolvedUserId}
        onClose={async () => {
          await clearPendingInviteRef();
          closeToApp();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalHost: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  button: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
