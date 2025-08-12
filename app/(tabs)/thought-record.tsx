import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenLayout from '@/components/layout/ScreenLayout';
import ThoughtRecordForm from '@/components/forms/ThoughtRecordForm';

export default function ThoughtRecordTab() {
  return (
    <ScreenLayout>
      <View style={styles.container}>
        <ThoughtRecordForm />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


