import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Calendar, ToggleLeft, User } from "lucide-react-native";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";
import { Platform, View, Text } from "react-native";
import useNotificationsStore from "@/store/notificationsStore";
import NotificationDot from "@/components/NotificationDot";

export default function TabLayout() {
  const { getNotificationCounts } = useNotificationsStore();
  const [notificationCounts, setNotificationCounts] = useState({ hang: 0, plans: 0, profile: 0 });
  
  // Uuenda teavituste loendureid
  useEffect(() => {
    const updateCounts = () => {
      const counts = getNotificationCounts();
      setNotificationCounts(counts.byTab);
    };
    
    // Uuenda kohe
    updateCounts();
    
    // Uuenda iga sekund (võib hiljem optimeerida)
    const interval = setInterval(updateCounts, 1000);
    
    return () => clearInterval(interval);
  }, [getNotificationCounts]);
  
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
              <View style={{ position: 'relative' }}>
                <ToggleLeft size={size} color={color} />
                <NotificationDot 
                  count={notificationCounts.hang}
                  size="small"
                  style={{
                    top: -2,
                    right: -6,
                  }}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="plans"
          options={{
            title: "Plans",
            tabBarIcon: ({ color, size }) => (
              <View style={{ position: 'relative' }}>
                <Calendar size={size} color={color} />
                <NotificationDot 
                  count={notificationCounts.plans}
                  size="small"
                  style={{
                    top: -2,
                    right: -6,
                  }}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <View style={{ position: 'relative' }}>
                <User size={size} color={color} />
                <NotificationDot 
                  count={notificationCounts.profile}
                  size="small"
                  style={{
                    top: -2,
                    right: -6,
                  }}
                />
              </View>
            ),
          }}
        />
      </Tabs>
    </>
  );
}