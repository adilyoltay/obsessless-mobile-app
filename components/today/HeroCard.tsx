import React from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StreakCounter } from '@/components/gamification/StreakCounter';

type HeroCardProps = {
  healingPointsTotal: number;
  nextMilestoneName: string;
  progressToNextPct: number; // 0-100
  nextMilestoneTarget?: number; // if provided, show current/target
  isMaxLevel?: boolean; // true when already at max tier
  bgColor?: string; // optional dynamic background color
  gradientColors?: [string, string];
  colorScore?: number; // for threshold checks
  enableAnimatedColor?: boolean;
};

export default function HeroCard({ healingPointsTotal, nextMilestoneName, progressToNextPct, nextMilestoneTarget, isMaxLevel, bgColor, gradientColors /* , colorScore, enableAnimatedColor */ }: HeroCardProps) {
  // Keep a tiny fade/scale feel without wiring external Animated state
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  const { width, height } = Dimensions.get('window');
  const compact = height < 740 || width < 360;
  const scale = Math.min(1, width / 393);
  // Denser sizing for smaller screens to help everything fit
  const iconSize = Math.max(28, Math.round((compact ? 36 : 44) * scale));
  const pointsFont = Math.max(28, Math.round((compact ? 34 : 42) * scale));
  const progressBarH = compact ? 5 : 7;
  const progressValueSize = compact ? 10 : 12;
  const cardPadding = compact ? 12 : 18;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const pct = Math.max(0, Math.min(100, progressToNextPct));

  const backgroundColor = bgColor || '#10B981';
  // Simpler gradient application to avoid insertion effect update warnings
  const baseGradient: [string, string] = gradientColors || ['#34d399', '#059669'];

  return (
    <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }], padding: cardPadding }]}>
      <View style={styles.gradientContainer}>
        <LinearGradient colors={baseGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      </View>
      {/* Main Points Display */}
      <View style={styles.mainPointsContainer}>
        <MaterialCommunityIcons name="star-outline" size={iconSize} color="white" />
        <Text style={[styles.mainPointsValue, { fontSize: pointsFont }]}>{healingPointsTotal}</Text>
        <Text style={styles.mainPointsLabel}>Healing Points</Text>
      </View>

      {/* Progress to Next Level */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>Sonraki Seviye: {nextMilestoneName}</Text>
        <View style={[styles.progressBarContainer, { height: progressBarH }]}>
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={[styles.progressValue, { fontSize: progressValueSize }]}>
          {isMaxLevel ? 'Maksimum seviye' : (
            nextMilestoneTarget ? `${healingPointsTotal} / ${nextMilestoneTarget}` : String(healingPointsTotal)
          )}
        </Text>
      </View>

      {/* Streak Widget */}
      <View style={styles.streakWidgetContainer}>
        <StreakCounter variant="onGradient" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  gradientContainer: {
    ...StyleSheet.absoluteFillObject as any,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mainPointsContainer: {
    alignItems: 'center',
  },
  mainPointsValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    marginTop: 6,
    marginBottom: 4,
  },
  mainPointsLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  progressContainer: {
    width: '100%',
    marginTop: 12,
  },
  progressLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 4,
    opacity: 0.9,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressValue: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginTop: 4,
    textAlign: 'right',
    opacity: 0.9,
  },
  streakWidgetContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
});
