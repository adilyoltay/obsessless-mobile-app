import { Redirect } from 'expo-router';

export default function Index() {
  // Temporarily bypass all auth - direct redirect for debugging
  return <Redirect href="/(tabs)" />;
} 