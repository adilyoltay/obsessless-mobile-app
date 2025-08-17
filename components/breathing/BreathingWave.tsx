import React, { useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedProps, Easing } from 'react-native-reanimated';
import type { BreathingPhase } from '@/components/breathwork/BreathworkPlayer';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function BreathingWave({ phase, durationMs, height = 60 }: { phase: BreathingPhase; durationMs: number; height?: number }) {
  const t = useSharedValue(0);
  const phaseSV = useSharedValue<0 | 1 | 2>(0); // 0: inhale, 1: hold, 2: exhale

  useEffect(() => {
    phaseSV.value = phase === 'inhale' ? 0 : phase === 'hold' ? 1 : 2;
    t.value = 0;
    t.value = withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.quad) });
  }, [phase, durationMs]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const base = 15; // midline in viewBox
    const ampMax = 10; // vertical excursion
    const amp = ampMax * t.value; // grow within phase duration

    let top = base;
    if (phaseSV.value === 0) top = base - amp; // inhale: hill
    else if (phaseSV.value === 2) top = base + amp; // exhale: valley
    else top = base; // hold

    // Build smooth symmetric cubic curve from left to right
    const d = `M 0 ${base} C 25 ${base}, 25 ${top}, 50 ${top} S 75 ${base}, 100 ${base}`;

    return { d } as any;
  });

  return (
    <Svg viewBox="0 0 100 30" width="100%" height={height}>
      <AnimatedPath animatedProps={animatedProps} stroke="#10B981" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </Svg>
  );
}
