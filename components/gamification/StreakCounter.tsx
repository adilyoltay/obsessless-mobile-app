import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGamificationStore } from '@/store/gamificationStore';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

export function StreakCounter() {
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

  if (profile.streakCurrent === 0) {
    return null; // Don't show if no streak
  }

  const getStreakColor = () => {
    switch (streakInfo.level) {
      case 'master':
        return Colors.status.warning; // Orange for master
      case 'warrior':
        return Colors.status.error; // Red for warrior
      default:
        return Colors.primary.green; // Green for seedling
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
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
        <MaterialCommunityIcons 
          name="fire" 
          size={24} 
          color={getStreakColor()} 
        />
      </Animated.View>
      <View style={styles.textContainer}>
        <Text style={[styles.streakNumber, { color: getStreakColor() }]}>
          {profile.streakCurrent}
        </Text>
        <Text style={styles.streakText}>Gün</Text>
      </View>
      <View style={styles.levelBadge}>
        <MaterialCommunityIcons 
          name={getLevelIcon()} 
          size={16} 
          color={Colors.text.secondary} 
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
  streakText: {
    fontSize: Typography.fontSize.bodyS,
    color: Colors.text.secondary,
  },
  levelBadge: {
    backgroundColor: Colors.ui.background,
    padding: 4,
    borderRadius: BorderRadius.sm,
  },
}); 