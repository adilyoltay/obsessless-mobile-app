import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// Android/Web: opaque background with subtle shadow/elevation
export default function TabBarBackground() {
  return <View style={[StyleSheet.absoluteFill, styles.background]} />;
}

export function useBottomTabOverflow() {
  return 0;
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: Platform.OS === 'web' ? 1 : StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    elevation: 4,
    // @ts-ignore web-only style
    boxShadow: '0 -2px 6px rgba(0,0,0,0.06)',
  },
});
