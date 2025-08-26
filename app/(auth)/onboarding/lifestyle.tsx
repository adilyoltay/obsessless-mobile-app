import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import ProgressDots from '@/components/onboarding/ProgressDots';

export default function Lifestyle() {
  const router = useRouter();
  const { step, totalSteps, next, prev, setStep, setLifestyle, payload } = useMoodOnboardingStore();
  const [sleepHours, setSleepHours] = useState<string>(payload.lifestyle?.sleep_hours?.toString() || '');
  const [exercise, setExercise] = useState<'none'|'light'|'regular'|''>((payload.lifestyle?.exercise as any) || '');
  const [social, setSocial] = useState<'low'|'medium'|'high'|''>((payload.lifestyle?.social as any) || '');

  useEffect(() => { setStep(3); }, [setStep]);

  const saveNext = () => {
    setLifestyle({
      sleep_hours: sleepHours ? Math.max(0, Math.min(24, Number(sleepHours))) : undefined,
      exercise: exercise || undefined,
      social: social || undefined,
    });
    next();
    router.push('/(auth)/onboarding/notifications');
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#FFFFFF' }}>
      <ProgressDots current={step} total={totalSteps} />
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16 }}>
        Yaşam tarzın (opsiyonel)
      </Text>

      <Text style={{ marginTop: 12, color: '#374151' }}>Günlük uyku (saat)</Text>
      <TextInput
        keyboardType="number-pad"
        value={sleepHours}
        onChangeText={setSleepHours}
        placeholder="örn. 7"
        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 }}
      />

      <Text style={{ marginTop: 12, color: '#374151' }}>Egzersiz</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {(['none','light','regular'] as const).map(k => (
          <Pressable key={k} onPress={() => setExercise(k)} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: exercise===k?'#10B981':'#E5E7EB', backgroundColor: exercise===k?'#ECFDF5':'#FFFFFF' }}>
            <Text style={{ color: exercise===k?'#065F46':'#374151' }}>{k}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ marginTop: 12, color: '#374151' }}>Sosyal aktivite</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {(['low','medium','high'] as const).map(k => (
          <Pressable key={k} onPress={() => setSocial(k)} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: social===k?'#10B981':'#E5E7EB', backgroundColor: social===k?'#ECFDF5':'#FFFFFF' }}>
            <Text style={{ color: social===k?'#065F46':'#374151' }}>{k}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => { prev(); router.back(); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB' }}>
          <Text style={{ textAlign: 'center', color: '#374151', fontWeight: '600' }}>Geri</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={saveNext} style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Devam</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => { saveNext(); router.push('/(auth)/onboarding/summary'); }}>
        <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 12 }}>Atla</Text>
      </Pressable>
    </View>
  );
}


