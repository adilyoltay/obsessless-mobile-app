import React from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
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
  const { width, height } = Dimensions.get('window');
  const compact = height < 720;
  const scale = Math.min(1, width / 393);
  const iconSize = Math.max(36, Math.round((compact ? 42 : 48) * scale));
  const pointsFont = Math.max(32, Math.round((compact ? 38 : 44) * scale));
  const progressBarH = compact ? 6 : 7;
  const progressValueSize = compact ? 11 : 12;
  const cardPadding = compact ? 16 : 20;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const pct = Math.max(0, Math.min(100, progressToNextPct));

  return (
    <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }], padding: cardPadding }]}>
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
    padding: 20,
    alignItems: 'center',
  },
  mainPointsContainer: {
    alignItems: 'center',
  },
  mainPointsValue: {
    fontSize: 44,
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
    height: 7,
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
