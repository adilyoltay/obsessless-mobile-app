import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SafeModeBanner() {
  // 🚫 AI Context - DISABLED (Hard Stop AI Cleanup)
  // Since AI is completely disabled, no safe mode banner needed
  return null;
  
  // Original AI-dependent logic disabled:
  // const { isInitialized, initializationError, availableFeatures } = useAIStatus() as any;
  // const ai = require('@/contexts/AIContext');
  // const ctx = ai.useAI();
  // const show = ctx.safeMode === true || (!isInitialized && initializationError);
  // return (
  //   <View accessibilityRole="text" accessibilityLabel="Güvenli mod bildirimi" style={styles.container}>
  //     <Text style={styles.text}>Güvenli mod aktif. AI özelliklerinin bir kısmı geçici olarak devre dışı. Temel özellikler kullanılabilir.</Text>
  //     <Text style={styles.subtext}>Geliştiriciler bilgilendirildi. Çoğu işlem çevrimdışı/yerel modda çalışır.</Text>
  //   </View>
  // );
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
  subtext: {
    color: '#7F1D1D',
    fontSize: 11,
    marginTop: 2,
    opacity: 0.9,
  },
});


