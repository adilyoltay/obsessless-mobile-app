import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

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

        // Check AI onboarding status
        if (FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2')) {
          const aiOnboardingKey = `ai_onboarding_completed_${user.id}`;
          const aiOnboardingCompleted = await AsyncStorage.getItem(aiOnboardingKey);
          
          console.log('🏠 AI Onboarding check:', { 
            key: aiOnboardingKey, 
            value: aiOnboardingCompleted, 
            isCompleted: aiOnboardingCompleted === 'true' 
          });
          
          if (aiOnboardingCompleted !== 'true') {
            console.log('🏠 AI Onboarding not completed, redirecting...');
            router.replace('/(auth)/ai-onboarding');
            return;
          }
        }

        // Default: go to main app
        console.log('🏠 User authenticated and onboarded, redirecting to main app');
        router.replace('/(tabs)');

      } catch (error) {
        console.error('🏠 Navigation error:', error);
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