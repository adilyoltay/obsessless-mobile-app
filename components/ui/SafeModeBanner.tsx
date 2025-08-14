import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAIStatus } from '@/contexts/AIContext';

export default function SafeModeBanner() {
  const { isInitialized, initializationError, availableFeatures } = useAIStatus() as any;
  // Consume full context to read safeMode
  const ai = require('@/contexts/AIContext');
  const ctx = ai.useAI();
  const show = ctx.safeMode === true || (!isInitialized && initializationError);
  if (!show) return null;
  return (
    <View accessibilityRole="status" accessibilityLabel="Güvenli mod bildirimi" style={styles.container}>
      <Text style={styles.text}>
        Güvenli mod aktif. AI özelliklerinin bir kısmı geçici olarak devre dışı. Temel özellikler kullanılabilir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEE2E2',
    borderBottomColor: '#DC2626',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    color: '#7F1D1D',
    fontSize: 12,
  },
});


