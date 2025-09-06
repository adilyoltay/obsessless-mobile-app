import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGamificationStore } from '@/store/gamificationStore';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

type StreakCounterProps = {
  variant?: 'default' | 'onGradient';
};

export function StreakCounter({ variant = 'default' }: StreakCounterProps) {
  const { profile, getStreakInfo } = useGamificationStore();
  const streakInfo = getStreakInfo();
  const scaleAnim = new Animated.Value(1);

  useEffect(() => {
    // Pulse animation for streak flame
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ✅ Always show streak card, even if 0 (motivation for starting streak)
  const streakCount = profile.streakCurrent || 0;

  const getStreakColor = () => {
    // Special handling for 0 streak - use encouraging color
    if (streakCount === 0) {
      return variant === 'onGradient' ? '#FFFFFF' : '#F59E0B'; // Orange for motivation
    }
    
    switch (streakInfo.level) {
      case 'master':
        return variant === 'onGradient' ? '#FFFFFF' : Colors.status.warning; // Orange or white on gradient
      case 'warrior':
        return variant === 'onGradient' ? '#FFFFFF' : Colors.status.error; // Red or white on gradient
      default:
        return variant === 'onGradient' ? '#FFFFFF' : Colors.primary.green; // Green or white on gradient
    }
  };

  const getLevelIcon = () => {
    switch (streakInfo.level) {
      case 'master':
        return 'meditation' as const;
      case 'warrior':
        return 'sword-cross' as const;
      default:
        return 'sprout' as const;
    }
  };

  return (
    <View style={[styles.container, variant === 'onGradient' && styles.containerOnGradient]}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
        <MaterialCommunityIcons 
          name={streakCount === 0 ? "fire-off" : "fire"}
          size={24} 
          color={getStreakColor()} 
        />
      </Animated.View>
      <View style={styles.textContainer}>
        <Text style={[styles.streakNumber, variant === 'onGradient' && styles.streakNumberOnGradient, { color: getStreakColor() }]}>
          {streakCount}
        </Text>
        <Text style={[styles.streakText, variant === 'onGradient' && styles.streakTextOnGradient]}>
          {streakCount === 0 ? 'Başla!' : 'Gün'}
        </Text>
      </View>
      <View style={[styles.levelBadge, variant === 'onGradient' && styles.levelBadgeOnGradient]}>
        <MaterialCommunityIcons 
          name={getLevelIcon()} 
          size={16} 
          color={variant === 'onGradient' ? '#FFFFFF' : Colors.text.secondary} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerOnGradient: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowOpacity: 0,
    elevation: 0,
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: Spacing.sm,
  },
  streakNumber: {
    fontSize: Typography.fontSize.headingS,
    fontWeight: Typography.fontWeight.bold,
    marginRight: 4,
  },
  streakNumberOnGradient: {
    color: '#FFFFFF',
  },
  streakText: {
    fontSize: Typography.fontSize.bodyS,
    color: Colors.text.secondary,
  },
  streakTextOnGradient: {
    color: 'rgba(255,255,255,0.9)',
  },
  levelBadge: {
    backgroundColor: Colors.ui.background,
    padding: 4,
    borderRadius: BorderRadius.sm,
  },
  levelBadgeOnGradient: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
