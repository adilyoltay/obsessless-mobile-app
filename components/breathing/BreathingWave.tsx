import React, { useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedProps, Easing } from 'react-native-reanimated';
import type { BreathingPhase } from '@/components/breathwork/BreathworkPlayer';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function buildPath(phase: BreathingPhase) {
  // Simple stepped path similar to provided HTML mock
  if (phase === 'inhale') {
    return 'M 0 15 L 20 15 L 25 5 L 45 5 L 50 15 L 100 15';
  }
  if (phase === 'hold') {
    return 'M 0 15 L 100 15';
  }
  // exhale
  return 'M 0 15 L 20 15 L 25 25 L 45 25 L 50 15 L 100 15';
}

export default function BreathingWave({ phase, durationMs }: { phase: BreathingPhase; durationMs: number }) {
  const t = useSharedValue(0);
  const animatedProps = useAnimatedProps(() => {
    // Interpolate between flat and target path by t (0..1)
    // For simplicity, we just switch path at end of timing; this avoids heavy path morphing libs.
    const showTarget = t.value > 0.5;
    const d = showTarget ? buildPath(phase) : 'M 0 15 L 100 15';
    return { d } as any;
  });

  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.quad) });
  }, [phase, durationMs]);

  return (
    <Svg viewBox="0 0 100 30" width="100%" height={60}>
      <AnimatedPath animatedProps={animatedProps} stroke="#14B8A6" strokeWidth={2} fill="none" />
    </Svg>
  );
}
