import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';

export interface UserProfileContext {
  motivations: string[];
  sleepHours?: number;
  remindersEnabled?: boolean;
}

export async function loadUserProfileContext(userId: string): Promise<UserProfileContext> {
  // Try local first
  try {
    const raw = await AsyncStorage.getItem('onb_v1_payload');
    if (raw) {
      const p = JSON.parse(raw);
      return {
        motivations: p?.motivation || [],
        sleepHours: p?.lifestyle?.sleep_hours,
        remindersEnabled: !!p?.reminders?.enabled,
      };
    }
  } catch {}

  // Fallback to remote snapshot
  try {
    const { data, error } = await (supabaseService as any).supabaseClient
      .from('user_profiles')
      .select('motivations,lifestyle_sleep_hours,reminder_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        motivations: data.motivations || [],
        sleepHours: data.lifestyle_sleep_hours || undefined,
        remindersEnabled: !!data.reminder_enabled,
      };
    }
  } catch {}

  return { motivations: [] };
}


