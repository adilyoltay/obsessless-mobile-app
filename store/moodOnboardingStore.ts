import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deriveFeatureFlags, applyReminderRule } from '@/features/onboarding/lib/deriveFeatureFlags';
import type { OnboardingPayload, MotivationKey } from '@/features/onboarding/types';
import moodTracker from '@/services/moodTrackingService';
import { isUUID } from '@/utils/validators';
import supabaseService from '@/services/supabase';
import { NotificationScheduler } from '@/services/notificationScheduler';

interface MoodOnboardingState {
  step: number;
  totalSteps: number;
  payload: OnboardingPayload;
  startedAt: number;
  setStep: (s: number) => void;
  next: () => void;
  prev: () => void;
  setMotivation: (m: MotivationKey[]) => void;
  setFirstMood: (score?: 1|2|3|4|5, tags?: string[]) => void;
  setLifestyle: (data: OnboardingPayload['lifestyle']) => void;
  setReminders: (data: OnboardingPayload['reminders']) => void;
  finalizeFlags: () => void;
  complete: (userId: string) => Promise<void>;
}

const STORAGE_KEY = 'onb_v1_payload';

export const useMoodOnboardingStore = create<MoodOnboardingState>((set, get) => ({
  step: 0,
  totalSteps: 6,
  payload: {
    motivation: [],
    meta: { version: 1, created_at: new Date().toISOString() },
  },
  startedAt: Date.now(),

  setStep: (s) => set({ step: s }),
  next: () => set((st) => ({ step: Math.min(st.step + 1, st.totalSteps - 1) })),
  prev: () => set((st) => ({ step: Math.max(st.step - 1, 0) })),

  setMotivation: (m) => set((st) => ({ payload: { ...st.payload, motivation: m } })),
  setFirstMood: (score, tags) => set((st) => ({ payload: { ...st.payload, first_mood: { score, tags, source: 'onboarding' } } })),
  setLifestyle: (data) => set((st) => ({ payload: { ...st.payload, lifestyle: { ...(st.payload.lifestyle||{}), ...(data||{}) } } })),
  setReminders: (data) => set((st) => ({ payload: { ...st.payload, reminders: { enabled: !!data?.enabled, time: data?.time, days: data?.days, timezone: data?.timezone } } })),

  finalizeFlags: () => set((st) => {
    const base = deriveFeatureFlags(st.payload.motivation || []);
    const withReminder = applyReminderRule(base, st.payload.reminders?.enabled);
    return { payload: { ...st.payload, feature_flags: withReminder } };
  }),

  complete: async (userId: string) => {
    const { payload, startedAt } = get();
    const durationMs = Date.now() - startedAt;
    try {
      // Persist locally
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      // Always set a generic completion flag to avoid loops before auth resolves
      await AsyncStorage.setItem('ai_onboarding_completed', 'true');
      await AsyncStorage.setItem('ai_onboarding_completed_at', new Date().toISOString());
      // Best-effort resolve a valid user id for user-specific key
      let uidForKey = userId;
      if (!isUUID(uidForKey)) {
        try {
          const { default: svc } = await import('@/services/supabase');
          const current = (svc as any)?.getCurrentUser?.() || (svc as any)?.currentUser || null;
          if (current && typeof current === 'object' && current.id) uidForKey = current.id;
        } catch {}
      }
      if (!isUUID(uidForKey)) {
        const stored = await AsyncStorage.getItem('currentUserId');
        if (stored && isUUID(stored)) uidForKey = stored as any;
      }
      if (isUUID(uidForKey)) {
        await AsyncStorage.setItem(`ai_onboarding_completed_${uidForKey}`, 'true');
      }

      // First mood (best effort)
      if (payload.first_mood?.score && isUUID(uidForKey)) {
        try {
          await moodTracker.saveMoodEntry({
            user_id: uidForKey,
            mood_score: Math.max(1, Math.min(10, (payload.first_mood.score*2)+1)),
            energy_level: 5,
            anxiety_level: 5,
            notes: undefined,
            triggers: payload.first_mood.tags || [],
            activities: [],
          });
        } catch {}
      }

      // Preferences/metadata (best effort)
      try {
        if (!isUUID(uidForKey)) throw new Error('no-auth-user');
        const meta = {
          metadata: {
            ...(payload.feature_flags ? { feature_flags: payload.feature_flags } : {}),
            onboarding_v1: {
              motivation: payload.motivation,
              lifestyle: payload.lifestyle || {},
              reminders: payload.reminders || { enabled: false },
              version: payload.meta?.version || 1,
              created_at: payload.meta?.created_at || new Date().toISOString(),
            }
          },
          locale: payload.profile?.locale
        } as any;
        await supabaseService.updateUser(uidForKey, meta);
      } catch {}

      // Upsert user profile (v2)
      try {
        if (!isUUID(uidForKey)) throw new Error('no-auth-user');
        await supabaseService.upsertUserProfile(uidForKey, payload);
      } catch (error) {
        try {
          const { offlineSyncService } = await import('@/services/offlineSync');
          await offlineSyncService.addToSyncQueue({
            entity: 'user_profile',
            type: 'UPDATE',
            data: { payload, version: 2 }
          });
        } catch {}
      }

      // Schedule notifications if enabled (best effort)
      try {
        if (payload.reminders?.enabled && payload.reminders.time) {
          const [h, m] = (payload.reminders.time || '09:00').split(':').map(Number);
          const now = new Date();
          const scheduleAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 9, m || 0, 0);
          await NotificationScheduler.scheduleDailyMoodReminder(scheduleAt);
        }
      } catch {}

      // Analytics tracking
      try {
        const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await trackAIInteraction(AIEventType.ONBOARDING_COMPLETED, {
          userId: uidForKey || userId,
          durationMs,
          steps: get().step+1,
          motivations: payload.motivation,
          hasReminder: !!payload.reminders?.enabled,
        });
      } catch {}
    } finally {
      // no-op
    }
  }
}));


