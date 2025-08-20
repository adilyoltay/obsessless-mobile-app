import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Alert } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { aiSettingsUtils } from '@/store/aiSettingsStore';
import { useERPSettingsStore } from '@/store/erpSettingsStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const erpStore = useERPSettingsStore();
  // AI Chat removed

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#059669', // Daha koyu yeşil (kontrast artırıldı)
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
              color={focused ? '#10B981' : '#9CA3AF'} 
            />
          ),
          tabBarActiveTintColor: '#10B981', // Daha sakin yeşil
        }}
      />
      
      <Tabs.Screen
        name="mood"
        options={{
          title: 'Mood',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon 
              name={focused ? 'happy' : 'happy-outline'} 
              color={focused ? '#F472B6' : '#9CA3AF'} 
              size={26} 
            />
          ),
          tabBarActiveTintColor: '#F472B6', // Daha sakin pembe
        }}
      />
      
      <Tabs.Screen
        name="cbt"
        options={{
          title: 'CBT',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon 
              name={focused ? 'bulb' : 'bulb-outline'} 
              color={focused ? '#A78BFA' : '#9CA3AF'} 
              size={26} 
            />
          ),
          tabBarActiveTintColor: '#A78BFA', // Daha sakin mor
        }}
      />
      
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'OCD',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon 
              name={focused ? 'pulse' : 'pulse-outline'} 
              color={focused ? '#34D399' : '#9CA3AF'} 
              size={26} 
            />
          ),
          tabBarActiveTintColor: '#34D399', // Daha sakin yeşil
        }}
      />
      
      {/* ERP Tab - Store ile dinamik olarak gösterilir */}
      {erpStore.isEnabled && (
        <Tabs.Screen
          name="erp"
          options={{
            title: 'ERP',
            tabBarIcon: ({ focused }) => (
              <TabBarIcon 
                name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} 
                color={focused ? '#67E8F9' : '#9CA3AF'} 
                size={26} 
              />
            ),
            tabBarActiveTintColor: '#67E8F9', // Daha sakin cyan
          }}
        />
      )}

      <Tabs.Screen
        name="breathwork"
        options={{
          href: null, // Tab'da görünmez ama route olarak erişilebilir kalır
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
          tabBarIcon: ({ focused }) => (
            <TabBarIcon 
              name={focused ? 'settings' : 'settings-outline'} 
              color={focused ? '#9CA3AF' : '#9CA3AF'} 
              size={26} 
            />
          ),
          tabBarActiveTintColor: '#9CA3AF', // Daha sakin gri
        }}
      />
    </Tabs>
  );
}