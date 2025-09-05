import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import ProgressDots from '@/components/onboarding/ProgressDots';

export default function Welcome() {
  const router = useRouter();
  const { step, totalSteps, next, setStep } = useMoodOnboardingStore();
  const theme = useThemeColors();

  useEffect(() => { setStep(0); }, [setStep]);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: theme.background, justifyContent: 'center' }}>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '700', color: '#111827', textAlign: 'center' }}>
        ObsessLess'e Hoş Geldin
      </Text>
      <Text style={{ fontSize: 16, color: '#374151', textAlign: 'center', marginTop: 8 }}>
        Daha sakin, daha farkında bir gün için küçük adımlarla başlayalım.
      </Text>

      <ProgressDots current={step} total={totalSteps} />

      <View style={{ height: 24 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hadi başlayalım"
        onPress={() => { next(); router.push('/(auth)/onboarding/motivation'); }}
        style={{ backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Hadi Başlayalım</Text>
      </Pressable>

      {/* Skip kaldırıldı: Onboarding tamamlanmadan uygulamaya geçilemez */}
    </View>
  );
}

