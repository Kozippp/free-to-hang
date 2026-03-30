import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

import { ErrorBoundary } from "./error-boundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";
import { registerForPushNotifications, updateLastActive } from "@/utils/pushNotifications";
import { pruneAvatarCache } from "@/utils/avatarCache";
import useNotificationsStore from "@/store/notificationsStore";
import useUnseenStore from "@/store/unseenStore";
import { useRouter } from "expo-router";
import { handleNotificationNavigation } from "@/utils/navigationHelper";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(auth)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  const { loading, user } = useAuth();
  const unreadCount = useNotificationsStore(state => state.unreadCount);
  const totalUnseen = useUnseenStore(state => state.totalUnseen);
  const fetchUnseenCounts = useUnseenStore(state => state.fetchUnseenCounts);
  const router = useRouter();
  const [notificationResponse, setNotificationResponse] = useState<Notifications.NotificationResponse | null>(null);

  // 1. Handle background/killed state notification launch
  useEffect(() => {
    let isMounted = true;

    Notifications.getLastNotificationResponseAsync().then(response => {
      if (isMounted && response) {
        console.log('🔔 Found initial notification response');
        setNotificationResponse(response);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Handle foreground/background notification tap while app is running
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 Notification tapped while app running');
      setNotificationResponse(response);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 3. Process the notification ONLY when user is authenticated and ready
  useEffect(() => {
    if (loading || !user?.id || !notificationResponse) {
      return;
    }

    console.log('🚀 Processing notification navigation for authenticated user');
    
    const { notification } = notificationResponse;
    const { request } = notification;
    const { content } = request;
    
    const notificationData = {
      type: content.data?.type,
      data: content.data
    };
    
    // Check if data exists before navigating
    if (notificationData.data) {
        handleNotificationNavigation(notificationData, router);
    } else {
        console.log('⚠️ Notification missing data payload:', notificationData);
    }
    
    // Clear the response so we don't process it again
    setNotificationResponse(null);
  }, [loading, user?.id, notificationResponse, router]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Register for push notifications with Apple Developer Account
    registerForPushNotifications(user.id);
    updateLastActive(user.id);
    pruneAvatarCache().catch((error) => {
      console.warn('⚠️ Failed to prune avatar cache:', error);
    });

    const interval = setInterval(() => {
      updateLastActive(user.id);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    fetchUnseenCounts();

    const interval = setInterval(() => {
      fetchUnseenCounts();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchUnseenCounts, user?.id]);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    // Update badge count with unread notifications
    const badgeCount = totalUnseen > 0 ? totalUnseen : unreadCount;
    Notifications.setBadgeCountAsync(badgeCount).catch((error) =>
      console.error('❌ Failed to set badge count:', error)
    );
  }, [totalUnseen, unreadCount]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="invite/[ref]"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      
      {/* Loading overlay for smooth transitions */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '500',
  },
});
