
import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  backgroundColor?: string;
  progressColor?: string;
  borderRadius?: number;
  animated?: boolean;
  gradient?: boolean;
  gradientColors?: string[];
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  height = 8,
  backgroundColor = '#E5E7EB',
  progressColor = '#10B981',
  borderRadius = 4,
  animated = true,
  gradient = false,
  gradientColors = ['#10B981', '#34D399'],
  style,
}: ProgressBarProps) {
  const progressValue = useSharedValue(0);

  useEffect(() => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    if (animated) {
      progressValue.value = withSpring(clampedProgress, {
        damping: 15,
        stiffness: 150,
      });
    } else {
      progressValue.value = clampedProgress;
    }
  }, [progress, animated]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressValue.value}%`,
    };
  });

  const containerStyle = [
    styles.container,
    {
      height,
      backgroundColor,
      borderRadius,
    },
    style,
  ];

  const progressStyle = [
    styles.progress,
    {
      borderRadius,
    },
  ];

  return (
    <View style={containerStyle}>
      <Animated.View style={[progressStyle, animatedStyle]}>
        {gradient ? (
          <LinearGradient
            colors={gradientColors}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: progressColor, borderRadius }]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
  },
});
