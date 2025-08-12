import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

type Protocol = 'box' | '478' | 'paced';

const PROTOCOLS: Record<Protocol, { pattern: number[]; promptTR: string[] }> = {
  box: { pattern: [4, 4, 4, 4], promptTR: ['Nefes al', 'Tut', 'Nefes ver', 'Bekle'] },
  '478': { pattern: [4, 7, 8], promptTR: ['Nefes al (4)', 'Tut (7)', 'Nefes ver (8)'] },
  paced: { pattern: [6, 6], promptTR: ['Nefes al (6)', 'Nefes ver (6)'] },
};

export default function BreathworkPlayer({ protocol = 'box' as Protocol, tts = true }: { protocol?: Protocol; tts?: boolean }) {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      Speech.stop();
    };
  }, []);

  const speak = async (text: string) => {
    if (!tts) return;
    await Speech.speak(text, { language: 'tr-TR', rate: 0.9 });
  };

  const tick = async () => {
    const conf = PROTOCOLS[protocol];
    const prompts = conf.promptTR;
    const pIndex = step % prompts.length;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await speak(prompts[pIndex]);
    const durSec = conf.pattern[pIndex] || conf.pattern[conf.pattern.length - 1];
    timerRef.current = setTimeout(() => setStep(s => s + 1), durSec * 1000);
  };

  const start = async () => {
    setRunning(true);
    setPaused(false);
    setStep(0);
    await trackAIInteraction(AIEventType.BREATH_STARTED, { protocol });
    await tick();
  };

  const pause = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPaused(true);
    await trackAIInteraction(AIEventType.BREATH_PAUSED, { protocol });
  };

  const resume = async () => {
    setPaused(false);
    await trackAIInteraction(AIEventType.BREATH_RESUMED, { protocol });
    await tick();
  };

  const stop = () => {
    setRunning(false);
    setPaused(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    Speech.stop();
    trackAIInteraction(AIEventType.BREATH_COMPLETED, { protocol }).catch(() => {});
  };

  useEffect(() => {
    if (!running || paused) return;
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const phaseLabel = () => {
    const p = PROTOCOLS[protocol].promptTR;
    return p[step % p.length];
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nefes Çalışması</Text>
      <Text style={styles.subtitle}>Protokol: {protocol.toUpperCase()}</Text>

      <View style={styles.timerCard} accessibilityLabel={`Aşama: ${phaseLabel()}`}>
        <Text style={styles.phase}>{phaseLabel()}</Text>
      </View>

      <View style={styles.actions}>
        {!running ? (
          <Pressable onPress={start} style={[styles.button, styles.start]} accessibilityRole="button" accessibilityLabel="Başlat">
            <Text style={styles.buttonText}>Başlat</Text>
          </Pressable>
        ) : paused ? (
          <>
            <Pressable onPress={resume} style={[styles.button, styles.start]} accessibilityRole="button" accessibilityLabel="Devam Et">
              <Text style={styles.buttonText}>Devam Et</Text>
            </Pressable>
            <Pressable onPress={stop} style={[styles.button, styles.stop]} accessibilityRole="button" accessibilityLabel="Bitir">
              <Text style={styles.buttonText}>Bitir</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={pause} style={[styles.button, styles.secondary]} accessibilityRole="button" accessibilityLabel="Duraklat">
              <Text style={styles.buttonText}>Duraklat</Text>
            </Pressable>
            <Pressable onPress={stop} style={[styles.button, styles.stop]} accessibilityRole="button" accessibilityLabel="Bitir">
              <Text style={styles.buttonText}>Bitir</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  timerCard: { marginTop: 20, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 24, alignItems: 'center' },
  phase: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  button: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  start: { backgroundColor: '#10B981' },
  secondary: { backgroundColor: '#334155' },
  stop: { backgroundColor: '#EF4444' },
  buttonText: { color: 'white', fontWeight: '700' },
});


