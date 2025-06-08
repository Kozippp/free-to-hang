import { Platform, Alert } from 'react-native';

// Mock notifications utility (without expo-notifications package)
// When expo-notifications is installed, replace this with real implementation

// Mock notification handler
export const setNotificationHandler = (handler: any) => {
  console.log('Mock: Notification handler set', handler);
};

// Mock push token registration
export async function registerForPushNotificationsAsync() {
  console.log('Mock: Registering for push notifications...');
  
  // Simulate permission request
  const granted = await new Promise((resolve) => {
    Alert.alert(
      'Allow Notifications',
      'Allow push notifications?',
      [
        { text: 'No', onPress: () => resolve(false) },
        { text: 'Yes', onPress: () => resolve(true) }
      ]
    );
  });

  if (!granted) {
    console.log('Mock: Push notifications permission denied');
    return null;
  }

  // Mock token
  const mockToken = `ExponentPushToken[mock-${Platform.OS}-${Date.now()}]`;
  console.log('Mock Push token:', mockToken);
  return mockToken;
}

// Mock local notification (for testing)
export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  console.log('Mock Local Notification:', { title, body, data });
  
  // Show alert immediately (mock notification)
  setTimeout(() => {
    Alert.alert(title, body);
  }, 1000);
}

// Plan update notifications
export async function notifyPlanUpdate(planTitle: string, updateType: string) {
  const notifications = {
    'new_message': {
      title: '💬 New Message',
      body: `New message added to ${planTitle}`,
    },
    'participant_joined': {
      title: '🎉 Someone Joined!',
      body: `${planTitle} - new participant joined the plan`,
    },
    'poll_created': {
      title: '🗳️ New Poll',
      body: `${planTitle} - new poll has been created`,
    },
    'poll_voted': {
      title: '✅ Poll Ended',
      body: `${planTitle} - voting has ended`,
    },
  };

  const notification = notifications[updateType as keyof typeof notifications];
  
  if (notification) {
    console.log('Mock Plan Update Notification:', notification);
    await scheduleLocalNotification(
      notification.title,
      notification.body,
      { planId: 'plan-id', updateType }
    );
  }
}

// Invitation notifications
export async function notifyNewInvitation(planTitle: string, inviterName: string) {
  console.log('Mock Invitation Notification:', { planTitle, inviterName });
  await scheduleLocalNotification(
    '📨 New Invitation!',
    `${inviterName} invited you to: ${planTitle}`,
    { type: 'invitation' }
  );
}

// Test function
export async function testNotifications() {
  console.log('Testing notifications...');
  
  await notifyNewInvitation('Movie Night', 'Alex Johnson');
  
  setTimeout(() => {
    notifyPlanUpdate('Movie Night', 'new_message');
  }, 3000);
  
  setTimeout(() => {
    notifyPlanUpdate('Movie Night', 'participant_joined');
  }, 6000);
} 