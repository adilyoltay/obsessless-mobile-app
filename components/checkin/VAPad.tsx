import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Line, Circle, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');
const PAD = Math.min(W - 48, 340);
const HALF = PAD / 2;
const DOT_R = 12;

// Utility functions
const withA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const clampedA = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${clampedA})`;
};

interface VAPadProps {
  x: Animated.SharedValue<number>;
  y: Animated.SharedValue<number>;
  onChangeXY: (nx: number, ny: number) => void;
  color: string;
}

export default function VAPad({ x, y, onChangeXY, color }: VAPadProps) {
  // Dot position animation
  const dotStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x.value * (HALF - DOT_R) },
        { translateY: -y.value * (HALF - DOT_R) }
      ] as const,
    };
  });

  // Pan gesture for both X and Y axes
  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(Haptics.selectionAsync)();
    })
    .onChange(e => {
      'worklet';
      // Update both X and Y
      const rawX = x.value + (e.changeX) / (HALF - DOT_R);
      const rawY = y.value + (-e.changeY) / (HALF - DOT_R);
      const nx = Math.max(-1, Math.min(1, rawX));
      const ny = Math.max(-1, Math.min(1, rawY));
      x.value = nx;
      y.value = ny;
      runOnJS(onChangeXY)(nx, ny);
    });

  // Tap to jump to position
  const tap = Gesture.Tap().onEnd(e => {
    'worklet';
    // Calculate both X and Y from tap position
    const rawX = (e.x - HALF) / (HALF - DOT_R);
    const rawY = (HALF - e.y) / (HALF - DOT_R);
    const lx = Math.max(-1, Math.min(1, rawX));
    const ly = Math.max(-1, Math.min(1, rawY));
    x.value = withSpring(lx, { damping: 14, stiffness: 140 });
    y.value = withSpring(ly, { damping: 14, stiffness: 140 });
    runOnJS(onChangeXY)(lx, ly);
  });

  const gesture = Gesture.Simultaneous(pan, tap);

  // Lighten color for glow
  const lightenColor = (hex: string, amount: number) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, ((num >> 16) & 255) + amount * 255);
    const g = Math.min(255, ((num >> 8) & 255) + amount * 255);
    const b = Math.min(255, (num & 255) + amount * 255);
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.padWrap}>
        <Svg width={PAD} height={PAD}>
          <Defs>
            <RadialGradient id="vaGlow" cx="50%" cy="50%" rx="60%" ry="60%">
              <Stop offset="0%" stopColor={withA(color, 0.95)} />
              <Stop offset="72%" stopColor={withA(lightenColor(color, 0.1), 0.28)} />
              <Stop offset="100%" stopColor={withA(lightenColor(color, 0.25), 0.06)} />
            </RadialGradient>
          </Defs>
          
          {/* Background */}
          <Rect x={0} y={0} width={PAD} height={PAD} rx={20} ry={20} fill="#0f1419" />
          
          {/* Glow effect */}
          <Rect x={0} y={0} width={PAD} height={PAD} rx={20} ry={20} fill="url(#vaGlow)" />
          
          {/* Cross axes */}
          <Line x1={HALF} y1={16} x2={HALF} y2={PAD - 16} stroke="#ffffff25" strokeWidth={1.5} />
          <Line x1={16} y1={HALF} x2={PAD - 16} y2={HALF} stroke="#ffffff25" strokeWidth={1.5} />
          
          {/* Concentric circles */}
          <Circle cx={HALF} cy={HALF} r={HALF * 0.35} stroke="#ffffff18" strokeWidth={1} fill="none" />
          <Circle cx={HALF} cy={HALF} r={HALF * 0.70} stroke="#ffffff12" strokeWidth={1} fill="none" />
          
          {/* Axis labels */}
          <SvgText x={HALF} y={12} fill="#ffffff40" fontSize="10" textAnchor="middle">
            Enerjik
          </SvgText>
          <SvgText x={HALF} y={PAD - 6} fill="#ffffff40" fontSize="10" textAnchor="middle">
            Yorgun
          </SvgText>
          <SvgText x={8} y={HALF + 4} fill="#ffffff40" fontSize="10">
            Keyifsiz
          </SvgText>
          <SvgText x={PAD - 40} y={HALF + 4} fill="#ffffff40" fontSize="10">
            Keyifli
          </SvgText>
        </Svg>
        
        {/* Animated dot */}
        <Animated.View 
          style={[
            styles.dot, 
            { backgroundColor: color },
            dotStyle
          ]} 
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  padWrap: {
    width: PAD,
    height: PAD,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    backgroundColor: '#0f1419',
  },
  dot: {
    position: 'absolute',
    width: DOT_R * 2,
    height: DOT_R * 2,
    borderRadius: DOT_R,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
