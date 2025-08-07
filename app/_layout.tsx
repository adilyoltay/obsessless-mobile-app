import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { NavigationGuard } from '@/components/navigation/NavigationGuard';
import { GlobalLoading } from '@/components/ui/GlobalLoading';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import ErrorBoundary from '@/components/ErrorBoundary';

// Import debug helpers in development
if (__DEV__) {
  require('@/utils/debugHelper');
  require('@/utils/erpDebugHelper');
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <LoadingProvider>
            <NotificationProvider>
              <AuthProvider>
                <NavigationGuard>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <Slot />
                    <GlobalLoading />
                    <Toast />
                  </GestureHandlerRootView>
                </NavigationGuard>
              </AuthProvider>
            </NotificationProvider>
          </LoadingProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}