import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * userIdResolver: central place to resolve current user id
 * - AsyncStorage first
 * - Supabase context fallback
 * Returns null if none is available
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const storedUserId = await AsyncStorage.getItem('currentUserId');
    if (storedUserId && storedUserId !== 'null' && storedUserId !== 'undefined') {
      return storedUserId;
    }
  } catch {}

  try {
    const { default: supabaseService } = await import('@/services/supabase');
    const contextUserId = supabaseService.getCurrentUserId?.();
    if (contextUserId && contextUserId !== 'null' && contextUserId !== 'undefined') {
      try { await AsyncStorage.setItem('currentUserId', contextUserId); } catch {}
      return contextUserId;
    }
  } catch {}

  return null;
}

