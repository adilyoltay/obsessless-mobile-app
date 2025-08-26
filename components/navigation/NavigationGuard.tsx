import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

interface NavigationGuardProps {
  children: React.ReactNode;
}

export function NavigationGuard({ children }: NavigationGuardProps) {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const hasNavigatedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id || null;
    if (lastUserIdRef.current !== currentUserId) {
      lastUserIdRef.current = currentUserId;
      hasNavigatedRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;

    const checkNavigation = async () => {
      const currentPath = segments.join('/');
      const inTabsGroup = segments[0] === '(tabs)';
      const inAuthGroup = segments[0] === '(auth)';
      const second = (segments as any)[1] || '';
      const inOnboardingRoute = inAuthGroup && (second === 'onboarding' || currentPath.startsWith('(auth)/onboarding'));

      if (!router || typeof router.replace !== 'function') { setIsChecking(false); return; }

      try {
        if (!user) {
          if (!inAuthGroup) {
            hasNavigatedRef.current = true;
            router.replace('/(auth)/login');
          }
          return;
        }

        // Strict: require onboarding completion
        const aiKey = `ai_onboarding_completed_${user.id}`;
        let localOnb = await AsyncStorage.getItem(aiKey);
        let aiCompleted = localOnb === 'true';
        if (!aiCompleted) {
          // Fallback to generic key (pre-auth completion)
          const generic = await AsyncStorage.getItem('ai_onboarding_completed');
          aiCompleted = generic === 'true';
          // Migrate to user-specific for future checks
          if (aiCompleted) {
            try { await AsyncStorage.setItem(aiKey, 'true'); } catch {}
          }
        }

        if (!aiCompleted) {
          if (!inOnboardingRoute) {
            hasNavigatedRef.current = true;
            router.replace('/(auth)/onboarding');
          }
          return;
        }

        // If completed, allow tabs; if currently in auth, go to tabs
        if (inAuthGroup) {
          hasNavigatedRef.current = true;
          router.replace('/(tabs)');
          return;
        }
      } finally {
        setIsChecking(false);
      }
    };

    const timer = setTimeout(checkNavigation, 200);
    return () => clearTimeout(timer);
  }, [user, authLoading, segments.join('/')]);

  if (authLoading || isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <>{children}</>;
}