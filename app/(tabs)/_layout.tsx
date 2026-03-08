import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { Bell, Calendar, ToggleLeft, User } from "lucide-react-native";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import useNotificationsStore from "@/store/notificationsStore";
import useUnseenStore from "@/store/unseenStore";
import { useAuth } from "@/contexts/AuthContext";
import { initializeRealtimeManager, stopRealtimeManager } from "@/utils/realtimeManager";
import * as Notifications from "expo-notifications";

// ─────────────────────────────────────────────────────────────
// Small reusable red dot
// ─────────────────────────────────────────────────────────────
function RedDot() {
  return (
    <View
      style={{
        position: "absolute",
        top: -2,
        right: -6,
        backgroundColor: "#FF3B30",
        borderRadius: 3.5,
        width: 7,
        height: 7,
      }}
    />
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const { unreadCount } = useNotificationsStore();
  const {
    invitationUnreadCount,
    totalPlanUnseen,
    friendRequestCount,
    newFriendsCount,
  } = useUnseenStore();

  // Initialize global realtime manager when user is authenticated
  useEffect(() => {
    if (!user?.id) return;
    initializeRealtimeManager(user.id);
    return () => {
      stopRealtimeManager();
    };
  }, [user?.id]);

  // Sync app icon badge with total unseen
  useEffect(() => {
    const badgeCount =
      totalPlanUnseen + invitationUnreadCount + unreadCount + friendRequestCount + newFriendsCount;
    Notifications.setBadgeCountAsync(badgeCount > 0 ? badgeCount : 0).catch(() => {});
  }, [totalPlanUnseen, invitationUnreadCount, unreadCount, friendRequestCount, newFriendsCount]);

  const hasPlansActivity = invitationUnreadCount > 0 || totalPlanUnseen > 0;
  const hasNotificationsActivity = unreadCount > 0;
  const hasProfileActivity = friendRequestCount > 0;
  const hasHangActivity = newFriendsCount > 0;

  return (
    <>
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
            fontWeight: "600",
            fontSize: 18,
          },
          headerTitleAlign: "center",
        }}
      >
        {/* Hang tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Hang",
            tabBarIcon: ({ color, size }) => (
              <View>
                <ToggleLeft size={size} color={color} />
                {hasHangActivity && <RedDot />}
              </View>
            ),
          }}
        />

        {/* Plans tab */}
        <Tabs.Screen
          name="plans"
          options={{
            title: "Plans",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Calendar size={size} color={color} />
                {hasPlansActivity && <RedDot />}
              </View>
            ),
          }}
        />

        {/* Notifications tab */}
        <Tabs.Screen
          name="notifications"
          options={{
            title: "Notifications",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Bell size={size} color={color} />
                {hasNotificationsActivity && <RedDot />}
              </View>
            ),
          }}
        />

        {/* Profile tab */}
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <View>
                <User size={size} color={color} />
                {hasProfileActivity && <RedDot />}
              </View>
            ),
          }}
        />
      </Tabs>
    </>
  );
}
