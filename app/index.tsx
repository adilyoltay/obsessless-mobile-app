import { Redirect } from 'expo-router';

export default function Index() {
  // Simple direct redirect to tabs
  return <Redirect href="/(tabs)" />;
} 