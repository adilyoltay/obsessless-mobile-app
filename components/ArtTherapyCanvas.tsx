import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import artTherapyEngine, { type ArtworkData } from '@/features/ai/artTherapy/artTherapyEngine';

interface Props {
  sessionId: string;
}

export default function ArtTherapyCanvas({ sessionId }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSave = async (artwork: ArtworkData) => {
    setIsProcessing(true);
    try {
      await artTherapyEngine.saveArtwork(sessionId, artwork);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* TODO: Replace with actual drawing canvas implementation */}
      {isProcessing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
