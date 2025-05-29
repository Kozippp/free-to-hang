import { create } from 'zustand';

// Teavituste tüübid
export type NotificationType = 
  | 'new_invitation'           // Uus kutse
  | 'new_poll'                // Uus küsitlus
  | 'poll_winner'             // Küsitluse võitja kuulutamine
  | 'new_message'             // Uus sõnum
  | 'invitation_poll_expired' // Kutse küsitlus aegus
  | 'plan_updated';           // Plaan muudetud

// Teavituse objekt
export interface Notification {
  id: string;
  type: NotificationType;
  planId: string;
  pollId?: string;
  messageId?: string;
  title: string;
  description: string;
  createdAt: number;
  isRead: boolean;
  // Hierarhiline asukoha info
  location: {
    tab: 'hang' | 'plans' | 'profile';
    section?: 'invitations' | 'active' | 'completed';
    subsection?: 'control_panel' | 'chat';
    itemId?: string; // konkreetse elemendi ID
  };
}

// Lugemata teavituste arv erinevatel tasemetel
export interface NotificationCounts {
  total: number;
  byTab: {
    hang: number;
    plans: number;
    profile: number;
  };
  bySection: {
    invitations: number;
    active: number;
    completed: number;
  };
  byPlan: Record<string, {
    total: number;
    controlPanel: number;
    chat: number;
  }>;
}

interface NotificationsState {
  notifications: Notification[];
  
  // Tegevused
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: (planId?: string, subsection?: 'control_panel' | 'chat') => void;
  removeNotification: (notificationId: string) => void;
  clearOldNotifications: (olderThanDays: number) => void;
  
  // Loendajad
  getNotificationCounts: () => NotificationCounts;
  hasUnreadNotifications: (planId?: string, subsection?: 'control_panel' | 'chat') => boolean;
  getUnreadCount: (planId?: string, subsection?: 'control_panel' | 'chat') => number;
  
  // Demo funktsioon testide jaoks
  addDemoNotifications: () => void;
}

const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  
  addNotification: (notificationData) => {
    const notification: Notification = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      isRead: false,
    };
    
    set((state) => ({
      notifications: [notification, ...state.notifications]
    }));
  },
  
  markAsRead: (notificationId: string) => {
    set((state) => ({
      notifications: state.notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    }));
  },
  
  markAllAsRead: (planId?: string, subsection?: 'control_panel' | 'chat') => {
    set((state) => ({
      notifications: state.notifications.map(notification => {
        // Kui planId on määratud, märgi ainult selle plaani teavitused
        if (planId && notification.planId !== planId) {
          return notification;
        }
        
        // Kui subsection on määratud, märgi ainult selle sektsiooni teavitused
        if (subsection && notification.location.subsection !== subsection) {
          return notification;
        }
        
        return { ...notification, isRead: true };
      })
    }));
  },
  
  removeNotification: (notificationId: string) => {
    set((state) => ({
      notifications: state.notifications.filter(notification => 
        notification.id !== notificationId
      )
    }));
  },
  
  clearOldNotifications: (olderThanDays: number) => {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    set((state) => ({
      notifications: state.notifications.filter(notification => 
        notification.createdAt > cutoffTime
      )
    }));
  },
  
  getNotificationCounts: (): NotificationCounts => {
    const notifications = get().notifications.filter(n => !n.isRead);
    
    const counts: NotificationCounts = {
      total: notifications.length,
      byTab: {
        hang: 0,
        plans: 0,
        profile: 0,
      },
      bySection: {
        invitations: 0,
        active: 0,
        completed: 0,
      },
      byPlan: {},
    };
    
    notifications.forEach(notification => {
      // Tab loendajad
      counts.byTab[notification.location.tab]++;
      
      // Sektsiooni loendajad
      if (notification.location.section) {
        counts.bySection[notification.location.section]++;
      }
      
      // Plaani loendajad
      if (!counts.byPlan[notification.planId]) {
        counts.byPlan[notification.planId] = {
          total: 0,
          controlPanel: 0,
          chat: 0,
        };
      }
      
      counts.byPlan[notification.planId].total++;
      
      if (notification.location.subsection === 'control_panel') {
        counts.byPlan[notification.planId].controlPanel++;
      } else if (notification.location.subsection === 'chat') {
        counts.byPlan[notification.planId].chat++;
      }
    });
    
    return counts;
  },
  
  hasUnreadNotifications: (planId?: string, subsection?: 'control_panel' | 'chat'): boolean => {
    return get().getUnreadCount(planId, subsection) > 0;
  },
  
  getUnreadCount: (planId?: string, subsection?: 'control_panel' | 'chat'): number => {
    const notifications = get().notifications.filter(n => !n.isRead);
    
    if (!planId && !subsection) {
      return notifications.length;
    }
    
    return notifications.filter(notification => {
      if (planId && notification.planId !== planId) {
        return false;
      }
      
      if (subsection && notification.location.subsection !== subsection) {
        return false;
      }
      
      return true;
    }).length;
  },
  
  // Demo funktsioon testide jaoks
  addDemoNotifications: () => {
    const { addNotification } = get();
    
    // Lisa mõned näite teavitused
    addNotification({
      type: 'new_invitation',
      planId: 'plan-1',
      title: 'Uus kutse',
      description: 'Sarah kutsus teid: "Reedel kinos"',
      location: {
        tab: 'plans',
        section: 'invitations',
      }
    });
    
    addNotification({
      type: 'new_poll',
      planId: 'plan-2',
      pollId: 'poll-1',
      title: 'Uus küsitlus',
      description: 'Uus küsitlus: "Millal sobib kõigile?"',
      location: {
        tab: 'plans',
        section: 'active',
        subsection: 'control_panel',
        itemId: 'poll-1'
      }
    });
    
    addNotification({
      type: 'new_message',
      planId: 'plan-2',
      messageId: 'msg-1',
      title: 'Uus sõnum',
      description: 'Alex: "Kas 19:00 sobib kõigile?"',
      location: {
        tab: 'plans',
        section: 'active',
        subsection: 'chat',
        itemId: 'msg-1'
      }
    });
  },
}));

export default useNotificationsStore; 