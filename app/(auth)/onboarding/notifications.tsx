import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import ProgressDots from '@/components/onboarding/ProgressDots';
import * as Notifications from 'expo-notifications';

export default function NotificationsStep() {
  const router = useRouter();
  const { step, totalSteps, next, prev, setStep, setReminders, payload, finalizeFlags } = useMoodOnboardingStore();
  const [enabled, setEnabled] = useState(!!payload.reminders?.enabled);
  const [time, setTime] = useState<string>(payload.reminders?.time || '09:00');
  const [days] = useState<string[]>(['Mon','Tue','Wed','Thu','Fri']);

  useEffect(() => { setStep(4); }, [setStep]);

  const requestPermissionIfNeeded = async () => {
    if (!enabled) return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  };

  const saveNext = async () => {
    setReminders({ enabled, time, days, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    finalizeFlags();
    const ok = await requestPermissionIfNeeded();
    // İzin reddedilse bile devam; flags etkilenmez.
    next();
    router.push('/(auth)/onboarding/summary');
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#FFFFFF' }}>
      <ProgressDots current={step} total={totalSteps} />
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16 }}>
        Günlük hatırlatma (opsiyonel)
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <Text style={{ flex: 1, color: '#374151' }}>Hatırlatmalar</Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>
      <Text style={{ color: '#6B7280', marginTop: 6 }}>Saat: {time} — Günler: Hafta içi</Text>

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => { prev(); router.back(); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB' }}>
          <Text style={{ textAlign: 'center', color: '#374151', fontWeight: '600' }}>Geri</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={saveNext} style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Devam</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => { setReminders({ enabled, time, days }); router.push('/(auth)/onboarding/summary'); }}>
        <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 12 }}>Atla</Text>
      </Pressable>
    </View>
  );
}


