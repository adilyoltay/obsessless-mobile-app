import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { OnboardingWizard } from './Wizard';
import { UserProfile, TreatmentPlan } from '@/features/ai/types';

export default function OnboardingScreen() {
  const { user } = useAuth();

  if (!user) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
  }

  const handleComplete = async (profile: UserProfile, plan: TreatmentPlan) => {
    try {
      await AsyncStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      await AsyncStorage.setItem(`user_profile_${user.id}`, JSON.stringify(profile));
      await AsyncStorage.setItem(`treatment_plan_${user.id}`, JSON.stringify(plan));
    } catch (e) {
      console.error('Onboarding save failed', e);
    }
    router.replace('/(tabs)');
  };

  return (
    <OnboardingWizard userId={user.id} onComplete={handleComplete} />
  );
}
