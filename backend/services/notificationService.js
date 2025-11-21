const { Expo } = require('expo-server-sdk');

const supabase = global.supabase;
const expo = new Expo();

const TYPE_CATEGORY_MAP = {
  plan_invite: 'plan_notifications',
  plan_update: 'plan_notifications',
  plan_participant_joined: 'plan_notifications',
  poll_created: 'plan_notifications',
  poll_ended: 'plan_notifications',
  poll_winner: 'plan_notifications',
  chat_message: 'chat_notifications',
  friend_request: 'friend_notifications',
  friend_accepted: 'friend_notifications',
  status_change: 'status_notifications',
  engagement_friends_online: 'engagement_notifications',
  engagement_comeback: 'engagement_notifications'
};

async function createNotification({ userId, type, title, body, data = {}, triggeredBy = null }) {
  if (!supabase) {
    throw new Error('Supabase client not initialised');
  }

  const payload = {
    user_id: userId,
    type,
    title,
    body,
    data,
    triggered_by: triggeredBy,
    read: false
  };

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }

  return notification;
}

async function sendPushNotification({ userId, title, body, data = {} }) {
  if (!supabase) return;

  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId)
    .eq('active', true);

  if (tokenError) {
    console.error('❌ Error fetching push tokens:', tokenError);
    return;
  }

  if (!tokens || tokens.length === 0) {
    console.log('ℹ️ No push tokens found for user:', userId);
    return;
  }

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (prefs) {
    if (prefs.push_enabled === false) {
      console.log('ℹ️ Push notifications disabled for user:', userId);
      return;
    }
  }

  if (prefs?.quiet_hours_enabled && prefs.quiet_hours_start && prefs.quiet_hours_end) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    if (isInQuietHours(currentTime, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
      console.log('ℹ️ User in quiet hours, skipping push notification for:', userId);
      return;
    }
  }

  const messages = tokens
    .map(({ expo_push_token }) => {
      if (!Expo.isExpoPushToken(expo_push_token)) {
        console.warn('⚠️ Invalid Expo push token, skipping:', expo_push_token);
        return null;
      }

      return {
        to: expo_push_token,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high'
      };
    })
    .filter(Boolean);

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('❌ Error sending push notification chunk:', error);
    }
  }
}

async function notifyUser({
  userId,
  type,
  title,
  body,
  data = {},
  triggeredBy = null,
  sendPush = true
}) {
  try {
    const notification = await createNotification({
      userId,
      type,
      title,
      body,
      data,
      triggeredBy
    });

    if (sendPush) {
      const isActive = await checkIfUserActive(userId);
      if (!isActive) {
        const prefsAllow = await shouldSendForCategory(userId, type);
        if (prefsAllow) {
          await sendPushNotification({
            userId,
            title,
            body,
            data: { ...data, notification_id: notification.id }
          });
        } else {
          console.log(`ℹ️ Notification type ${type} disabled for user ${userId}`);
        }
      } else {
        console.log(`ℹ️ User ${userId} active recently, skipping push`);
      }
    }

    return notification;
  } catch (error) {
    console.error('❌ Error notifying user:', error);
    throw error;
  }
}

async function shouldSendForCategory(userId, type) {
  const categoryField = TYPE_CATEGORY_MAP[type];
  if (!categoryField) {
    return true;
  }

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select(categoryField)
    .eq('user_id', userId)
    .single();

  if (!prefs) return true;
  return prefs[categoryField] !== false;
}

async function checkIfUserActive(userId) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('user_status')
    .select('last_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.last_active) {
    return false;
  }

  const lastActive = new Date(data.last_active);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActive.getTime()) / 1000 / 60;
  return diffMinutes < 2;
}

function isInQuietHours(currentTime, startTime, endTime) {
  const start = startTime?.slice(0, 5);
  const end = endTime?.slice(0, 5);
  if (!start || !end) return false;

  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }
  return currentTime >= start && currentTime <= end;
}

const NotificationTemplates = {
  plan_invite: (planTitle, inviterName) => ({
    type: 'plan_invite',
    title: '📨 New Plan Invitation',
    body: `${inviterName} invited you to ${planTitle}`
  }),
  plan_participant_joined: (planTitle, userName) => ({
    type: 'plan_participant_joined',
    title: '🎉 New participant joined',
    body: `${userName} joined "${planTitle}"`
  }),
  poll_created: (planTitle, pollTitle) => ({
    type: 'poll_created',
    title: '🗳️ New poll created',
    body: `${pollTitle} in ${planTitle}`
  }),
  poll_winner: (planTitle, optionText) => ({
    type: 'poll_winner',
    title: '✅ Poll has a winner',
    body: `"${optionText}" won in ${planTitle}`
  }),
  chat_message: (planTitle, senderName, preview) => ({
    type: 'chat_message',
    title: `💬 ${senderName} in ${planTitle}`,
    body: preview
  }),
  friend_request: (userName) => ({
    type: 'friend_request',
    title: '👋 New friend request',
    body: `${userName} wants to connect`
  }),
  friend_accepted: (userName) => ({
    type: 'friend_accepted',
    title: '🎉 Friend request accepted',
    body: `${userName} accepted your request`
  }),
  status_change_online: (userName) => ({
    type: 'status_change',
    title: '🟢 Friend is free to hang',
    body: `${userName} is now available`
  }),
  engagement_friends_online: (friendNames) => ({
    type: 'engagement_friends_online',
    title: '🔥 Friends are planning',
    body: `${friendNames} are online right now`
  }),
  engagement_comeback: () => ({
    type: 'engagement_comeback',
    title: '👋 Your friends miss you',
    body: 'Jump back in and say you are free to hang!'
  })
};

module.exports = {
  NotificationTemplates,
  checkIfUserActive,
  createNotification,
  notifyUser,
  sendPushNotification
};

