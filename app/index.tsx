import React from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  // NavigationGuard will handle the routing
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
} 