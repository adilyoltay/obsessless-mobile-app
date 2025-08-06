import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

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
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          },
          android: {
            elevation: 8,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          },
          web: {
            boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.1)',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
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
      {/* AI Chat Tab - Şimdilik her zaman göster */}
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'AI Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} />
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