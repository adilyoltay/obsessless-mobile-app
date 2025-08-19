
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import type { StyleProp } from 'react-native';

interface BadgeProps {
  text: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Badge({
  text,
  variant = 'default',
  size = 'medium',
  style,
  textStyle,
}: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], styles[size], style]}>
      <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  // Variants
  default: {
    backgroundColor: '#F3F4F6',
  },
  success: {
    backgroundColor: '#D1FAE5',
  },
  warning: {
    backgroundColor: '#FEF3C7',
  },
  danger: {
    backgroundColor: '#FEE2E2',
  },
  info: {
    backgroundColor: '#DBEAFE',
  },
  // Sizes
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  defaultText: {
    color: '#374151',
  },
  successText: {
    color: '#065F46',
  },
  warningText: {
    color: '#92400E',
  },
  dangerText: {
    color: '#991B1B',
  },
  infoText: {
    color: '#1E40AF',
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
  largeText: {
    fontSize: 14,
  },
});
