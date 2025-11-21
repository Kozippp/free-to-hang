import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Bell, Calendar, ToggleLeft, User } from "lucide-react-native";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import usePlansStore from "@/store/plansStore";
import useHangStore from "@/store/hangStore";
import useFriendsStore from "@/store/friendsStore";
import useChatStore from "@/store/chatStore";
import useNotificationsStore from "@/store/notificationsStore";
import { useAuth } from "@/contexts/AuthContext";

export default function TabLayout() {
  const { user } = useAuth();
  const { invitations } = usePlansStore();
  const [hasUnreadInvitations, setHasUnreadInvitations] = useState(false);
  
  // Real-time management for both hang and friends
  const { startRealTimeUpdates: startHangRealtime, stopRealTimeUpdates: stopHangRealtime } = useHangStore();
  const { startRealTimeUpdates: startFriendsRealtime, stopRealTimeUpdates: stopFriendsRealtime } = useFriendsStore();
  const {
    unreadCount,
    fetchNotifications,
    startRealTimeUpdates: startNotificationsRealtime,
    stopRealTimeUpdates: stopNotificationsRealtime
  } = useNotificationsStore();
  
  // Check for unread invitations
  useEffect(() => {
    const unreadCount = invitations.filter(plan => !plan.isRead).length;
    setHasUnreadInvitations(unreadCount > 0);
  }, [invitations]);

  // Start both hang and friends real-time systems - only when user is authenticated
  useEffect(() => {
    let isMounted = true;
    
    const startRealtime = async () => {
      if (!isMounted || !user) {
        console.log('⏸️ Skipping realtime start - no authenticated user');
        return;
      }
      
      console.log('🚀 Starting global realtime systems...');

      // Start hang realtime system globally
      startHangRealtime();
      if (user?.id) {
        fetchNotifications(user.id);
        startNotificationsRealtime(user.id);
      }
      // Friends realtime starts individually in profile tab to avoid duplication
    };
    
    if (user) {
      startRealtime();
    }
    
    // Cleanup when layout unmounts or user signs out
    return () => {
      if (!isMounted) return; // Prevent double cleanup
      isMounted = false;
      console.log('⏹️ Tab layout cleanup');
      
      stopHangRealtime();
      stopFriendsRealtime();
      stopNotificationsRealtime();
      
      // Stop plans realtime
      const plansStore = usePlansStore.getState();
      plansStore.stopRealTimeUpdates();
      
      // Cleanup all chat subscriptions
      const chatStore = useChatStore.getState();
      const chatPlanIds = Object.keys(chatStore.subscriptions || {});
      console.log(`🧹 Cleaning up ${chatPlanIds.length} chat subscriptions`);
      chatPlanIds.forEach(planId => {
        chatStore.unsubscribeFromChat(planId, { preserveDesired: false });
      });
    };
  }, [user]); // Add user as dependency
  
  return (
    <>
      {/* Set status bar to dark content for better visibility on light backgrounds */}
      <StatusBar style="dark" />
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.light.primary,
          tabBarInactiveTintColor: Colors.light.secondaryText,
          tabBarStyle: {
            borderTopColor: Colors.light.border,
            backgroundColor: Colors.light.background,
            elevation: 0,
            shadowOpacity: 0.1,
          },
          headerStyle: {
            backgroundColor: Colors.light.background,
            elevation: 0,
            shadowOpacity: 0.1,
            borderBottomWidth: 1,
            borderBottomColor: Colors.light.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerTitleAlign: 'center',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Hang",
            tabBarIcon: ({ color, size }) => (
              <ToggleLeft size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plans"
          options={{
            title: "Plans",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Calendar size={size} color={color} />
                {hasUnreadInvitations && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -6,
                    backgroundColor: '#FF3B30', // Instagram-style red
                    borderRadius: 3.5,
                    width: 7, // 15% smaller than before
                    height: 7,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: "Notifications",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Bell size={size} color={color} />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      backgroundColor: '#FF3B30',
                      borderRadius: 7,
                      width: 14,
                      height: 14,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <User size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}