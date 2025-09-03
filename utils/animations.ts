import { Layout, SlideInUp, withSequence, withSpring, withTiming } from 'react-native-reanimated';

export const chartAnimations = {
  barEntry: (index: number) => ({
    entering: SlideInUp.delay(index * 50).springify().damping(15).stiffness(150),
    layout: Layout.springify(),
  }),
  pointPulse: () => {
    'worklet';
    return {
      transform: [
        {
          scale: withSequence(withSpring(1.2), withSpring(1)),
        },
      ],
    } as const;
  },
  selectionHighlight: (selected: boolean) => {
    'worklet';
    return {
      opacity: withTiming(selected ? 1 : 0.6),
      transform: [
        {
          scale: withSpring(selected ? 1.1 : 1),
        },
      ],
    } as const;
  },
};

