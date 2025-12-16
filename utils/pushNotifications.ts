import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '@/lib/supabase';

const EXPO_PROJECT_ID = '18a79a9c-af0a-4fb5-a752-3831e49d89ba';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

const resolveProjectId = () => {
  const easProjectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    EXPO_PROJECT_ID;
  return easProjectId;
};

export async function registerForPushNotifications(userId: string) {
  console.log('🔔 Push notifications disabled (waiting for Apple Developer Account)');
  console.log('ℹ️ User ID:', userId);
  // TODO: Enable when Apple Developer Account is set up
  // This will require:
  // 1. Paid Apple Developer Account
  // 2. APNs key/certificate
  // 3. Update app.json with proper credentials
  return null;
}

export function useNotificationObserver(
  onNotification?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void
) {
  useEffect(() => {
    const receiveListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 Notification received:', notification.request.identifier);
      onNotification?.(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('🔔 Notification tapped:', response.notification.request.identifier);
      onResponse?.(response);
    });

    return () => {
      receiveListener.remove();
      responseListener.remove();
    };
  }, [onNotification, onResponse]);
}

export async function updateLastActive(userId: string) {
  try {
    await supabase
      .from('user_status')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', userId);
  } catch (error) {
    console.error('❌ Failed to update last active timestamp:', error);
  }
}

