import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';
import 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
// 🚫 AI Context - DISABLED (Hard Stop AI Cleanup)
// import { AIProvider } from '@/contexts/AIContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { NavigationGuard } from '@/components/navigation/NavigationGuard';
import { GlobalLoading } from '@/components/ui/GlobalLoading';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConflictNotificationBanner from '@/components/ui/ConflictNotificationBanner';
import { SyncStatusNotification } from '@/components/ui/SyncStatusNotification';

// Import debug helpers in development
if (__DEV__) {
  require('@/utils/debugHelper');
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

  // One-time storage cleanup for legacy CBT/OCD/ERP keys
  useEffect(() => {
    (async () => {
      try {
        const FLAG = '__legacy_cleanup_v1_done__';
        const done = await AsyncStorage.getItem(FLAG);
        if (done === '1') return;
        const allKeys = await AsyncStorage.getAllKeys();
        const shouldRemove = (key: string) => (
          key === 'compulsion_logs' ||
          key === 'ybocs_history' ||
          key === 'compulsionEntries' ||
          key.startsWith('therapy_sessions_') ||
          key.startsWith('erp_sessions_') ||
          key.startsWith('compulsions_') ||
          key.startsWith('last_compulsion_') ||
          key.startsWith('thought_records_') ||
          key.startsWith('thought_record_draft_') ||
          key.startsWith('ocd_profile_')
        );
        const keysToRemove = allKeys.filter(shouldRemove);
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
        await AsyncStorage.setItem(FLAG, '1');
      } catch (e) {
        if (__DEV__) console.warn('Storage cleanup skipped:', e);
      }
    })();
  }, []);

  // Foreground DLQ scheduler: process periodically when app is active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let appStateListener: any;
    (async () => {
      try {
        const { deadLetterQueue } = await import('@/services/sync/deadLetterQueue');
        const { offlineSyncService } = await import('@/services/offlineSync');
        // Run once shortly after startup
        setTimeout(() => { deadLetterQueue.processDeadLetterQueue().catch(() => {}); offlineSyncService.processSyncQueue().catch(()=>{}); }, 3000);
        // Then run periodically
        interval = setInterval(() => {
          deadLetterQueue.processDeadLetterQueue().catch(() => {});
          offlineSyncService.processSyncQueue().catch(()=>{});
        }, 60000);
        // 🔄 App state management: sync on foreground, cleanup on background
        appStateListener = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            console.log('📱 App came to foreground - triggering sync');
            offlineSyncService.processSyncQueue().catch(()=>{});
            deadLetterQueue.processDeadLetterQueue().catch(()=>{});
          } else if (state === 'background' || state === 'inactive') {
            console.log('📱 App went to background - performing cleanup');
            // 🧹 CRITICAL FIX: Cleanup on background to prevent memory leaks
            try {
              import('@/services/crossDeviceSync').then(({ crossDeviceSync }) => {
                crossDeviceSync.cleanup();
              }).catch(() => {});
              
              // Note: Don't cleanup offlineSyncService here as it needs to stay active 
              // for background sync operations. It will be cleaned up on logout/unmount.
              
              console.log('✅ Background cleanup completed');
            } catch (cleanupError) {
              console.error('⚠️ Background cleanup failed (non-critical):', cleanupError);
            }
          }
        });
      } catch {}
    })();
    return () => {
      if (interval) clearInterval(interval);
      try { appStateListener?.remove?.(); } catch {}
      
      // 🧹 CRITICAL FIX: Final cleanup on app termination
      try {
        console.log('🧹 App unmounting - performing final service cleanup');
        import('@/services/offlineSync').then(({ offlineSyncService }) => {
          offlineSyncService.cleanup();
        }).catch(() => {});
        
        import('@/services/crossDeviceSync').then(({ crossDeviceSync }) => {
          crossDeviceSync.cleanup();
        }).catch(() => {});
        
        console.log('✅ Final service cleanup completed');
      } catch (cleanupError) {
        console.error('⚠️ Final cleanup failed (non-critical):', cleanupError);
      }
    };
  }, []);

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
                {/* 🚫 AIProvider - DISABLED (Hard Stop AI Cleanup) */}
                <NavigationGuard>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <Slot />
                      <ConflictNotificationBanner />
                      <SyncStatusNotification />
                      <GlobalLoading />
                      <Toast />
                    </GestureHandlerRootView>
                </NavigationGuard>
                {/* 🚫 AIProvider closing tag removed */}
              </AuthProvider>
            </NotificationProvider>
          </LoadingProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}