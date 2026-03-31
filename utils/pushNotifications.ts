import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '@/lib/supabase';

const EXPO_PROJECT_ID = '18a79a9c-af0a-4fb5-a752-3831e49d89ba';

const resolveNotificationPlanId = (data: Record<string, any> | undefined) => {
  if (!data) return null;
  const planId = data.plan_id ?? data.planId;
  return typeof planId === 'string' ? planId : null;
};

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if we are currently viewing the chat for this notification
    const data = notification.request.content.data as Record<string, any> | undefined;
    const notificationPlanId = resolveNotificationPlanId(data);

    if (currentActivePlanId && notificationPlanId === currentActivePlanId) {
      console.log(`🔕 Suppressing notification for active chat: ${notificationPlanId}`);
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    };
  }
});

let currentActivePlanId: string | null = null;

export const setActivePlanId = (planId: string | null) => {
  currentActivePlanId = planId;
  console.log(`📱 Active chat plan set to: ${planId}`);
};

const resolveProjectId = () => {
  const easProjectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    EXPO_PROJECT_ID;
  return easProjectId;
};

/** Registers token for the current session; RPC uses auth.uid() (must match userId). */
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
      console.log('💾 Saving push token to database for user:', userId);
      // RPC function:
      // 1. Deactivates any old tokens for this user
      // 2. Registers/reassigns this token to current user
      // 3. Handles account switches automatically (ON CONFLICT)
      const { error } = await supabase.rpc('register_expo_push_token', {
        p_expo_push_token: token,
        p_device_type: Platform.OS,
      });

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }
      console.log('✅ Push token saved to database successfully');
      console.log('🔄 Old tokens deactivated, new token is now active');
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

/** Deactivates push token on sign out */
export async function deactivatePushToken() {
  if (Platform.OS === 'android') {
    // Skip on Android emulator
    if (!Device.isDevice) {
      console.log('📱 Skipping push token deactivation on emulator');
      return;
    }
  }

  try {
    const projectId = resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse.data;

    console.log('🔕 Deactivating push token on sign out:', token);

    const { error } = await supabase.rpc('deactivate_push_token', {
      p_expo_push_token: token,
    });

    if (error) {
      console.error('❌ Failed to deactivate push token:', error);
    } else {
      console.log('✅ Push token deactivated successfully');
    }
  } catch (error) {
    console.error('❌ Error during push token deactivation:', error);
  }
}
