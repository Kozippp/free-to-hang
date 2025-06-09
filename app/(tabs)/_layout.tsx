import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Calendar, ToggleLeft, User } from "lucide-react-native";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";
import { Platform, View, Text } from "react-native";
import usePlansStore from "@/store/plansStore";
import useHangStore from "@/store/hangStore";
import useFriendsStore from "@/store/friendsStore";

export default function TabLayout() {
  const { invitations } = usePlansStore();
  const { startRealTimeUpdates: startHangUpdates, stopRealTimeUpdates: stopHangUpdates } = useHangStore();
  const { startRealTimeUpdates: startFriendsUpdates, stopRealTimeUpdates: stopFriendsUpdates } = useFriendsStore();
  const { startRealTimeUpdates: startPlansUpdates, stopRealTimeUpdates: stopPlansUpdates } = usePlansStore();
  const [hasUnreadInvitations, setHasUnreadInvitations] = useState(false);
  
  // 🌍 GLOBAL REALTIME - Start once when tabs load, stop when unmount
  useEffect(() => {
    console.log('🌍 Starting GLOBAL realtime for all features...');
    
    startHangUpdates();
    startFriendsUpdates();
    startPlansUpdates();
    
    return () => {
      console.log('🌍 Stopping GLOBAL realtime...');
      stopHangUpdates();
      stopFriendsUpdates();
      stopPlansUpdates();
    };
  }, []);
  
  // Check for unread invitations
  useEffect(() => {
    const unreadCount = invitations.filter(plan => !plan.isRead).length;
    setHasUnreadInvitations(unreadCount > 0);
  }, [invitations]);
  
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