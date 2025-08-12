import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenLayout from '@/components/layout/ScreenLayout';
import BreathworkPlayer from '@/components/breathwork/BreathworkPlayer';

export default function BreathworkTab() {
  return (
    <ScreenLayout>
      <View style={styles.container}>
        <BreathworkPlayer />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


