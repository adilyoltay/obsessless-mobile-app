import React, { useMemo } from 'react';
import { View, StyleSheet, StatusBar, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ObsessLessColors, Spacing, Sizes } from '@/constants/DesignSystem';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/contexts/LanguageContext';

// Lightweight internal session state using existing BreathworkPlayer props
// We will map to existing player controls to keep functionality intact.
import BreathworkPlayer from '@/components/breathwork/BreathworkPlayer';

function BreathingVisualization({ label, instruction }: { label: string; instruction: string }) {
  return (
    <View style={styles.vizContainer}>
      <View style={styles.outerRing1} />
      <View style={styles.outerRing2} />
      <View style={styles.breathingCircle}>
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
      </View>
    </View>
  );
}

export default function BreathworkPro() {
  const { language } = useLanguage();
  const i18n = useMemo(() => ({
    ready: language === 'tr' ? 'Hazır' : 'Ready',
    pressToStart: language === 'tr' ? 'Başlamak için dokun' : 'Tap to start',
    inhale: language === 'tr' ? 'Nefes Alın' : 'Inhale',
    hold: language === 'tr' ? 'Tutun' : 'Hold',
    exhale: language === 'tr' ? 'Nefes Verin' : 'Exhale',
    progress: language === 'tr' ? 'İlerleme' : 'Progress',
  }), [language]);

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
          <BreathingVisualization label={i18n.ready} instruction={i18n.pressToStart} />
        </View>

        <View style={styles.bottom}>
          {/* Reuse existing player for real timing, TTS, haptics and telemetry */}
          <BreathworkPlayer />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ObsessLessColors.darkestBg },
  gradient: { flex: 1 },
  header: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  headerIcon: {
    width: Sizes.headerIcon,
    height: Sizes.headerIcon,
    backgroundColor: ObsessLessColors.primary,
    borderRadius: Sizes.headerIcon / 2,
  },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Sizes.buttonGap },
  bottom: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.lg },
  vizContainer: { width: Sizes.outerRing1, height: Sizes.outerRing1, alignItems: 'center', justifyContent: 'center' },
  outerRing1: { position: 'absolute', width: Sizes.outerRing1, height: Sizes.outerRing1, borderRadius: Sizes.outerRing1 / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  outerRing2: { position: 'absolute', width: Sizes.outerRing2, height: Sizes.outerRing2, borderRadius: Sizes.outerRing2 / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  breathingCircle: { width: Sizes.breathingCircle, height: Sizes.breathingCircle, borderRadius: Sizes.breathingCircle / 2, overflow: 'hidden' },
  textOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  phaseText: { fontSize: 28, fontWeight: '300', color: ObsessLessColors.white, textAlign: 'center', marginBottom: Spacing.sm },
  instructionText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
});
