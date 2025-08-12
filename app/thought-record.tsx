import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import ScreenLayout from '@/components/layout/ScreenLayout';
import ThoughtRecordForm from '@/components/forms/ThoughtRecordForm';

export default function ThoughtRecordPage() {
  return (
    <ScreenLayout>
      <Stack.Screen options={{ title: 'CBT Thought Record' }} />
      <View style={styles.container}>
        <ThoughtRecordForm />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


