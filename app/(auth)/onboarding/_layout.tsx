import { Stack } from 'expo-router';
import React from 'react';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="motivation" />
      <Stack.Screen name="first-mood" />
      <Stack.Screen name="lifestyle" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}


