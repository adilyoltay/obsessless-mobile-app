import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab, // Master Prompt: Haptic feedback enabled
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.15)',
          },
          android: {
            elevation: 8,
            boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.15)',
          },
          web: {
            boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.1)',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bugün',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Takip',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'pulse' : 'pulse-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="erp"
        options={{
          title: 'ERP',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}