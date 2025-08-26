import { useEffect } from 'react';
import { router } from 'expo-router';

export default function OnboardingIndex() {
  useEffect(() => {
    // Redirect to the first step
    router.replace('/(auth)/onboarding/welcome');
  }, []);
  return null;
}


