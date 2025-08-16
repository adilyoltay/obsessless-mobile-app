
import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Telemetry için lazy import
let telemetryModule: any = null;
const getTelemetry = async () => {
  if (!telemetryModule) {
    telemetryModule = await import('@/features/ai/telemetry/aiTelemetry');
  }
  return telemetryModule;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Storage utilities for React Query persistence
export const storage = {
  setItem: async (key: string, value: string) => {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      const err = new Error('AsyncStorage: Invalid key provided');
      
      // Telemetry gönder
      try {
        const { trackAIError, AIErrorCode, ErrorSeverity } = await getTelemetry();
        await trackAIError({
          code: AIErrorCode.INVALID_STORAGE_KEY || 'INVALID_STORAGE_KEY',
          message: `Invalid storage key in setItem: ${key}`,
          severity: ErrorSeverity.HIGH || 'HIGH',
          context: { operation: 'setItem', key, stack: err.stack },
          timestamp: new Date(),
          recoverable: false,
          userMessage: 'Veri saklama hatası'
        });
      } catch (telemetryError) {
        console.warn('Failed to send telemetry:', telemetryError);
      }
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        throw err;
      }
      console.warn('AsyncStorage: Invalid key provided:', key, err.stack);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  getItem: async (key: string) => {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      const err = new Error('AsyncStorage: Invalid key provided');
      
      // Telemetry gönder
      try {
        const { trackAIError, AIErrorCode, ErrorSeverity } = await getTelemetry();
        await trackAIError({
          code: AIErrorCode.INVALID_STORAGE_KEY || 'INVALID_STORAGE_KEY',
          message: `Invalid storage key in getItem: ${key}`,
          severity: ErrorSeverity.HIGH || 'HIGH',
          context: { operation: 'getItem', key, stack: err.stack },
          timestamp: new Date(),
          recoverable: false,
          userMessage: 'Veri okuma hatası'
        });
      } catch (telemetryError) {
        console.warn('Failed to send telemetry:', telemetryError);
      }
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        throw err;
      }
      console.warn('AsyncStorage: Invalid key provided:', key, err.stack);
      return null;
    }
    return await AsyncStorage.getItem(key);
  },
  removeItem: async (key: string) => {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      const err = new Error('AsyncStorage: Invalid key provided');
      
      // Telemetry gönder
      try {
        const { trackAIError, AIErrorCode, ErrorSeverity } = await getTelemetry();
        await trackAIError({
          code: AIErrorCode.INVALID_STORAGE_KEY || 'INVALID_STORAGE_KEY',
          message: `Invalid storage key in removeItem: ${key}`,
          severity: ErrorSeverity.HIGH || 'HIGH',
          context: { operation: 'removeItem', key, stack: err.stack },
          timestamp: new Date(),
          recoverable: false,
          userMessage: 'Veri silme hatası'
        });
      } catch (telemetryError) {
        console.warn('Failed to send telemetry:', telemetryError);
      }
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        throw err;
      }
      console.warn('AsyncStorage: Invalid key provided:', key, err.stack);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

// Güvenli anahtar üretimi: tanımsız/boş anahtarları kullanıcı-id veya sabit prefix ile güvene alır
export function safeStorageKey(base: string | undefined | null, suffix?: string, fallback: string = 'anon'): string {
  const baseStr = typeof base === 'string' && base.trim().length > 0 ? base : fallback;
  const suf = typeof suffix === 'string' && suffix.trim().length > 0 ? `_${suffix}` : '';
  return `${baseStr}${suf}`;
}
