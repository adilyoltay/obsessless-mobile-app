import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { trackAIInteraction, AIEventType } from '@/features/ai-fallbacks/telemetry';
import { useLanguage } from '@/contexts/LanguageContext';

type Protocol = 'box' | '478' | 'paced';

type ProtocolDef = { pattern: number[]; promptTR: string[]; promptEN: string[] };

const PROTOCOLS: Record<Protocol, ProtocolDef> = {
  box: { pattern: [4, 4, 4, 4], promptTR: ['Nefes al', 'Tut', 'Nefes ver', 'Bekle'], promptEN: ['Inhale', 'Hold', 'Exhale', 'Hold'] },
  '478': { pattern: [4, 7, 8], promptTR: ['Nefes al (4)', 'Tut (7)', 'Nefes ver (8)'], promptEN: ['Inhale (4)', 'Hold (7)', 'Exhale (8)'] },
  paced: { pattern: [6, 6], promptTR: ['Nefes al (6)', 'Nefes ver (6)'], promptEN: ['Inhale (6)', 'Exhale (6)'] },
};

export type BreathingPhase = 'inhale' | 'hold' | 'exhale';

function mapPhase(protocol: Protocol, index: number): BreathingPhase {
  if (protocol === 'box') return [ 'inhale','hold','exhale','hold' ][index % 4] as BreathingPhase;
  if (protocol === '478') return [ 'inhale','hold','exhale' ][index % 3] as BreathingPhase;
  return [ 'inhale','exhale' ][index % 2] as BreathingPhase;
}

export type BreathworkPlayerHandle = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isRunning: () => boolean;
};

type PlayerProps = { protocol?: Protocol; tts?: boolean; onPhaseChange?: (p: BreathingPhase, ms: number) => void; onRunningChange?: (running: boolean) => void; hideControls?: boolean; hideHeader?: boolean };

const BreathworkPlayer = forwardRef<BreathworkPlayerHandle, PlayerProps>(function BreathworkPlayer({ protocol = 'box' as Protocol, tts = true, onPhaseChange, onRunningChange, hideControls = false, hideHeader = false }, ref) {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { language } = useLanguage();

  useImperativeHandle(ref, () => ({
    start,
    pause,
    resume,
    stop,
    isRunning: () => running && !paused,
  }));

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      Speech.stop();
    };
  }, []);

  const prompts = language === 'tr' ? PROTOCOLS[protocol].promptTR : PROTOCOLS[protocol].promptEN;

  // Safe TTS helper (Speech.speak is fire-and-forget)
  const speak = async (text: string) => {
    try {
      if (!tts) return;
      // Avoid iOS Siri voice asset warnings: ensure a voice exists
      let voiceId: string | undefined;
      try {
        const voices = await (Speech as any).getAvailableVoicesAsync?.();
        const targetLocale = language === 'tr' ? 'tr-TR' : 'en-US';
        const match = Array.isArray(voices) ? voices.find((v: any) => v?.language === targetLocale) : undefined;
        voiceId = match?.identifier;
        if (Platform.OS === 'ios' && !voiceId && Array.isArray(voices) && voices.length === 0) {
          // No voices installed; skip TTS to avoid SiriTTSService warnings
          return;
        }
      } catch {}
      Speech.stop();
      Speech.speak(text, { language: language === 'tr' ? 'tr-TR' : 'en-US', rate: 0.9, voice: voiceId });
    } catch (e) {
      console.warn('TTS speak error', e);
    }
  };

  const tick = async () => {
    const pIndex = step % prompts.length;
    const phase = mapPhase(protocol, pIndex);
    const durSec = PROTOCOLS[protocol].pattern[pIndex] || PROTOCOLS[protocol].pattern[PROTOCOLS[protocol].pattern.length - 1];

    try { onPhaseChange?.(phase, durSec * 1000); } catch {}

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    speak(prompts[pIndex]);

    timerRef.current = setTimeout(() => setStep(s => s + 1), durSec * 1000);
  };

  async function start() {
    setRunning(true);
    setPaused(false);
    setStep(0);
    try { onRunningChange?.(true); } catch {}
    await trackAIInteraction(AIEventType.BREATH_STARTED, { protocol });
    await tick();
  }

  async function pause() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPaused(true);
    await trackAIInteraction(AIEventType.BREATH_PAUSED, { protocol });
  }

  async function resume() {
    setPaused(false);
    await trackAIInteraction(AIEventType.BREATH_RESUMED, { protocol });
    await tick();
  }

  function stop() {
    setRunning(false);
    setPaused(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    try { onRunningChange?.(false); } catch {}
    Speech.stop();
    trackAIInteraction(AIEventType.BREATH_COMPLETED, { protocol }).catch(() => {});
  }

  useEffect(() => {
    if (!running || paused) return;
    tick();
  }, [step]);

  const phaseLabel = () => prompts[step % prompts.length];

  return (
    <View style={styles.container}>
      {!hideHeader && (
        <>
          <Text style={styles.title}>{language === 'tr' ? 'Nefes Çalışması' : 'Breathwork'}</Text>
          <Text style={styles.subtitle}>{language === 'tr' ? `Protokol: ${protocol.toUpperCase()}` : `Protocol: ${protocol.toUpperCase()}`}</Text>
        </>
      )}

      <View style={styles.timerCard} accessibilityLabel={`Aşama: ${phaseLabel()}`}>
        <Text style={styles.phase}>{phaseLabel()}</Text>
      </View>

      {!hideControls && (
        <View style={styles.actions}>
          {!running ? (
            <Pressable onPress={start} style={[styles.button, styles.start]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Başlat' : 'Start'}>
              <Text style={styles.buttonText}>{language === 'tr' ? 'Başlat' : 'Start'}</Text>
            </Pressable>
          ) : paused ? (
            <>
              <Pressable onPress={resume} style={[styles.button, styles.start]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Devam Et' : 'Resume'}>
                <Text style={styles.buttonText}>{language === 'tr' ? 'Devam Et' : 'Resume'}</Text>
              </Pressable>
              <Pressable onPress={stop} style={[styles.button, styles.stop]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Bitir' : 'Finish'}>
                <Text style={styles.buttonText}>{language === 'tr' ? 'Bitir' : 'Finish'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={pause} style={[styles.button, styles.secondary]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Duraklat' : 'Pause'}>
                <Text style={styles.buttonText}>{language === 'tr' ? 'Duraklat' : 'Pause'}</Text>
              </Pressable>
              <Pressable onPress={stop} style={[styles.button, styles.stop]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Bitir' : 'Finish'}>
                <Text style={styles.buttonText}>{language === 'tr' ? 'Bitir' : 'Finish'}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
});

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

export default BreathworkPlayer;


