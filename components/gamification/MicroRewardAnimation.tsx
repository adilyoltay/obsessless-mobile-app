import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MicroReward } from '@/types/gamification';
import { Typography } from '@/constants/Colors';

interface MicroRewardAnimationProps {
  reward: MicroReward | undefined;
  onComplete?: () => void;
}

export function MicroRewardAnimation({ reward, onComplete }: MicroRewardAnimationProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (reward) {
      // Reset animations
      fadeAnim.setValue(0);
      translateY.setValue(0);
      scale.setValue(0.8);

      // Start animation sequence
      Animated.parallel([
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            delay: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(translateY, {
          toValue: -50,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.spring(scale, {
            toValue: 1.2,
            tension: 40,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 40,
            friction: 3,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        onComplete?.();
      });
    }
  }, [reward]);

  if (!reward) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.rewardContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY },
              { scale },
            ],
          },
        ]}
      >
        <Text style={styles.rewardText}>{reward.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  rewardContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.bodyL,
    fontWeight: Typography.fontWeight.bold,
  },
}); 