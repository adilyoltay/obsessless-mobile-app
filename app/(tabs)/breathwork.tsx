import React from 'react';
import { View, StyleSheet } from 'react-native';
import BreathworkPro from '@/components/breathwork/BreathworkPro';

export default function BreathworkTab() {
  return (
    <View style={styles.container}>
      <BreathworkPro />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


