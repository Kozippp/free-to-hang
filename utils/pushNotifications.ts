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
  console.log('🔔 Starting push notification registration for user:', userId);
  
  // NOTE: Temporarily disabled for emulator testing
  // if (!Device.isDevice) {
  //   console.log('⚠️ Push notifications require physical device');
  //   return null;
  // }

  console.log('✅ Attempting registration (emulator mode enabled)');

  if (Platform.OS === 'android') {
    console.log('📱 Setting up Android notification channel');
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C'
    });
  }

  console.log('📋 Checking notification permissions...');
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('Current permission status:', existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    console.log('🔐 Requesting notification permissions...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('New permission status:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    console.log('❌ Notification permissions denied');
    Alert.alert('Notifications disabled', 'Enable push notifications in settings to stay updated.');
    return null;
  }

  console.log('✅ Notification permissions granted');

  const projectId = resolveProjectId();
  console.log('🆔 Using Expo project ID:', projectId);
  
  // STEP 1: Get the push token (with proper error handling and retry logic)
  let token: string;
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎟️ Getting Expo push token (attempt ${attempt}/${maxRetries})...`);
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = tokenResponse.data;
      console.log('🔔 Push token received:', token);
      break; // Success, exit the retry loop
    } catch (error: any) {
      console.error(`❌ Failed to get Expo push token (attempt ${attempt}/${maxRetries}):`, error);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message
      });
      console.error('Project ID used:', projectId);
      
      // Check if error is transient (503 Service Unavailable)
      const isTransient = error?.code === 'ERR_NOTIFICATIONS_SERVER_ERROR' || 
                          error?.message?.includes('503') ||
                          error?.message?.includes('SERVICE_UNAVAILABLE');
      
      if (attempt < maxRetries && isTransient) {
        console.log(`⏳ Expo server temporarily unavailable. Retrying in ${retryDelay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // If we've exhausted retries or it's not a transient error
      Alert.alert(
        'Push Notification Error',
        isTransient 
          ? 'Expo notification server is temporarily unavailable. Please try again in a few moments.'
          : 'Failed to get push notification token. Please check your internet connection and try again.'
      );
      return null;
    }
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
    console.log('📊 Token details:', {
      userId,
      token: token.substring(0, 30) + '...',
      deviceType: Platform.OS,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to save push token:', error);
    Alert.alert('Warning', 'Failed to register for push notifications. You may not receive notifications.');
  }

  return token;
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

