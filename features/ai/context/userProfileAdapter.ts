import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

export interface UserProfileContext {
  motivations: string[];
  sleepHours?: number;
  remindersEnabled?: boolean;
}

export async function loadUserProfileContext(userId: string): Promise<UserProfileContext> {
  // Try local first
  try {
    const snap = await AsyncStorage.getItem('profile_v2');
    if (snap) {
      const s = JSON.parse(snap);
      // Scope check: validate snapshot user
      const snapUserId = s?.userId || s?.payload?.user_id || s?.payload?.userId;
      if (snapUserId && snapUserId !== userId) {
        // Different user's snapshot; skip and fall back
        try { await trackAIInteraction(AIEventType.SYSTEM_STATUS, { event: 'stale_snapshot_scope_mismatch' }, userId); } catch {}
      } else {
        // Freshness check: 7 days
        const createdAt = Number(s?.createdAt || s?.timestamp || 0);
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
        const isStale = !createdAt || (Date.now() - createdAt) > maxAgeMs;
        if (isStale) {
          try { await trackAIInteraction(AIEventType.SYSTEM_STATUS, { event: 'stale_snapshot', ageMs: createdAt ? (Date.now() - createdAt) : -1 }, userId); } catch {}
        } else {
          const p = s?.payload || {};
          return {
            motivations: Array.isArray(p?.motivation) ? p.motivation : [],
            sleepHours: p?.lifestyle?.sleep_hours,
            remindersEnabled: !!p?.reminders?.enabled,
          };
        }
      }
    }
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


