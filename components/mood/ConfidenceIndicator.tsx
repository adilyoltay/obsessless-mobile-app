import React from 'react';
import Animated, { interpolate } from 'react-native-reanimated';
import { View, Text, StyleSheet } from 'react-native';

type Props = { confidence?: number; source?: 'voice' | 'manual' | string };

export const ConfidenceIndicator: React.FC<Props> = ({ confidence = 0.5, source }) => {
  const size = interpolate(confidence, [0, 0.5, 1], [8, 12, 16]);
  const opacity = interpolate(confidence, [0, 0.5, 1], [0.3, 0.6, 1]);
  return (
    <Animated.View style={[styles.indicator, { width: size, height: size, opacity }]}> 
      <Text style={styles.icon}>{source === 'voice' ? '🎤' : source === 'manual' ? '✏️' : '•'}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  indicator: { borderRadius: 999, backgroundColor: '#11182722', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 8 },
});

export default ConfidenceIndicator;

