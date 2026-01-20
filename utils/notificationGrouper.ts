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
      const roomId = data.roomId || data.room_id;
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
        count: 0
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
    }
    // Keep the latest date
    if (new Date(notification.created_at) > new Date(group.lastCreated)) {
      group.lastCreated = notification.created_at;
    }

    // Add actor if exists and unique
    if (notification.sender) {
      const exists = group.actors.some(a => a.id === notification.sender?.id);
      if (!exists) {
        group.actors.push(notification.sender);
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

function generateGroupTitle(group: NotificationGroup): string {
  const actors = group.actors;
  const count = group.count;
  const firstActorName = actors[0]?.name || 'Someone';
  
  if (group.type === 'chat_message') {
    const roomName = group.items[0]?.data?.roomName || 'Chat';
    if (count === 1) {
      return `**${firstActorName}** saatis sõnumi grupis **${roomName}**`;
    }
    if (actors.length === 1) {
      return `**${firstActorName}** saatis ${count} uut sõnumit grupis **${roomName}**`;
    }
    if (actors.length === 2) {
      return `**${actors[0].name}** ja **${actors[1].name}** saatsid sõnumeid grupis **${roomName}**`;
    }
    return `**${actors[0].name}**, **${actors[1].name}** ja ${actors.length - 2} teist saatsid sõnumeid grupis **${roomName}**`;
  }

  if (group.type === 'plan_activity') {
    const planName = group.items[0]?.data?.planName || 'Plan';
    
    // Check if mostly joins
    const joinCount = group.items.filter(i => i.type === 'plan_participant_joined').length;
    
    if (joinCount === count) {
       if (count === 1) return `**${firstActorName}** liitus plaaniga **${planName}**`;
       if (actors.length === 2) return `**${actors[0].name}** ja **${actors[1].name}** liitusid plaaniga **${planName}**`;
       return `**${actors[0].name}** ja ${count - 1} teist liitusid plaaniga **${planName}**`;
    }

    // Mixed activity
    return `**${planName}**: ${count} uut teavitust (pollid, liitumised)`;
  }

  if (group.type === 'friend_request') {
    return `**${firstActorName}** saatis sulle sõbrakutse`;
  }

  if (group.type === 'plan_invite') {
    const planName = group.items[0]?.data?.planName || 'Plan';
    return `**${firstActorName}** kutsus sind plaaniga **${planName}** liituma`;
  }

  // Fallback
  return group.items[0]?.body || group.items[0]?.title || 'New notification';
}
