import { NotificationRecord, NotificationSender } from '@/store/notificationsStore';

export type NotificationGroupType = 
  | 'chat_message' 
  | 'plan_activity' 
  | 'friend_request' 
  | 'plan_invite'
  | 'other';

export interface NotificationGroup {
  id: string;
  type: NotificationGroupType;
  items: NotificationRecord[];
  lastCreated: string;
  isRead: boolean;
  title: string; // Rich text ready description
  actors: NotificationSender[];
  contextId?: string; // planId or roomId
  count: number;
  unreadCount: number;
}

export function groupNotifications(notifications: NotificationRecord[]): NotificationGroup[] {
  const groups: Record<string, NotificationGroup> = {};
  const order: string[] = []; // To preserve order based on latest notification

  notifications.forEach((notification) => {
    let groupId = notification.id;
    let groupType: NotificationGroupType = 'other';
    let contextId: string | undefined;

    const data = notification.data || {};

    // Determine Group ID and Type
    if (notification.type === 'chat_message') {
      // Chat messages usually have plan_id in our system
      const roomId = data.roomId || data.room_id || data.plan_id || data.planId;
      if (roomId) {
        groupId = `chat_${roomId}`;
        groupType = 'chat_message';
        contextId = roomId;
      }
    } else if (
      ['plan_update', 'plan_participant_joined', 'poll_created', 'poll_ended', 'poll_winner'].includes(notification.type)
    ) {
      const planId = data.planId || data.plan_id;
      if (planId) {
        groupId = `plan_${planId}`;
        groupType = 'plan_activity';
        contextId = planId;
      }
    } else if (notification.type === 'friend_request') {
      groupId = `friend_req_${notification.id}`;
      groupType = 'friend_request';
    } else if (notification.type === 'plan_invite') {
      groupId = `plan_invite_${notification.id}`;
      groupType = 'plan_invite';
      contextId = data.planId || data.plan_id;
    }

    // Initialize group if not exists
    if (!groups[groupId]) {
      groups[groupId] = {
        id: groupId,
        type: groupType,
        items: [],
        lastCreated: notification.created_at,
        isRead: true, // Will be false if any item is unread
        title: '',
        actors: [],
        contextId,
        count: 0,
        unreadCount: 0
      };
      order.push(groupId);
    }

    // Add item to group
    const group = groups[groupId];
    group.items.push(notification);
    group.count++;
    
    // Update group properties
    if (!notification.read) {
      group.isRead = false;
      group.unreadCount++;
    }
    // Keep the latest date
    if (new Date(notification.created_at) > new Date(group.lastCreated)) {
      group.lastCreated = notification.created_at;
    }

    // Add actor if exists and unique
    const dataActorId = data.actorId || data.actor_id || data.user_id;
    const dataActorName = data.actorName || data.actor_name;
    const dataActorAvatar = data.actorAvatarUrl || data.actor_avatar_url;
    const fallbackSender = dataActorId
      ? {
          id: dataActorId,
          name: dataActorName || null,
          username: null,
          avatar_url: dataActorAvatar || null
        }
      : null;

    const senderToUse = notification.sender?.id ? notification.sender : fallbackSender;
    if (senderToUse?.id) {
      const exists = group.actors.some(a => a.id === senderToUse?.id);
      if (!exists) {
        group.actors.push(senderToUse);
      }
    }
  });

  // Finalize groups (generate titles)
  return order.map(groupId => {
    const group = groups[groupId];
    group.title = generateGroupTitle(group);
    return group;
  });
}

function resolveActorName(actor?: NotificationSender, fallback = 'Someone'): string {
  const name = actor?.name?.trim();
  return name && name.length > 0 ? name : fallback;
}

