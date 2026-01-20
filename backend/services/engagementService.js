const cron = require('node-cron');
const { notifyUser, NotificationTemplates } = require('./notificationService');

const supabase = global.supabase;
let schedulerStarted = false;

const FRIEND_RELATION_QUERY = (userId) =>
  `sender_id.eq.${userId},receiver_id.eq.${userId}`;

async function handleFriendStatusChange(userId, isAvailable) {
  if (!supabase) return;
  if (!isAvailable) return;

  const { data: friendships, error: friendsError } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(FRIEND_RELATION_QUERY(userId));

  if (friendsError) {
    console.error('❌ Error fetching friendships:', friendsError);
    return;
  }

  if (!friendships || friendships.length === 0) {
    return;
  }

  const friendIds = friendships.map((friendship) =>
    friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id
  );

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    console.error('❌ Error fetching user for chain effect:', userError);
    return;
  }

  const actorName = user.name;
  const actorAvatar = user.avatar_url || null;
  const template = NotificationTemplates.status_change_online(actorName);

  await Promise.all(
    friendIds.map((friendId) =>
      notifyUser({
        userId: friendId,
        ...template,
        data: {
          user_id: userId,
          actorId: userId,
          actorName,
          actorAvatarUrl: actorAvatar,
          imageUrl: actorAvatar
        },
        triggeredBy: userId
      }).catch((error) => {
        console.error('❌ Failed to send chain notification:', error?.message);
      })
    )
  );
}

function startEngagementScheduler() {
  if (schedulerStarted || !supabase) {
    return;
  }

  cron.schedule('0 18 * * *', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: inactiveUsers, error: inactiveError } = await supabase
      .from('user_status')
      .select('user_id, last_active')
      .lt('last_active', threeDaysAgo.toISOString());

    if (inactiveError) {
      console.error('❌ Error fetching inactive users:', inactiveError);
      return;
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return;
    }

    for (const inactiveUser of inactiveUsers) {
      const { data: friendships } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(FRIEND_RELATION_QUERY(inactiveUser.user_id));

      if (!friendships || friendships.length === 0) {
        continue;
      }

      const friendIds = friendships.map((friendship) =>
        friendship.sender_id === inactiveUser.user_id
          ? friendship.receiver_id
          : friendship.sender_id
      );

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: activeFriends } = await supabase
        .from('user_status')
        .select('user_id')
        .in('user_id', friendIds)
        .gt('last_active', sevenDaysAgo.toISOString());

      if (activeFriends && activeFriends.length > 0) {
        const template = NotificationTemplates.engagement_comeback();
        await notifyUser({
          userId: inactiveUser.user_id,
          ...template,
          data: {
            type: 'comeback',
            active_friends_count: activeFriends.length
          }
        }).catch((error) => {
          console.error('❌ Failed to send comeback notification:', error?.message);
        });
      }
    }
  });

  schedulerStarted = true;
  console.log('✅ Engagement scheduler started (daily 6 PM)');
}

async function notifyFriendsOnline(userId, onlineFriendIds) {
  if (!supabase) return;
  if (!onlineFriendIds || onlineFriendIds.length < 2) return;

  const topFriendIds = onlineFriendIds.slice(0, 3);

  const { data: friends, error } = await supabase
    .from('users')
    .select('name')
    .in('id', topFriendIds);

  if (error || !friends || friends.length === 0) {
    return;
  }

  const friendNames = friends.map((friend) => friend.name).join(', ');
  const template = NotificationTemplates.engagement_friends_online(friendNames);

  await notifyUser({
    userId,
    ...template,
    data: { friend_ids: onlineFriendIds, count: onlineFriendIds.length }
  }).catch((err) => {
    console.error('❌ Failed to send friends online notification:', err?.message);
  });
}

module.exports = {
  handleFriendStatusChange,
  notifyFriendsOnline,
  startEngagementScheduler
};

