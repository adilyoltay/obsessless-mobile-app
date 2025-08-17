import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import ScreenLayout from '@/components/layout/ScreenLayout';
import BreathworkPlayer from '@/components/breathwork/BreathworkPlayer';

export default function BreathworkPage() {
  const params = useLocalSearchParams<{ protocol?: 'box'|'478'|'paced' }>();
  const proto = (params.protocol as any) || 'box';
  return (
    <ScreenLayout>
      <Stack.Screen options={{ title: 'Nefes Çalışması' }} />
      <View style={styles.container}>
        <BreathworkPlayer protocol={proto} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


