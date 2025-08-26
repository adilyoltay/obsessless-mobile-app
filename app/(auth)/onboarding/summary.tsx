import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProgressDots from '@/components/onboarding/ProgressDots';

export default function Summary() {
  const router = useRouter();
  const { step, totalSteps, setStep, payload, complete } = useMoodOnboardingStore();
  const { user } = useAuth();

  useEffect(() => { setStep(5); }, [setStep]);

  const onFinish = async () => {
    // Best-effort: mark generic completion first to avoid loop before auth resolves
    try { await AsyncStorage.setItem('ai_onboarding_completed', 'true'); } catch {}
    // Prefer auth user id, else fallback
    const userId = user?.id || (global as any).__OBSESS_USER_ID || 'anon';
    await complete(userId);
    router.replace('/(tabs)');
  };

  const flags = payload.feature_flags || {};
  const enabled = Object.keys(flags).filter((k) => (flags as any)[k]);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#FFFFFF' }}>
      <ProgressDots current={step} total={totalSteps} />
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16 }}>
        Senin için açılanlar
      </Text>
      <Text style={{ color: '#374151', marginTop: 8 }}>
        {enabled.length > 0 ? enabled.join(', ') : 'Varsayılan akış'}
      </Text>

      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" onPress={onFinish} style={{ backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Başla</Text>
      </Pressable>
    </View>
  );
}


