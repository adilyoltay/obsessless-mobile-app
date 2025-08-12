import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Text } from 'react-native';
import Animated, { FadeIn, useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ObsessLessColors, Spacing, Sizes } from '@/constants/DesignSystem';
import { useLanguage } from '@/contexts/LanguageContext';
import BreathworkPlayer, { BreathingPhase } from '@/components/breathwork/BreathworkPlayer';

function BreathingVisualization({ label, instruction, scale }: { label: string; instruction: string; scale: Animated.SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={styles.vizContainer}>
      <View style={styles.outerRing1} />
      <View style={styles.outerRing2} />
      <Animated.View style={[styles.breathingCircle, animatedStyle]}>
        <LinearGradient
          colors={[ObsessLessColors.primary, ObsessLessColors.secondary, ObsessLessColors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.textOverlay}>
          <Text style={styles.phaseText}>{label}</Text>
          <Text style={styles.instructionText}>{instruction}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function BreathworkPro() {
  const { language } = useLanguage();
  const i18n = useMemo(() => ({
    ready: language === 'tr' ? 'Hazır' : 'Ready',
    pressToStart: language === 'tr' ? 'Başlamak için tıklayın' : 'Tap to start',
    inhale: language === 'tr' ? 'Nefes Alın' : 'Inhale',
    hold: language === 'tr' ? 'Tutun' : 'Hold',
    exhale: language === 'tr' ? 'Nefes Verin' : 'Exhale',
    progress: language === 'tr' ? 'İlerleme' : 'Progress',
  }), [language]);

  const scale = useSharedValue(1);
  const [phaseLabel, setPhaseLabel] = useState(i18n.ready);
  const [instruction, setInstruction] = useState(i18n.pressToStart);
  const [running, setRunning] = useState(false);

  const onPhaseChange = (p: BreathingPhase, ms: number) => {
    setPhaseLabel(p === 'inhale' ? i18n.inhale : p === 'hold' ? i18n.hold : i18n.exhale);
    setInstruction(p === 'inhale' ? (language === 'tr' ? 'Burnunuzdan nefes alın' : 'Breathe in through nose') : p === 'hold' ? (language === 'tr' ? 'Nefesinizi tutun' : 'Hold your breath') : (language === 'tr' ? 'Ağzınızdan yavaşça verin' : 'Exhale slowly'));
    // animate scale per phase
    const target = p === 'inhale' ? 1.4 : p === 'hold' ? 1.4 : 1.0;
    scale.value = withTiming(target, { duration: ms });
  };

  const onRunningChange = (isRunning: boolean) => {
    setRunning(isRunning);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={[ObsessLessColors.darkestBg, ObsessLessColors.darkerBg, ObsessLessColors.darkBg]}
        style={styles.gradient}
      >
        <Animated.View style={styles.header} entering={FadeIn.duration(600)}>
          <View style={styles.headerIcon} />
        </Animated.View>

        <View style={styles.main}>
          <BreathingVisualization label={phaseLabel} instruction={instruction} scale={scale} />
          {/* simple wave/progress indicator */}
          <View style={styles.waveBar}> 
            <View style={[styles.waveFill, { opacity: running ? 1 : 0.3 }]} />
          </View>
        </View>

        <View style={styles.bottom}>
          <BreathworkPlayer onPhaseChange={onPhaseChange} onRunningChange={onRunningChange} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ObsessLessColors.darkestBg },
  gradient: { flex: 1 },
  header: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  headerIcon: { width: Sizes.headerIcon, height: Sizes.headerIcon, backgroundColor: ObsessLessColors.primary, borderRadius: Sizes.headerIcon / 2 },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Sizes.buttonGap },
  bottom: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.lg },
  vizContainer: { width: Sizes.outerRing1, height: Sizes.outerRing1, alignItems: 'center', justifyContent: 'center' },
  outerRing1: { position: 'absolute', width: Sizes.outerRing1, height: Sizes.outerRing1, borderRadius: Sizes.outerRing1 / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  outerRing2: { position: 'absolute', width: Sizes.outerRing2, height: Sizes.outerRing2, borderRadius: Sizes.outerRing2 / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  breathingCircle: { width: Sizes.breathingCircle, height: Sizes.breathingCircle, borderRadius: Sizes.breathingCircle / 2, overflow: 'hidden' },
  textOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  phaseText: { fontSize: 28, fontWeight: '300', color: ObsessLessColors.white, textAlign: 'center', marginBottom: Spacing.sm },
  instructionText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  waveBar: { width: '80%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  waveFill: { height: '100%', width: '50%', borderRadius: 3, backgroundColor: ObsessLessColors.accent },
});
