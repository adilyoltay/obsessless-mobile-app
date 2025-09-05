import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import TabBarLabel from '@/components/ui/TabBarLabel';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { ThemeProvider } from '@/contexts/ThemeContext';


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { colorMode, setColorMode, color: activeColor } = useAccentColor();

  // Keep colorMode in sync when coming back from Settings
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem('app_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            const mode = parsed?.colorMode as 'static' | 'today' | 'weekly' | undefined;
            if (mode && mode !== colorMode) setColorMode(mode);
          }
        } catch {}
      })();
    }, [user?.id, colorMode, setColorMode])
  );

  // AI Chat removed

  return (
    <ThemeProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: '#6B7280',
        headerShown: false,
        tabBarButton: HapticTab as any,
        tabBarBackground: TabBarBackground as any,
        tabBarStyle: {
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
          borderTopWidth: 0,
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bugün',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'home' : 'home-outline'}
              color={color as any}
              size={28}
              style={{ marginBottom: 0, marginTop: 0 }}
            />
          ),
          tabBarLabel: ({ color }) => (
            <TabBarLabel text="Bugün" color={color as any} style={{ marginTop: 1, letterSpacing: 0.1 }} />
          ),
        }}
      />
      
      {/* Mood tab removed: Mood journey now lives in Today screen */}
      
      


      <Tabs.Screen
        name="breathwork"
        options={{
          href: null, // Hidden; route accessible programmatically
          title: 'Nefes',
        }}
      />
      
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'settings' : 'settings-outline'}
              color={color as any}
              size={28}
              style={{ marginBottom: 0, marginTop: 0 }}
            />
          ),
          tabBarLabel: ({ color }) => (
            <TabBarLabel text="Ayarlar" color={color as any} style={{ marginTop: 1, letterSpacing: 0.1 }} />
          ),
        }}
      />
    </Tabs>
    </ThemeProvider>
  );
}
