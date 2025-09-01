import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StreakCounter } from '@/components/gamification/StreakCounter';

type HeroCardProps = {
  healingPointsTotal: number;
  nextMilestoneName: string;
  progressToNextPct: number; // 0-100
  nextMilestoneTarget?: number; // if provided, show current/target
  isMaxLevel?: boolean; // true when already at max tier
};

export default function HeroCard({ healingPointsTotal, nextMilestoneName, progressToNextPct, nextMilestoneTarget, isMaxLevel }: HeroCardProps) {
  // Keep a tiny fade/scale feel without wiring external Animated state
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const pct = Math.max(0, Math.min(100, progressToNextPct));

  return (
    <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Main Points Display */}
      <View style={styles.mainPointsContainer}>
        <MaterialCommunityIcons name="star-outline" size={50} color="white" />
        <Text style={styles.mainPointsValue}>{healingPointsTotal}</Text>
        <Text style={styles.mainPointsLabel}>Healing Points</Text>
      </View>

      {/* Progress to Next Level */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>Sonraki Seviye: {nextMilestoneName}</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressValue}>
          {isMaxLevel ? 'Maksimum seviye' : (
            nextMilestoneTarget ? `${healingPointsTotal} / ${nextMilestoneTarget}` : String(healingPointsTotal)
          )}
        </Text>
      </View>

      {/* Streak Widget */}
      <View style={styles.streakWidgetContainer}>
        <StreakCounter />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  mainPointsContainer: {
    alignItems: 'center',
  },
  mainPointsValue: {
    fontSize: 50,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  mainPointsLabel: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  progressLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 4,
    opacity: 0.9,
  },
  progressBarContainer: {
    height: 8,
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
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginTop: 4,
    textAlign: 'right',
    opacity: 0.9,
  },
  streakWidgetContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
});
