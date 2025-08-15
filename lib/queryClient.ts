
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
export const storage = {
  setItem: async (key: string, value: string) => {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      console.warn('AsyncStorage: Invalid key provided:', key, new Error('stack').stack);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  getItem: async (key: string) => {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      console.warn('AsyncStorage: Invalid key provided:', key, new Error('stack').stack);
      return null;
    }
    return await AsyncStorage.getItem(key);
  },
  removeItem: async (key: string) => {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      console.warn('AsyncStorage: Invalid key provided:', key, new Error('stack').stack);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};
