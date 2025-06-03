import { Platform, Alert } from 'react-native';

// Mock notifications utility (ilma expo-notifications package'ita)
// Kui expo-notifications on paigaldatud, asenda see päris implementatsiooniga

// Mock notification handler
export const setNotificationHandler = (handler: any) => {
  console.log('Mock: Notification handler set', handler);
};

// Mock push token registration
export async function registerForPushNotificationsAsync() {
  console.log('Mock: Registering for push notifications...');
  
  // Simuleerime permission request'i
  const granted = await new Promise((resolve) => {
    Alert.alert(
      'Teavituste luba',
      'Kas lubada push teavitused?',
      [
        { text: 'Ei', onPress: () => resolve(false) },
        { text: 'Jah', onPress: () => resolve(true) }
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

// Mock kohalik teavitus (testimiseks)
export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  console.log('Mock Local Notification:', { title, body, data });
  
  // Näita alert'i kohe (mock notification)
  setTimeout(() => {
    Alert.alert(title, body);
  }, 1000);
}

// Plaanis uuenduste teavitused
export async function notifyPlanUpdate(planTitle: string, updateType: string) {
  const notifications = {
    'new_message': {
      title: '💬 Uus sõnum',
      body: `${planTitle} plaani lisati uus sõnum`,
    },
    'participant_joined': {
      title: '🎉 Keegi liitus!',
      body: `${planTitle} - uus osaline liitus plaaniga`,
    },
    'poll_created': {
      title: '🗳️ Uus hääletus',
      body: `${planTitle} - uus hääletus on loodud`,
    },
    'poll_voted': {
      title: '✅ Hääletus lõppes',
      body: `${planTitle} - hääletus on lõppenud`,
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

// Kutse teavitused
export async function notifyNewInvitation(planTitle: string, inviterName: string) {
  console.log('Mock Invitation Notification:', { planTitle, inviterName });
  await scheduleLocalNotification(
    '📨 Uus kutse!',
    `${inviterName} kutsus teid: ${planTitle}`,
    { type: 'invitation' }
  );
}

// Test funktsioon
export async function testNotifications() {
  console.log('Testing notifications...');
  
  await notifyNewInvitation('Kinno minek', 'Alex Johnson');
  
  setTimeout(() => {
    notifyPlanUpdate('Kinno minek', 'new_message');
  }, 3000);
  
  setTimeout(() => {
    notifyPlanUpdate('Kinno minek', 'participant_joined');
  }, 6000);
} 