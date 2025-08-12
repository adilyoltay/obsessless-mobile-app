import React, { useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedProps, Easing } from 'react-native-reanimated';
import type { BreathingPhase } from '@/components/breathwork/BreathworkPlayer';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function BreathingWave({ phase, durationMs }: { phase: BreathingPhase; durationMs: number }) {
  const t = useSharedValue(0);
  const phaseSV = useSharedValue<0 | 1 | 2>(0); // 0: inhale, 1: hold, 2: exhale

  useEffect(() => {
    phaseSV.value = phase === 'inhale' ? 0 : phase === 'hold' ? 1 : 2;
    t.value = 0;
    t.value = withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.quad) });
  }, [phase, durationMs]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const showTarget = t.value > 0.5;
    let d = 'M 0 15 L 100 15';
    if (showTarget) {
      if (phaseSV.value === 0) {
        // inhale
        d = 'M 0 15 L 20 15 L 25 5 L 45 5 L 50 15 L 100 15';
      } else if (phaseSV.value === 1) {
        // hold
        d = 'M 0 15 L 100 15';
      } else {
        // exhale
        d = 'M 0 15 L 20 15 L 25 25 L 45 25 L 50 15 L 100 15';
      }
    }
    return { d } as any;
  });

  return (
    <Svg viewBox="0 0 100 30" width="100%" height={60}>
      <AnimatedPath animatedProps={animatedProps} stroke="#14B8A6" strokeWidth={2} fill="none" />
    </Svg>
  );
}
