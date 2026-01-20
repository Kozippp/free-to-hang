import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Bell, Calendar, ToggleLeft, User } from "lucide-react-native";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import usePlansStore from "@/store/plansStore";
import useNotificationsStore from "@/store/notificationsStore";
import useUnseenStore from "@/store/unseenStore";
import { useAuth } from "@/contexts/AuthContext";
import { initializeRealtimeManager, stopRealtimeManager } from "@/utils/realtimeManager";

export default function TabLayout() {
  const { user } = useAuth();
  const { invitations } = usePlansStore();
  const { unreadCount } = useNotificationsStore();
  const [hasUnreadInvitations, setHasUnreadInvitations] = useState(false);
  // Sync badge with the actual notifications list count
  const notificationsBadge = unreadCount;
  
  // Check for unread invitations
  useEffect(() => {
    const count = invitations.filter(plan => !plan.isRead).length;
    setHasUnreadInvitations(count > 0);
  }, [invitations]);

  // Initialize global realtime manager when user is authenticated
  useEffect(() => {
    if (!user?.id) {
      console.log('⏸️ No authenticated user - skipping realtime initialization');
      return;
    }
    
    console.log('🚀 Initializing global realtime manager...');
    initializeRealtimeManager(user.id);
    
    // Cleanup when layout unmounts or user signs out
    return () => {
      console.log('⏹️ Tab layout cleanup - stopping realtime manager');
      stopRealtimeManager();
    };
  }, [user?.id]);
  
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
                {notificationsBadge > 0 && (
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
                      {notificationsBadge > 9 ? '9+' : notificationsBadge}
                    </Text>
                  </View>
                )}
              </View>
            ),
            tabBarBadge: notificationsBadge > 0 ? notificationsBadge : undefined
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
