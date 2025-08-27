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
  isHydrated: boolean;
  isLoading: boolean;
  setStep: (s: number) => void;
  next: () => void;
  prev: () => void;
  setMotivation: (m: MotivationKey[]) => void;
  setFirstMood: (score?: 1|2|3|4|5, tags?: string[]) => void;
  setLifestyle: (data: OnboardingPayload['lifestyle']) => void;
  setReminders: (data: OnboardingPayload['reminders']) => void;
  
  // Persistence methods
  hydrateFromStorage: (userId?: string) => Promise<void>;
  persistToStorage: () => Promise<void>;
  syncToSupabase: (userId: string) => Promise<void>;
  reset: () => void;
  
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
  isHydrated: false,
  isLoading: false,

  setStep: (s) => set({ step: s }),
  next: () => set((st) => ({ step: Math.min(st.step + 1, st.totalSteps - 1) })),
  prev: () => set((st) => ({ step: Math.max(st.step - 1, 0) })),

  setMotivation: (m) => {
    set((st) => ({ payload: { ...st.payload, motivation: m } }));
    // Auto-persist on change
    setTimeout(() => get().persistToStorage(), 100);
  },
  
  setFirstMood: (score, tags) => {
    set((st) => ({ payload: { ...st.payload, first_mood: { score, tags, source: 'onboarding' } } }));
    // Auto-persist on change
    setTimeout(() => get().persistToStorage(), 100);
  },
  
  setLifestyle: (data) => {
    set((st) => ({ payload: { ...st.payload, lifestyle: { ...(st.payload.lifestyle||{}), ...(data||{}) } } }));
    // Auto-persist on change
    setTimeout(() => get().persistToStorage(), 100);
  },
  
  setReminders: (data) => {
    set((st) => ({ payload: { ...st.payload, reminders: { enabled: !!data?.enabled, time: data?.time, days: data?.days, timezone: data?.timezone } } }));
    // Auto-persist on change
    setTimeout(() => get().persistToStorage(), 100);
  },

  finalizeFlags: () => {
    set((st) => {
      const base = deriveFeatureFlags(st.payload.motivation || []);
      const withReminder = applyReminderRule(base, st.payload.reminders?.enabled);
      return { payload: { ...st.payload, feature_flags: withReminder } };
    });
    // Auto-persist on change
    setTimeout(() => get().persistToStorage(), 100);
  },

  // ===========================
  // PERSISTENCE METHODS
  // ===========================

  hydrateFromStorage: async (userId?: string) => {
    try {
      set({ isLoading: true, isHydrated: false });
      
      // Try to restore payload from storage
      const storedPayload = await AsyncStorage.getItem(STORAGE_KEY);
      let restoredPayload: OnboardingPayload | null = null;
      
      if (storedPayload) {
        restoredPayload = JSON.parse(storedPayload);
        console.log('🔄 Onboarding data restored from AsyncStorage:', restoredPayload);
      }
      
      // Try to restore user-specific profile_v2 snapshot
      if (userId && isUUID(userId)) {
        try {
          const profileSnapshot = await AsyncStorage.getItem('profile_v2');
          if (profileSnapshot) {
            const snapshot = JSON.parse(profileSnapshot);
            if (snapshot.userId === userId && snapshot.payload) {
              restoredPayload = snapshot.payload;
              console.log('🔄 User-specific onboarding data restored:', restoredPayload);
            }
          }
        } catch {}
      }
      
      // Apply restored data if found
      if (restoredPayload) {
        // Validate payload structure
        const validPayload: OnboardingPayload = {
          motivation: restoredPayload.motivation || [],
          first_mood: restoredPayload.first_mood || undefined,
          lifestyle: restoredPayload.lifestyle || undefined,
          reminders: restoredPayload.reminders || undefined,
          feature_flags: restoredPayload.feature_flags || undefined,
          profile: restoredPayload.profile || undefined,
          meta: restoredPayload.meta || { version: 1, created_at: new Date().toISOString() }
        };
        
        // Calculate completion step based on data
        let step = 0;
        if (validPayload.motivation.length > 0) step = Math.max(step, 1);
        if (validPayload.first_mood) step = Math.max(step, 2);
        if (validPayload.lifestyle) step = Math.max(step, 3);
        if (validPayload.reminders) step = Math.max(step, 4);
        if (validPayload.feature_flags) step = Math.max(step, 5);
        
        set({
          payload: validPayload,
          step,
          isHydrated: true,
          isLoading: false,
          startedAt: validPayload.meta.created_at ? new Date(validPayload.meta.created_at).getTime() : Date.now()
        });
        
        console.log(`✅ Onboarding hydrated - Step: ${step}, Payload:`, validPayload);
      } else {
        set({ isHydrated: true, isLoading: false });
        console.log('📝 No onboarding data found - starting fresh');
      }
      
    } catch (error) {
      console.error('❌ Onboarding hydration failed:', error);
      set({ isHydrated: true, isLoading: false });
    }
  },

  persistToStorage: async () => {
    try {
      const { payload } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      console.log('💾 Onboarding data persisted to AsyncStorage');
    } catch (error) {
      console.error('❌ Failed to persist onboarding data:', error);
    }
  },

  syncToSupabase: async (userId: string) => {
    if (!isUUID(userId)) {
      console.warn('⚠️ Invalid userId for Supabase sync:', userId);
      return;
    }
    
    try {
      const { payload } = get();
      
      // Upsert user profile (primary sync)
      await supabaseService.upsertUserProfile(userId, payload);
      console.log('☁️ Onboarding data synced to Supabase');
      
      // Update user metadata with feature flags
      if (payload.feature_flags) {
        const meta = {
          metadata: {
            feature_flags: payload.feature_flags,
            onboarding_v1: {
              motivation: payload.motivation,
              lifestyle: payload.lifestyle || {},
              reminders: payload.reminders || { enabled: false },
              version: payload.meta?.version || 1,
              created_at: payload.meta?.created_at || new Date().toISOString(),
            }
          }
        } as any;
        await supabaseService.updateUser(userId, meta);
        console.log('☁️ User metadata updated with feature flags');
      }
      
    } catch (error) {
      console.error('❌ Supabase sync failed, adding to offline queue:', error);
      
      // Fallback: Add to offline sync queue
      try {
        const { offlineSyncService } = await import('@/services/offlineSync');
        await offlineSyncService.addToSyncQueue({
          entity: 'user_profile',
          type: 'UPDATE',
          data: { payload: get().payload, userId },
        });
        console.log('📥 Onboarding data added to offline sync queue');
      } catch (queueError) {
        console.error('❌ Failed to add to sync queue:', queueError);
      }
    }
  },

  reset: () => {
    set({
      step: 0,
      payload: {
        motivation: [],
        meta: { version: 1, created_at: new Date().toISOString() },
      },
      startedAt: Date.now(),
      isHydrated: false,
      isLoading: false,
    });
    console.log('🔄 Onboarding store reset');
  },

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
      // Write profile_v2 snapshot after resolving a stable uid
      try { await AsyncStorage.setItem('profile_v2', JSON.stringify({ userId: isUUID(uidForKey) ? uidForKey : userId, payload, savedAt: new Date().toISOString() })); } catch {}
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

      // Sync to Supabase using new method
      if (isUUID(uidForKey)) {
        await get().syncToSupabase(uidForKey);
      } else {
        console.warn('⚠️ Unable to sync to Supabase: Invalid user ID');
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


