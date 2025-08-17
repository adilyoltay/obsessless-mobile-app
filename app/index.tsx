import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import supabaseService from '@/services/supabase';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import crossDeviceSync from '@/services/crossDeviceSync';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const handleInitialNavigation = async () => {
      if (loading) return; // Wait for auth to complete

      console.log('🏠 Index: Handling initial navigation...', { user: !!user, loading });

      try {
        if (!user) {
          console.log('🏠 No user, redirecting to login');
          router.replace('/(auth)/login');
          return;
        }

        // Check AI onboarding status (Supabase first, then local fallback)
        {
          let isCompleted = false;

          try {
            // Supabase check (ai_profiles, fallback user_profiles)
            const { data: profileRow, error } = await supabaseService.supabaseClient
              .from('ai_profiles')
              .select('onboarding_completed')
              .eq('user_id', user.id)
              .maybeSingle();

            if (!error && profileRow) {
              isCompleted = !!profileRow.onboarding_completed;
              if (__DEV__) console.log('🏠 Supabase onboarding status (ai_profiles):', isCompleted);
            } else {
              const { data: legacyRow } = await supabaseService.supabaseClient
                .from('user_profiles')
                .select('onboarding_completed')
                .eq('user_id', user.id)
                .maybeSingle();
              if (legacyRow) {
                isCompleted = !!legacyRow.onboarding_completed;
                if (__DEV__) console.log('🏠 Supabase onboarding status (user_profiles):', isCompleted);
              }
            }
          } catch (e) {
            // Telemetry: Supabase onboarding check failed
            await trackAIError({
              code: 'storage_error' as any,
              message: 'Supabase onboarding check failed',
              severity: 'medium' as any,
            }, {
              component: 'app/index',
              method: 'handleInitialNavigation',
              phase: 'supabase_onboarding_check'
            });
          }

           if (!isCompleted) {
            // Local fallback
            const aiOnboardingKey = `ai_onboarding_completed_${user.id || 'anon'}`;
            const localCompleted = await AsyncStorage.getItem(aiOnboardingKey);
            isCompleted = localCompleted === 'true';
            if (__DEV__) {
              console.log('🏠 Local AI Onboarding check:', { key: aiOnboardingKey, isCompleted });
            }
             // Telemetry: Local fallback path observed
             await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
               source: 'local_onboarding_fallback',
               isCompleted
             }, user.id);
          }

          if (!isCompleted) {
            if (__DEV__) console.log('🏠 AI Onboarding not completed, redirecting...');
            router.replace('/(auth)/onboarding');
            return;
          }
        }

        // Default: go to main app (authenticated)
        try {
          // Run a background cross-device sync (non-blocking)
          crossDeviceSync.runInitialCrossDeviceSync(user.id);
        } catch {}
        console.log('🏠 User authenticated, redirecting to main app');
        router.replace('/(tabs)');

       } catch (error) {
        console.error('🏠 Navigation error:', error);
        await trackAIError({
          code: 'unknown' as any,
          message: 'Navigation error',
          severity: 'high' as any,
        }, {
          component: 'app/index',
          method: 'handleInitialNavigation'
        });
        router.replace('/(auth)/login');
      }
    };

    handleInitialNavigation();
  }, [user, loading]);

  // Show loading while auth and navigation resolve
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
} 