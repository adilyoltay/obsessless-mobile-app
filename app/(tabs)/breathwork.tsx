import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenLayout from '@/components/layout/ScreenLayout';
import BreathworkPro from '@/components/breathwork/BreathworkPro';

export default function BreathworkTab() {
  return (
    <ScreenLayout>
      <View style={styles.container}>
        <BreathworkPro />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


