import React from 'react';
import { View, Text, Switch as RNSwitch, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
  style?: ViewStyle;
  label?: string;
  description?: string;
}

export function Switch({
  value,
  onValueChange,
  disabled = false,
  trackColor = { false: '#E5E7EB', true: '#10B981' },
  thumbColor = '#FFFFFF',
  style,
  label,
  description,
}: SwitchProps) {
  const handleValueChange = (newValue: boolean) => {
    // Haptics.selectionAsync(); // Geçici olarak devre dışı
    onValueChange(newValue);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {label && (
          <View style={styles.textContainer}>
            <Text style={styles.label}>{label}</Text>
            {description && <Text style={styles.description}>{description}</Text>}
          </View>
        )}
        <RNSwitch
          value={value}
          onValueChange={handleValueChange}
          disabled={disabled}
          trackColor={trackColor}
          thumbColor={thumbColor}
          style={styles.switch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
});