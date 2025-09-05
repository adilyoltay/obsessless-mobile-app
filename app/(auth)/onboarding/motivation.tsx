import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import ProgressDots from '@/components/onboarding/ProgressDots';
import Chips from '@/components/onboarding/Chips';

const OPTIONS = [
  { key: 'stress_reduction', label: 'Stresi azalt' },
  { key: 'insight', label: 'Ruh halini anla' },
  { key: 'habit_tracking', label: 'Alışkanlık takibi' },
  { key: 'sleep_energy', label: 'Uyku/Enerji' },
  { key: 'therapy_report', label: 'Terapist raporu' },
] as const;

export default function Motivation() {
  const router = useRouter();
  const { step, totalSteps, next, prev, setStep, setMotivation, payload } = useMoodOnboardingStore();
  const [selected, setSelected] = useState<string[]>(payload.motivation || []);
  const theme = useThemeColors();

  useEffect(() => { setStep(1); }, [setStep]);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: theme.background }}>
      <ProgressDots current={step} total={totalSteps} />
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16 }}>
        Neden buradasın?
      </Text>
      <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 6 }}>İstediğin kadar seçebilirsin.</Text>

      <Chips
        options={OPTIONS.map(o => ({ key: o.key, label: o.label }))}
        value={selected}
        onChange={setSelected}
      />

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => { prev(); router.back(); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB' }}>
          <Text style={{ textAlign: 'center', color: '#374151', fontWeight: '600' }}>Geri</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => { setMotivation(selected as any); next(); router.push('/(auth)/onboarding/first-mood'); }}
          style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Devam</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => { setMotivation(selected as any); router.push('/(auth)/onboarding/summary'); }}>
        <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 12 }}>Atla</Text>
      </Pressable>
    </View>
  );
}

