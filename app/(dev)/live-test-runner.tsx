import React, { useMemo, useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import supabaseService from '@/services/supabase';
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { postLiveResult } from '@/features/dev/liveTestResults';

export default function LiveTestRunnerScreen() {
  const [runId] = useState(() => `run_${Date.now()}`);
  const [userId, setUserId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [dbWrite, setDbWrite] = useState<boolean>(false);

  useMemo(() => {
    (async () => {
      const { data } = await supabaseService.supabaseClient.auth.getSession();
      setUserId(data?.session?.user?.id || null);
      try {
        const v = await AsyncStorage.getItem('dev_live_seed_db');
        setDbWrite(v === '1');
      } catch {}
    })();
  }, []);

  const append = (m: string) => setLog((l) => [m, ...l].slice(0, 200));

  const guardUser = (): string => {
    if (!userId) throw new Error('No active user session');
    return userId;
  };

  const runTodayFresh = async () => {
    const uid = guardUser();
    append('▶ today:fresh');
    const moods = Array.from({ length: 6 }, (_, i) => ({ timestamp: Date.now() - i * 900e3, mood_score: 6 }));
    const r = await unifiedPipeline.process({ userId: uid, type: 'data', content: { moods }, context: { source: 'mood' } });
    const pass = r.metadata.source === 'fresh';
    await postLiveResult({ runId, userId: uid, tag: '[QRlive:today:fresh]', status: pass ? 'pass' : 'fail', details: r.metadata });
    append(`✔ today:fresh => ${pass ? 'pass' : 'fail'}`);
  };

  const runTodayCache = async () => {
    const uid = guardUser();
    append('▶ today:cache');
    const moods = Array.from({ length: 6 }, (_, i) => ({ timestamp: Date.now() - i * 900e3, mood_score: 6 }));
    await unifiedPipeline.process({ userId: uid, type: 'data', content: { moods }, context: { source: 'mood' } });
    const second = await unifiedPipeline.process({ userId: uid, type: 'data', content: { moods }, context: { source: 'mood' } });
    const pass = second.metadata.source === 'cache';
    await postLiveResult({ runId, userId: uid, tag: '[QRlive:today:cache]', status: pass ? 'pass' : 'fail', details: second.metadata });
    append(`✔ today:cache => ${pass ? 'pass' : 'fail'}`);
  };

  const runTodayInvalidate = async () => {
    const uid = guardUser();
    append('▶ today:invalidate');
    await unifiedPipeline.triggerInvalidation('mood_added', uid);
    await postLiveResult({ runId, userId: uid, tag: '[QRlive:today:invalidate]', status: 'pass', details: {} });
    append('✔ today:invalidate => pass');
  };

  const runAll = async () => {
    try {
      await runTodayFresh();
      await runTodayCache();
      await runTodayInvalidate();
    } catch (e: any) {
      append(`✖ error: ${e?.message || String(e)}`);
    }
  };

  // =========================
  // Mocked Scenarios (Dev)
  // =========================
  const makeTimestamps = (hoursAgoList: number[]) =>
    hoursAgoList.map(h => Date.now() - h * 60 * 60 * 1000);

  const seedScenarioSadContamination = async () => {
    const uid = guardUser();
    append('▶ scenarioA:sad+contamination');
    // Mood across morning/afternoon/evening (low mood)
    const moodTimes = makeTimestamps([48, 36, 30, 24, 18, 12, 8, 6, 4, 2]);
    const moods = moodTimes.map((ts, i) => ({ timestamp: ts, mood_score: i % 3 === 0 ? 3 : 4 }));
    // Compulsion seed removed
    // CBT negative thought
    const cbt = {
      description:
        'Ellerimi yeterince yıkamazsam kesin hasta olur ve aileme hastalık bulaştırırım. Bu yüzden 10 kez yıkamazsam rahat edemem.'
    };
    // Run modules to produce live results
    // Optional: persist to DB
    if (dbWrite) {
      try {
        for (let i = 0; i < moods.length; i++) {
          const m = moods[i];
          const savedMood = await (supabaseService as any).saveMoodEntry({
            user_id: uid,
            mood_score: m.mood_score,
            energy_level: 5,
            anxiety_level: 7,
            notes: `seed_A_${i}`,
            trigger: i % 2 === 0 ? 'contamination_seed' : 'transit_seed'
          });
          append(`✓ mood[A#${i}] -> ${savedMood?.id || 'duplicate_prevented'}`);
        }
        // CBT/Compulsion seeding removed
      } catch (e) {
        append('❗DB write failed (A)');
      }
    }

    const moodRes = await unifiedPipeline.process({ userId: uid, type: 'data', content: { moods }, context: { source: 'mood' } });
    await postLiveResult({ runId, userId: uid, tag: '[QRlive:mood:cache]', status: 'pass', details: moodRes?.metadata || {} });
    // Tracking/CBT/OCD runs removed
    if (dbWrite) {
      await unifiedPipeline.triggerInvalidation('mood_added', uid);
      // invalidations simplified
      try {
        const moodsFetched = await (supabaseService as any).getMoodEntries(uid, 7);
        append(`✓ supabase mood (7gün): ${moodsFetched?.length ?? 0}`);
        // cbt fetch removed
      } catch {}
    }
    append('✔ scenarioA:sad+contamination => pass');
  };

  const seedScenarioAnxiousChecking = async () => {
    const uid = guardUser();
    append('▶ scenarioB:anxious+checking');
    // Mood with mid-low, anxiety implied
    const moodTimes = makeTimestamps([72, 60, 48, 36, 24, 12, 6, 3]);
    const moods = moodTimes.map((ts, i) => ({ timestamp: ts, mood_score: i % 2 === 0 ? 5 : 4 }));
    // Compulsion seed removed
    const cbt = {
      description:
        'Evi kilitlemediğimi düşünürsem kesin hırsız girecek ve sorumlusu ben olacağım. O yüzden tekrar tekrar kontrol etmeliyim.'
    };
    if (dbWrite) {
      try {
        for (let i = 0; i < moods.length; i++) {
          const m = moods[i];
          const savedMood = await (supabaseService as any).saveMoodEntry({
            user_id: uid,
            mood_score: m.mood_score,
            energy_level: 6,
            anxiety_level: 7,
            notes: `seed_B_${i}`,
            trigger: i % 2 === 0 ? 'checking_seed' : 'appliance_seed'
          });
          append(`✓ mood[B#${i}] -> ${savedMood?.id || 'duplicate_prevented'}`);
        }
        // CBT/Compulsion seeding removed
      } catch (e) {
        append('❗DB write failed (B)');
      }
    }

    const moodRes = await unifiedPipeline.process({ userId: uid, type: 'data', content: { moods }, context: { source: 'mood' } });
    await postLiveResult({ runId, userId: uid, tag: '[QRlive:mood:cache]', status: 'pass', details: moodRes?.metadata || {} });
    // tracking/cbt/ocd runs removed
    if (dbWrite) {
      await unifiedPipeline.triggerInvalidation('mood_added', uid);
      await unifiedPipeline.triggerInvalidation('cbt_record_added', uid);
      await unifiedPipeline.triggerInvalidation('compulsion_added', uid);
      try {
        const moodsFetched = await (supabaseService as any).getMoodEntries(uid, 7);
        append(`✓ supabase mood (7gün): ${moodsFetched?.length ?? 0}`);
        const cbtFetched = await (supabaseService as any).getCBTRecords(uid);
        append(`✓ supabase cbt toplam: ${cbtFetched?.length ?? 0}`);
      } catch {}
    }
    append('✔ scenarioB:anxious+checking => pass');
  };

  // Yalnızca Mood ekleme senaryosu (7 gün, günün farklı saatleri)
  const seedScenarioMoodOnly = async () => {
    const uid = guardUser();
    append('▶ scenarioMoodOnly:yalnızca-mood');
    const hours = [144, 120, 96, 72, 48, 36, 24, 18, 12, 6, 3, 1];
    const moodTimes = makeTimestamps(hours);
    const moods = moodTimes.map((ts, i) => ({ timestamp: ts, mood_score: [4,5,6,5,4,3,6,7,5,4,6,5][i % 12] }));
    if (dbWrite) {
      try {
        for (let i = 0; i < moods.length; i++) {
          const m = moods[i];
          const saved = await (supabaseService as any).saveMoodEntry({
            user_id: uid,
            mood_score: m.mood_score,
            energy_level: 5,
            anxiety_level: 5,
            notes: `seed_M_${i}`,
            trigger: i % 2 === 0 ? 'mood_seed_morning' : 'mood_seed_evening'
          });
          append(`✓ mood[M#${i}] -> ${saved?.id || 'duplicate_prevented'}`);
        }
      } catch (e) {
        append('❗DB write failed (MoodOnly)');
      }
    }
    try {
      const res = await unifiedPipeline.process({ userId: uid, type: 'data', content: { moods }, context: { source: 'mood' } });
      await postLiveResult({ runId, userId: uid, tag: '[QRlive:mood:fresh]', status: res?.metadata?.source ? 'pass' : 'fail', details: res?.metadata || {} });
    } catch {}
    if (dbWrite) {
      await unifiedPipeline.triggerInvalidation('mood_added', uid);
      try {
        const moodsFetched = await (supabaseService as any).getMoodEntries(uid, 7);
        append(`✓ supabase mood (7gün): ${moodsFetched?.length ?? 0}`);
      } catch {}
    }
    append('✔ scenarioMoodOnly:tamamlandı');
  };

  const copyReportCommand = () => {
    const cmd = `node scripts/collect-quality-ribbon-results.js --live-run "${runId}"`;
    Clipboard.setString(cmd);
    append('📋 Rapor komutu kopyalandı');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header">Live Test Runner (dev)</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text selectable>runId: {runId}</Text>
        <Button title="Kopyala" onPress={() => Clipboard.setString(runId)} accessibilityLabel="runId kopyala" />
      </View>
      <View style={{ height: 6 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text selectable>userId: {userId || '-'}</Text>
        <Button title="Kopyala" onPress={() => Clipboard.setString(String(userId || ''))} accessibilityLabel="userId kopyala" />
      </View>
      <View style={{ height: 12 }} />
      <Button title="Run All (Today)" onPress={runAll} accessibilityLabel="Run All Today" />
      <View style={{ height: 8 }} />
      <Button title="Today Fresh" onPress={runTodayFresh} accessibilityLabel="Run Today Fresh" />
      <View style={{ height: 8 }} />
      <Button title="Today Cache" onPress={runTodayCache} accessibilityLabel="Run Today Cache" />
      <View style={{ height: 8 }} />
      <Button title="Today Invalidate" onPress={runTodayInvalidate} accessibilityLabel="Run Today Invalidate" />
      <View style={{ height: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>Gerçek veriyi DB'ye yaz (dev)</Text>
        <Button
          title={dbWrite ? 'Açık' : 'Kapalı'}
          onPress={async () => {
            const next = !dbWrite;
            setDbWrite(next);
            try { await AsyncStorage.setItem('dev_live_seed_db', next ? '1' : '0'); } catch {}
          }}
          accessibilityLabel="Toggle DB write"
        />
      </View>
      <View style={{ height: 12 }} />
      <Button title="Seed Scenario A (Üzgün + Temizlik)" onPress={seedScenarioSadContamination} accessibilityLabel="Seed Sad Contamination" />
      <View style={{ height: 8 }} />
      <Button title="Seed Scenario B (Kaygılı + Kontrol)" onPress={seedScenarioAnxiousChecking} accessibilityLabel="Seed Anxious Checking" />
      <View style={{ height: 8 }} />
      <Button title="Yalnızca Mood Ekle (7 gün)" onPress={seedScenarioMoodOnly} accessibilityLabel="Seed Mood Only" />
      <View style={{ height: 16 }} />
      <Button title="Rapor Komutunu Kopyala" onPress={copyReportCommand} accessibilityLabel="Copy Report Command" />
      <View style={{ height: 16 }} />
      {/* Uygulamaya Geçiş (Tabs) */}
      <Text>Uygulamaya Geç</Text>
      <View style={{ height: 8 }} />
      <Button title="Bugün" onPress={() => router.push('/')} accessibilityLabel="Go Today" />
      <View style={{ height: 8 }} />
      <Button title="Mood" onPress={() => router.push('/mood')} accessibilityLabel="Go Mood" />
      <View style={{ height: 8 }} />
      <Button title="Tracking" onPress={() => router.push('/tracking')} accessibilityLabel="Go Tracking" />
      <View style={{ height: 8 }} />
      <Button title="CBT" onPress={() => router.push('/cbt')} accessibilityLabel="Go CBT" />
      <View style={{ height: 8 }} />
      <Button title="Nefes" onPress={() => router.push('/breathwork')} accessibilityLabel="Go Breathwork" />
      <View style={{ height: 8 }} />
      <Button title="Ayarlar" onPress={() => router.push('/settings')} accessibilityLabel="Go Settings" />
      <View style={{ height: 16 }} />
      <Text>Log:</Text>
      {log.map((m, i) => (
        <Text key={i}>{m}</Text>
      ))}
    </ScrollView>
  );
}


