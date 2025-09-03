import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';

type Props = {
  dayLabel: string;
  mood: number; // 0..100
  energy: number; // 1..10
  height: number;
  color: string;
  onPress?: () => void;
};

export const AccessibleMoodBar: React.FC<Props> = ({ dayLabel, mood, energy, height, color, onPress }) => {
  const desc = `${dayLabel} günü, mood skoru ${mood} üzerinden 100, enerji ${energy} üzerinden 10.`;
  return (
    <TouchableOpacity accessible accessibilityLabel={desc} accessibilityRole="button" accessibilityHint="Detayları görmek için çift dokunun" onPress={onPress}>
      <View style={[styles.bar, { height, backgroundColor: color }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bar: { width: 12, borderRadius: 6 },
});

export default AccessibleMoodBar;

