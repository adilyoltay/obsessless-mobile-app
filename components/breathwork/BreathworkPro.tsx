import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Text, Pressable } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { Spacing, Sizes } from '@/constants/DesignSystem';
import { useLanguage } from '@/contexts/LanguageContext';
import BreathworkPlayer, { BreathingPhase, BreathworkPlayerHandle } from '@/components/breathwork/BreathworkPlayer';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import BreathingWave from '@/components/breathing/BreathingWave';

function BreathingVisualization({ label, instruction, scale }: { label: string; instruction: string; scale: Animated.SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={styles.vizContainer}>
      <View style={styles.outerRing1} />
      <View style={styles.outerRing2} />
      <Animated.View style={[styles.breathingCircle, animatedStyle]}>
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

export default function BreathworkPro() {
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
    completed: language === 'tr' ? 'Tamamlandı' : 'Completed',
    progress: language === 'tr' ? 'İlerleme' : 'Progress',
    breathwork: language === 'tr' ? 'Nefes' : 'Breathwork',
    protocol: language === 'tr' ? 'Protokol' : 'Protocol',
  }), [language]);

  // Visual animation scale
  const scale = useSharedValue(1);
  // Session state
  const [phaseLabel, setPhaseLabel] = useState(i18n.ready);
  const [instruction, setInstruction] = useState(i18n.pressToStart);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Time and progress
  const TOTAL_MS = 60_000; // 1 minute target session for progress bar
  const [elapsedMs, setElapsedMs] = useState(0);

  // Wave animation inputs
  const [currentPhase, setCurrentPhase] = useState<BreathingPhase>('inhale');
  const [phaseDurationMs, setPhaseDurationMs] = useState<number>(4000);

  const playerRef = useRef<BreathworkPlayerHandle>(null);

  // Drive visual by phase changes
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

  // Elapsed timer when running
  useEffect(() => {
    if (!running || paused || completed) return;
    const id = setInterval(() => setElapsedMs((v) => Math.min(TOTAL_MS, v + 250)), 250);
    return () => clearInterval(id);
  }, [running, paused, completed]);

  // Auto complete when reaching total
  useEffect(() => {
    if (elapsedMs >= TOTAL_MS && running) {
      handleFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, running]);

  const handleStartPause = async () => {
    const api = playerRef.current;
    if (!api) return;
    if (!running) {
      setCompleted(false);
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

  const handleFinish = () => {
    playerRef.current?.stop();
    setRunning(false);
    setPaused(false);
    setCompleted(true);
    setElapsedMs(TOTAL_MS);
  };

  const handleReset = async () => {
    playerRef.current?.stop();
    setRunning(false);
    setPaused(false);
    setCompleted(false);
    setElapsedMs(0);
    setPhaseLabel(i18n.ready);
    setInstruction(i18n.pressToStart);
    scale.value = withTiming(1, { duration: 200 });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const progress = Math.round((elapsedMs / TOTAL_MS) * 100);

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}> {/* white bg */}
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.header} />

      <View style={styles.main}>
        <BreathingVisualization label={phaseLabel} instruction={instruction} scale={scale} />
        <View style={styles.timerWrap}>
          <Text style={styles.timer}>{formatTime(elapsedMs)}</Text>
          {completed ? <Text style={styles.completed}>✓ {i18n.completed}</Text> : null}
        </View>

        <BreathingWave phase={currentPhase} durationMs={phaseDurationMs} />

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaTitle}>{i18n.breathwork}</Text>
            <Text style={styles.metaSubtitle}>{i18n.protocol}: BOX</Text>
          </View>
        </View>

        <Pressable onPress={handleStartPause} style={styles.phaseButton} accessibilityRole="button" accessibilityLabel={phaseLabel}>
          <Text style={styles.phaseButtonText}>{phaseLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <BreathworkPlayer ref={playerRef} protocol="box" hideControls onPhaseChange={onPhaseChange} onRunningChange={onRunningChange} />
        <View style={styles.controlsRow}>
          <Pressable onPress={handleStartPause} style={[styles.iconBtn, { backgroundColor: '#10B981' }]} accessibilityRole="button" accessibilityLabel={!running ? i18n.start : paused ? i18n.resume : i18n.pause}>
            <Ionicons name={!running ? 'play' : paused ? 'play' : 'pause'} size={28} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={handleFinish} style={[styles.iconBtn, { backgroundColor: '#10B981' }]} accessibilityRole="button" accessibilityLabel={i18n.finish}>
            <Ionicons name="checkmark" size={30} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={handleReset} style={[styles.iconBtn, { backgroundColor: '#94A3B8' }]} accessibilityRole="button" accessibilityLabel={i18n.reset}>
            <Ionicons name="refresh" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.progressCard} accessibilityLabel={`${i18n.progress}: ${progress}%`}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{i18n.progress}</Text>
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: Spacing.lg },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Sizes.buttonGap, paddingHorizontal: Spacing.md },
  bottom: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.lg },
  vizContainer: { width: Sizes.outerRing1, height: Sizes.outerRing1, alignItems: 'center', justifyContent: 'center' },
  outerRing1: { position: 'absolute', width: Sizes.outerRing1, height: Sizes.outerRing1, borderRadius: Sizes.outerRing1 / 2, borderWidth: 8, borderColor: '#99F6E4' },
  outerRing2: { position: 'absolute', width: Sizes.outerRing2, height: Sizes.outerRing2, borderRadius: Sizes.outerRing2 / 2, borderWidth: 8, borderColor: '#5EEAD4' },
  breathingCircle: { width: Sizes.breathingCircle, height: Sizes.breathingCircle, borderRadius: Sizes.breathingCircle / 2, overflow: 'hidden', backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  textOverlay: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  phaseText: { fontSize: 36, fontWeight: '700', color: '#115E59', textAlign: 'center', marginBottom: Spacing.xs },
  instructionText: { fontSize: 16, color: '#0F766E', textAlign: 'center' },
  timerWrap: { alignItems: 'center', marginTop: Spacing.md },
  timer: { fontSize: 48, fontWeight: '300', color: '#0F172A' },
  completed: { marginTop: 6, color: '#10B981', fontWeight: '600' },
  metaRow: { width: '100%', alignItems: 'flex-start' },
  metaTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  metaSubtitle: { fontSize: 14, color: '#6B7280' },
  phaseButton: { width: '100%', backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: Spacing.sm },
  phaseButtonText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  controlsRow: { flexDirection: 'row', gap: 18, justifyContent: 'space-around', alignItems: 'center' },
  iconBtn: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  progressCard: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 16, width: '100%' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: '#334155', fontWeight: '600' },
  progressPct: { color: '#334155', fontWeight: '600' },
  progressTrack: { height: 10, borderRadius: 10, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: '#10B981' },
});
