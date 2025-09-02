import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAdvancedMoodColor } from '@/utils/colorUtils';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useAuth } from '@/contexts/SupabaseAuthContext';


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [activeColor, setActiveColor] = useState<string>('#059669');
  const [colorMode, setColorMode] = useState<'static' | 'today' | 'weekly'>('today');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('app_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          const mode = parsed?.colorMode as 'static' | 'today' | 'weekly' | undefined;
          if (mode) setColorMode(mode);
        }
        let score = 55;
        const s = await AsyncStorage.getItem('ui_color_score');
        if (s && !isNaN(Number(s))) score = Number(s);
        const color = colorMode === 'static' ? '#059669' : getAdvancedMoodColor(score);
        setActiveColor(color);
      } catch {}
    })();
  }, [user?.id]);

  // AI Chat removed

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor, // Dinamik aktif renk
        tabBarInactiveTintColor: '#374151', // Daha koyu gri (kontrast artırıldı)
        headerShown: false,
        tabBarButton: HapticTab, // Master Prompt: Haptic feedback enabled
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1.5,
            borderTopColor: '#D1D5DB',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          },
          android: {
            elevation: 10,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1.5,
            borderTopColor: '#D1D5DB',
          },
          web: {
            boxShadow: '0px -2px 10px rgba(0, 0, 0, 0.12)',
            borderTopWidth: 1.5,
            borderTopColor: '#D1D5DB',
            backgroundColor: '#FFFFFF',
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bugün',
          tabBarIcon: ({ focused }) => (
            <IconSymbol 
              size={28} 
              name="house.fill" 
              color={focused ? activeColor : '#9CA3AF'} 
            />
          ),
          tabBarActiveTintColor: activeColor,
        }}
      />
      
      <Tabs.Screen
        name="mood"
        options={{
          title: 'Mood',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon 
              name={focused ? 'happy' : 'happy-outline'} 
              color={focused ? activeColor : '#9CA3AF'} 
              size={26} 
            />
          ),
          tabBarActiveTintColor: activeColor,
        }}
      />
      
      


      <Tabs.Screen
        name="breathwork"
        options={{
          href: null, // Tab'da görünmez ama route olarak erişilebilir kalır
          title: 'Nefes',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'leaf' : 'leaf-outline'} color={focused ? activeColor : color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon 
              name={focused ? 'settings' : 'settings-outline'} 
              color={focused ? activeColor : '#9CA3AF'} 
              size={26} 
            />
          ),
          tabBarActiveTintColor: activeColor,
        }}
      />
    </Tabs>
  );
}
