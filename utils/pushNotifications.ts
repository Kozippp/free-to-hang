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
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    console.log('✅ Notification permissions granted');

    const projectId = resolveProjectId();
    console.log('🆔 Using Expo project ID:', projectId);
    
    // STEP 1: Get the push token (with proper error handling)
    let token: string;
    try {
      console.log('🎟️ Getting Expo push token...');
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = tokenResponse.data;
      console.log('🔔 Push token received:', token);
    } catch (error) {
      console.error('❌ Failed to get Expo push token:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Project ID used:', projectId);
      // Alert only if relevant to user action, otherwise silent fail or log
      return null;
    }

    // STEP 2: Save token to database (separate try-catch)
    try {
      console.log('💾 Saving push token to database...');
      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: userId,
            expo_push_token: token,
            device_type: Platform.OS,
            active: true,
            last_used_at: new Date().toISOString()
          },
          { onConflict: 'user_id,expo_push_token' }
        );

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }
      console.log('✅ Push token saved to database successfully');
    } catch (error) {
      console.error('❌ Failed to save push token:', error);
    }

    return token;
  } else {
    console.log('Must use physical device for Push Notifications');
    return null;
  }
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
