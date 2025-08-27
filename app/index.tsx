import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

export default function Index() {
  // 🚀 SIMPLIFIED: This is ONLY a loading screen
  // NavigationGuard in _layout.tsx handles ALL navigation logic
  // This prevents duplicate navigation and infinite loops
  
  console.log('🏠 Index: Rendering loading screen (NavigationGuard will handle routing)');
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={{ marginTop: 16, fontSize: 14, color: '#6B7280' }}>Yükleniyor...</Text>
    </View>
  );
} 