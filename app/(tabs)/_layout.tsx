import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Calendar, ToggleLeft, User } from "lucide-react-native";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";
import { Platform, View, Text } from "react-native";
import usePlansStore from "@/store/plansStore";
import useHangStore from "@/store/hangStore";

export default function TabLayout() {
  const { invitations } = usePlansStore();
  const [hasUnreadInvitations, setHasUnreadInvitations] = useState(false);
  
  // Only keep hang real-time management (remove friends real-time)
  const { startRealTimeUpdates: startHangRealtime, stopRealTimeUpdates: stopHangRealtime } = useHangStore();
  
  // Check for unread invitations
  useEffect(() => {
    const unreadCount = invitations.filter(plan => !plan.isRead).length;
    setHasUnreadInvitations(unreadCount > 0);
  }, [invitations]);

  // Start only hang real-time system (friends real-time removed)
  useEffect(() => {
    let isMounted = true;
    
    const startRealtime = async () => {
      if (!isMounted) return;
      
      console.log('🚀 Starting hang realtime system...');
      
      // Start only hang realtime system
      startHangRealtime();
    };
    
    startRealtime();
    
    // Cleanup when layout unmounts
    return () => {
      isMounted = false;
      console.log('⏹️ Stopping hang realtime system...');
      stopHangRealtime();
    };
  }, []);
  
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