function generateGroupTitle(group: NotificationGroup): string {
  const actors = group.actors;
  const unreadCount = group.unreadCount;
  const totalCount = group.count;
  
  // Use unread count if there are unread items, otherwise use total count
  const displayCount = unreadCount > 0 ? unreadCount : totalCount;
  const isNew = unreadCount > 0;
  
  // If we have actors, use the first one's name. If not, try to parse from body/title if desperate, but 'Someone' is safer default.
  // Ideally RLS fix will ensure actors are present.
  const firstActorName = resolveActorName(actors[0]);
  
  if (group.type === 'chat_message') {
    // Attempt to get room name from notification title usually "Sender in PlanName"
    // But data.roomName might be missing.
    // If grouped, we can assume they are from the same room.
    // We can try to extract plan name from notification title regex if needed, or fallback to 'Chat'.
    let roomName =
      group.items[0]?.data?.roomName ||
      group.items[0]?.data?.room_name ||
      group.items[0]?.data?.planName ||
      group.items[0]?.data?.plan_name;
    
    if (!roomName) {
        // Try to parse from title "💬 Sender in PlanName"
        const title = group.items[0]?.title || '';
        const match = title.match(/ in (.+)$/);
        if (match) {
            roomName = match[1];
        } else {
            roomName = 'the group';
        }
    }

    const messageWord = isNew ? 'new messages' : 'messages';

    if (displayCount === 1) {
      return `**${firstActorName}** sent a message in **${roomName}**`;
    }
    if (actors.length === 1) {
      return `**${firstActorName}** sent ${displayCount} ${messageWord} in **${roomName}**`;
    }
    if (actors.length === 2) {
      return `**${resolveActorName(actors[0])}** and **${resolveActorName(actors[1])}** sent messages in **${roomName}**`;
    }
    return `**${resolveActorName(actors[0])}**, **${resolveActorName(actors[1])}** and ${actors.length - 2} others sent messages in **${roomName}**`;
  }

  if (group.type === 'plan_activity') {
    // Try to get plan name
    let planName =
      group.items[0]?.data?.planName ||
      group.items[0]?.data?.plan_name ||
      group.items[0]?.data?.planTitle;
    if (!planName) {
         // Try to parse? Usually not in title for updates.
         // Let's fallback to "Plan" but we really want the name.
         // Maybe we can infer from body if it says "in PlanName".
         const body = group.items[0]?.body || '';
         const match = body.match(/ in "(.+)"$/) || body.match(/ in (.+)$/);
         if (match) planName = match[1];
         else planName = 'Plan';
    }
    
    // Check if mostly joins
    const joinCount = group.items.filter(i => i.type === 'plan_participant_joined').length;
    
    if (joinCount === group.items.length) {
       if (displayCount === 1) return `**${firstActorName}** joined **${planName}**`;
       if (actors.length === 2) return `**${resolveActorName(actors[0])}** and **${resolveActorName(actors[1])}** joined **${planName}**`;
       // If actors are missing but count is > 1 (e.g. system join?), fallback
       if (actors.length === 0) return `${displayCount} people joined **${planName}**`;
       return `**${resolveActorName(actors[0])}** and ${displayCount - 1} others joined **${planName}**`;
    }

    // Mixed activity or other updates
    // Requested format: "**Plan Name**\nX new notifications"
    // We use a special separator that UI can handle or just newline
    const suffix = isNew ? 'new notifications' : 'notifications';
    return `**${planName}**\n${displayCount} ${suffix}`;
  }

  if (group.type === 'friend_request') {
    return `**${firstActorName}** sent you a friend request`;
  }

  if (group.type === 'plan_invite') {
    const planName =
      group.items[0]?.data?.planName ||
      group.items[0]?.data?.plan_name ||
      group.items[0]?.data?.planTitle ||
      'a plan';
    // Title usually "Inviter invited you to Plan"
    const body = group.items[0]?.body || '';
    const match = body.match(/invited you to (.+)$/);
    const resolvedPlanName = match ? match[1] : planName;
    
    return `**${firstActorName}** invited you to join **${resolvedPlanName}**`;
  }

  // Fallback
  return group.items[0]?.body || group.items[0]?.title || 'New notification';
}
