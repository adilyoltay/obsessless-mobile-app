import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import ProgressDots from '@/components/onboarding/ProgressDots';
import EmojiScale from '@/components/onboarding/EmojiScale';

export default function FirstMood() {
  const router = useRouter();
  const { step, totalSteps, next, prev, setStep, setFirstMood, payload } = useMoodOnboardingStore();
  const [score, setScore] = useState<1|2|3|4|5 | undefined>(payload.first_mood?.score);
  const [tags, setTags] = useState<string[]>(payload.first_mood?.tags || []);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => { setStep(2); }, [setStep]);

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    setTags(Array.from(new Set([...(tags||[]), v])).slice(0, 5));
    setTagInput('');
  };

  const theme = useThemeColors();
  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: theme.background }}>
      <ProgressDots current={step} total={totalSteps} />
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16 }}>
        Şu an nasıl hissediyorsun?
      </Text>
      <EmojiScale value={score} onChange={setScore} />

      <Text style={{ marginTop: 18, color: '#6B7280' }}>İstersen bir-iki duygu etiketi ekle</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput
          accessibilityLabel="Etiket"
          value={tagInput}
          onChangeText={setTagInput}
          placeholder="ör. kaygı, yorgunluk"
          style={{ flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
        />
        <Pressable accessibilityRole="button" onPress={addTag} style={{ paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB' }}>
          <Text style={{ color: '#374151', paddingVertical: 10 }}>Ekle</Text>
        </Pressable>
      </View>
      {tags.length > 0 && (
        <Text style={{ marginTop: 6, color: '#374151' }}>{tags.join(', ')}</Text>
      )}

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => { prev(); router.back(); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB' }}>
          <Text style={{ textAlign: 'center', color: '#374151', fontWeight: '600' }}>Geri</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => { setFirstMood(score, tags); next(); router.push('/(auth)/onboarding/lifestyle'); }}
          style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Devam</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => { setFirstMood(score, tags); router.push('/(auth)/onboarding/summary'); }}>
        <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 12 }}>Atla</Text>
      </Pressable>
    </View>
  );
}

