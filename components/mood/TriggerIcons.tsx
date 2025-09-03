import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const TRIGGER_ICONS: Record<string, string> = {
  work: '💼',
  relationship: '💑',
  sleep: '😴',
  exercise: '🏃',
  social: '👥',
  health: '🏥',
  finance: '💰',
  family: '👨‍👩‍👧‍👦',
};

export const TriggerIcon = ({ trigger, size = 16, onPress }: { trigger: string; size?: number; onPress?: () => void }) => {
  return (
    <TouchableOpacity style={[styles.iconContainer, { width: size, height: size }]} onPress={onPress} accessibilityLabel={`${trigger} tetikleyici`}> 
      <Text style={{ fontSize: size * 0.8 }}>{TRIGGER_ICONS[trigger] || '📌'}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconContainer: { alignItems: 'center', justifyContent: 'center' },
});

export default TriggerIcon;

