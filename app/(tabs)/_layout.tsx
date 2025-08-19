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
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { aiSettingsUtils } from '@/store/aiSettingsStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  // AI Chat removed

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
        name="unified-tracking"
        options={{
          title: 'Terapi',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'heart-pulse' : 'heart-pulse-outline'} color={color} />
          ),
        }}
      />
      {/* Eski tracking ve erp sayfaları birleştirildi */}
      <Tabs.Screen
        name="tracking"
        options={{
          href: null, // Gizle
        }}
      />
      <Tabs.Screen
        name="erp"
        options={{
          href: null, // Gizle
        }}
      />
      <Tabs.Screen
        name="thought-record"
        options={{
          title: 'CBT',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'book' : 'book-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="breathwork"
        options={{
          title: 'Nefes',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'leaf' : 'leaf-outline'} color={color} />
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