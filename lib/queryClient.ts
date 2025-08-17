
import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
function ensureValidKey(key: string): void {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    const err = new Error('AsyncStorage: Invalid key provided');
    // Best-effort telemetry
    import('@/features/ai/telemetry/aiTelemetry')
      .then(({ trackAIError, AIErrorCode, ErrorSeverity }) =>
        trackAIError({ code: AIErrorCode.STORAGE_ERROR, message: 'Invalid storage key', severity: ErrorSeverity.MEDIUM, timestamp: new Date(), recoverable: false, context: { key } })
      )
      .catch(() => {});
    throw err;
  }
}

export const storage = {
  setItem: async (key: string, value: string) => {
    ensureValidKey(key);
    await AsyncStorage.setItem(key, value);
  },
  getItem: async (key: string) => {
    ensureValidKey(key);
    return await AsyncStorage.getItem(key);
  },
  removeItem: async (key: string) => {
    ensureValidKey(key);
    await AsyncStorage.removeItem(key);
  },
};

// Güvenli anahtar üretimi: tanımsız/boş anahtarları kullanıcı-id veya sabit prefix ile güvene alır
export function safeStorageKey(base: string | undefined | null, suffix?: string, fallback: string = 'anon'): string {
  const baseStr = typeof base === 'string' && base.trim().length > 0 ? base : fallback;
  const suf = typeof suffix === 'string' && suffix.trim().length > 0 ? `_${suffix}` : '';
  return `${baseStr}${suf}`;
}
