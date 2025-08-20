import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Text, Pressable, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { Spacing, Sizes } from '@/constants/DesignSystem';
import { useLanguage } from '@/contexts/LanguageContext';
import BreathworkPlayer, { BreathingPhase, BreathworkPlayerHandle } from '@/components/breathwork/BreathworkPlayer';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import BreathingWave from '@/components/breathing/BreathingWave';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { StorageKeys, loadUserData, saveUserData } from '@/utils/storage';
import supabaseService, { BreathSessionDB } from '@/services/supabase';

type BreathworkProProps = {
  protocol?: 'box' | '478' | 'paced';
  totalDurationMs?: number; // session target duration for progress bar
  autoStart?: boolean; // otomatik başlatma için
};

function BreathingVisualization({ label, instruction, scale, circleSize, ring1, ring2 }: { label: string; instruction: string; scale: Animated.SharedValue<number>; circleSize: number; ring1: number; ring2: number }) {
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={[styles.vizContainer, { width: ring1, height: ring1 }]}>
      <View style={[styles.outerRing1, { width: ring1, height: ring1, borderRadius: ring1 / 2 }]} />
      <View style={[styles.outerRing2, { width: ring2, height: ring2, borderRadius: ring2 / 2 }]} />
      <Animated.View style={[styles.breathingCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }, animatedStyle]}>
        <View style={styles.textOverlay}>
          <Text style={styles.phaseText}>{label}</Text>
          <Text style={styles.instructionText}>{instruction}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function BreathworkPro({ protocol = 'box', totalDurationMs = 60_000, autoStart = false }: BreathworkProProps) {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxContentWidth = Math.min(width, 500);

  const estimatedBottom = Math.max(220, Math.min(280, height * 0.28));
  const availableForTop = height - insets.top - insets.bottom - estimatedBottom;

  const circleSize = Math.max(180, Math.min(maxContentWidth * 0.68, availableForTop * 0.55));
  const ring1 = circleSize + 24;
  const ring2 = circleSize + 48;
  const btnSize = Math.max(60, Math.min(92, maxContentWidth * 0.22));
  const waveHeight = Math.max(56, Math.min(90, availableForTop * 0.18));

  const { language } = useLanguage();
  const i18n = useMemo(() => ({
    ready: language === 'tr' ? 'Hazır' : 'Ready',
    pressToStart: language === 'tr' ? 'Başlamak için tıklayın' : 'Tap to start',
    inhale: language === 'tr' ? 'Nefes Alın' : 'Inhale',
    hold: language === 'tr' ? 'Tutun' : 'Hold',
    exhale: language === 'tr' ? 'Nefes Verin' : 'Exhale',
    start: language === 'tr' ? 'Başlat' : 'Start',
    pause: language === 'tr' ? 'Duraklat' : 'Pause',
    resume: language === 'tr' ? 'Devam' : 'Resume',
    reset: language === 'tr' ? 'Yeniden Başla' : 'Reset',
    finish: language === 'tr' ? 'Bitir' : 'Finish',
    progress: language === 'tr' ? 'İlerleme' : 'Progress',
  }), [language]);

  const scale = useSharedValue(1);
  const [phaseLabel, setPhaseLabel] = useState(i18n.ready);
  const [instruction, setInstruction] = useState(i18n.pressToStart);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);

  const TOTAL_MS = Math.max(1, totalDurationMs);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [currentPhase, setCurrentPhase] = useState<BreathingPhase>('inhale');
  const [phaseDurationMs, setPhaseDurationMs] = useState<number>(4000);

  const playerRef = useRef<BreathworkPlayerHandle>(null);

  const onPhaseChange = (p: BreathingPhase, ms: number) => {
    setCurrentPhase(p);
    setPhaseDurationMs(ms);
    setPhaseLabel(p === 'inhale' ? i18n.inhale : p === 'hold' ? i18n.hold : i18n.exhale);
    setInstruction(
      p === 'inhale'
        ? (language === 'tr' ? 'Burnunuzdan nefes alın' : 'Breathe in through nose')
        : p === 'hold'
        ? (language === 'tr' ? 'Nefesinizi tutun' : 'Hold your breath')
        : (language === 'tr' ? 'Ağzınızdan yavaşça verin' : 'Exhale slowly')
    );
    const target = p === 'inhale' ? 1.4 : p === 'hold' ? 1.4 : 1.0;
    scale.value = withTiming(target, { duration: ms });
  };

  const onRunningChange = (isRunning: boolean) => {
    setRunning(isRunning);
    setPaused(false);
  };

  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => setElapsedMs((v) => Math.min(TOTAL_MS, v + 250)), 250);
    return () => clearInterval(id);
  }, [running, paused, TOTAL_MS]);

  useEffect(() => {
    if (elapsedMs >= TOTAL_MS && running) {
      handleFinish();
    }
  }, [elapsedMs, running, TOTAL_MS]);

  // Auto-start desteği
  useEffect(() => {
    if (autoStart && playerRef.current && !running) {
      // Küçük bir gecikme ile başlat (kullanıcının hazırlanması için)
      const timer = setTimeout(() => {
        console.log('🌬️ Auto-starting breathwork session...');
        handleStart();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [autoStart]);

  const handleStartPause = async () => {
    const api = playerRef.current;
    if (!api) return;
    if (!running) {
      setElapsedMs(0);
      api.start();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (!paused) {
      api.pause();
      setPaused(true);
      await Haptics.selectionAsync();
    } else {
      api.resume();
      setPaused(false);
      await Haptics.selectionAsync();
    }
  };

  const handleFinish = async () => {
    playerRef.current?.stop();
    setRunning(false);
    setPaused(false);

    // Persist session (offline-first)
    try {
      const now = new Date();
      const dateKey = now.toDateString();
      const localKey = StorageKeys.BREATH_SESSIONS(user?.id || 'anon', dateKey);
      const existing = (await loadUserData<any[]>(localKey)) || [];
      const session = {
        protocol,
        duration_ms: Math.min(elapsedMs, TOTAL_MS),
        started_at: now.toISOString(),
        completed_at: now.toISOString(),
      };
      await saveUserData(localKey, [session, ...existing]);

      if (user?.id) {
        const dbPayload: BreathSessionDB = {
          user_id: user.id,
          protocol,
          duration_ms: session.duration_ms,
          started_at: session.started_at,
          completed_at: session.completed_at,
        };
        await supabaseService.saveBreathSession(dbPayload);
      }
    } catch (e) {
      console.warn('breath session persist failed', e);
    }
  };

  const handleReset = async () => {
    playerRef.current?.stop();
    setRunning(false);
    setPaused(false);
    setElapsedMs(0);
    setPhaseLabel(i18n.ready);
    setInstruction(i18n.pressToStart);
    scale.value = withTiming(1, { duration: 200 });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const progress = Math.max(0, Math.min(100, Math.round((Math.max(0, Math.min(elapsedMs, TOTAL_MS)) / TOTAL_MS) * 100)));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF', paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.topContent, { maxWidth: maxContentWidth, alignSelf: 'center', height: availableForTop }]}> 
        <BreathingVisualization label={phaseLabel} instruction={instruction} scale={scale} circleSize={circleSize} ring1={ring1} ring2={ring2} />
        <Text style={styles.timer}>{formatTime(elapsedMs)}</Text>
        <View style={{ width: '100%', marginTop: 4 }}>
          <BreathingWave phase={currentPhase} durationMs={phaseDurationMs} height={waveHeight} />
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg, maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <BreathworkPlayer ref={playerRef} protocol={protocol} hideControls hideHeader onPhaseChange={onPhaseChange} onRunningChange={onRunningChange} />
        <View style={[styles.controlsRow, { gap: Math.max(12, maxContentWidth * 0.06) }]}>
          <Pressable onPress={handleStartPause} style={[styles.iconBtn, { backgroundColor: '#10B981', width: btnSize, height: btnSize, borderRadius: btnSize / 2 }]} accessibilityRole="button" accessibilityLabel={!running ? i18n.start : paused ? i18n.resume : i18n.pause}>
            <Ionicons name={!running ? 'play' : paused ? 'play' : 'pause'} size={Math.round(btnSize * 0.33)} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={handleFinish} style={[styles.iconBtn, { backgroundColor: '#10B981', width: btnSize, height: btnSize, borderRadius: btnSize / 2 }]} accessibilityRole="button" accessibilityLabel={i18n.finish}>
            <Ionicons name="checkmark" size={Math.round(btnSize * 0.36)} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={handleReset} style={[styles.iconBtn, { backgroundColor: '#94A3B8', width: btnSize, height: btnSize, borderRadius: btnSize / 2 }]} accessibilityRole="button" accessibilityLabel={i18n.reset}>
            <Ionicons name="refresh" size={Math.round(btnSize * 0.31)} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={[styles.progressCard, { width: '100%' }]} accessibilityLabel={`${i18n.progress}: ${progress}%`}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{i18n.progress}</Text>
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topContent: { justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
  bottom: { paddingHorizontal: Spacing.md, gap: Spacing.lg },
  vizContainer: { alignItems: 'center', justifyContent: 'center' },
  outerRing1: { position: 'absolute', borderWidth: 8, borderColor: '#99F6E4' },
  outerRing2: { position: 'absolute', borderWidth: 8, borderColor: '#5EEAD4' },
  breathingCircle: { overflow: 'hidden', backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  textOverlay: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  phaseText: { fontSize: 32, fontWeight: '700', color: '#115E59', textAlign: 'center', marginBottom: Spacing.xs },
  instructionText: { fontSize: 15, color: '#0F766E', textAlign: 'center' },
  timer: { fontSize: 44, fontWeight: '300', color: '#0F172A' },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  iconBtn: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  progressCard: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: '#334155', fontWeight: '600' },
  progressPct: { color: '#334155', fontWeight: '600' },
  progressTrack: { height: 10, borderRadius: 10, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: '#10B981' },
});
