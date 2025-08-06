import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AchievementDefinition } from '@/types/gamification';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

interface AchievementBadgeProps {
  achievement: AchievementDefinition;
  isUnlocked: boolean;
  onPress?: () => void;
}

export function AchievementBadge({ achievement, isUnlocked, onPress }: AchievementBadgeProps) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const getRarityColor = () => {
    if (!isUnlocked) return Colors.text.tertiary;
    
    switch (achievement.rarity) {
      case 'Epic':
        return '#8B5CF6'; // Purple
      case 'Rare':
        return '#3B82F6'; // Blue
      default:
        return Colors.primary.green;
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        !isUnlocked && styles.locked,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: getRarityColor() }]}>
        <MaterialCommunityIcons
          name={achievement.icon as any}
          size={32}
          color={isUnlocked ? '#FFFFFF' : Colors.text.tertiary}
        />
        {!isUnlocked && (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons
              name="lock"
              size={20}
              color={Colors.text.tertiary}
            />
          </View>
        )}
      </View>
      <Text style={[styles.title, !isUnlocked && styles.lockedText]} numberOfLines={2}>
        {achievement.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 100,
    padding: Spacing.sm,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  locked: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lockOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.fontSize.bodyS,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  lockedText: {
    color: Colors.text.tertiary,
  },
}); 