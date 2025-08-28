import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deriveFeatureFlags, applyReminderRule } from '@/features/onboarding/lib/deriveFeatureFlags';
import type { OnboardingPayload, MotivationKey } from '@/features/onboarding/types';
import moodTracker from '@/services/moodTrackingService';
import { isUUID } from '@/utils/validators';
import supabaseService from '@/services/supabase';
import { NotificationScheduler } from '@/services/notificationScheduler';
// ✅ NEW: AI integration for onboarding data
import * as pipeline from '@/features/ai-fallbacks/pipeline';
import { trackAIInteraction, AIEventType } from '@/features/ai-fallbacks/telemetry';

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
  complete: (userId: string) => Promise<{ success: boolean; criticalErrors: string[]; warnings: string[] }>;
  
  // Progressive AI insight methods
  collectProgressiveInsights: () => Promise<Record<string, any>>;
  cleanupProgressiveCache: () => Promise<void>;
  generateFallbackProfile: (payload: OnboardingPayload, progressiveInsights: Record<string, any>, userId: string) => any;
  
  // Offline-safe AI analysis methods
  analyzeMotivationWithFallback: (motivations: MotivationKey[]) => Promise<void>;
  analyzeFirstMoodWithFallback: (score?: 1|2|3|4|5, tags?: string[]) => Promise<void>;
  generateMotivationFallback: (motivations: MotivationKey[]) => any;
  generateMoodFallback: (score: 1|2|3|4|5, tags?: string[]) => any;
}

// 🚀 V2: Updated storage keys for enhanced onboarding
const STORAGE_KEY_PAYLOAD = 'profile_v2_payload';
const STORAGE_KEY_STEP = 'profile_v2_current_step';

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
    
    // 🤖 Progressive AI Analysis: Analyze motivations with offline fallback
    setTimeout(async () => {
      await get().analyzeMotivationWithFallback(m);
    }, 700);
  },
  
  setFirstMood: (score, tags) => {
    set((st) => ({ payload: { ...st.payload, first_mood: { score, tags, source: 'onboarding' } } }));
    // Auto-persist on change
    setTimeout(() => get().persistToStorage(), 100);
    
    // 🤖 Progressive AI Analysis: Generate baseline mood insights with offline fallback  
    setTimeout(async () => {
      await get().analyzeFirstMoodWithFallback(score, tags);
    }, 500);
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
      
      // 🚀 V2: Restore both payload and step information
      const storedPayload = await AsyncStorage.getItem(STORAGE_KEY_PAYLOAD);
      const storedStep = await AsyncStorage.getItem(STORAGE_KEY_STEP);
      let restoredPayload: OnboardingPayload | null = null;
      let restoredStep = 0;
      
      if (storedPayload) {
        restoredPayload = JSON.parse(storedPayload);
        console.log('🔄 V2 Onboarding data restored from AsyncStorage:', restoredPayload);
      }
      
      if (storedStep) {
        restoredStep = parseInt(storedStep, 10) || 0;
        console.log('📍 V2 Onboarding step restored:', restoredStep);
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
          step: Math.max(step, restoredStep), // Use the higher of calculated vs stored step
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
      const { payload, step } = get();
      
      // 🚀 V2: Persist both payload and current step for seamless resume
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_PAYLOAD, JSON.stringify(payload)),
        AsyncStorage.setItem(STORAGE_KEY_STEP, step.toString())
      ]);
      
      console.log(`💾 V2 Onboarding data persisted: step ${step}, payload stored`);
    } catch (error) {
      console.error('❌ Failed to persist V2 onboarding data:', error);
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

  // Helper methods for progressive AI insights
  collectProgressiveInsights: async () => {
    const insights: Record<string, any> = {};
    
    try {
      // Collect mood insights
      const moodInsights = await AsyncStorage.getItem('onboarding_mood_insights');
      if (moodInsights) {
        insights.mood = JSON.parse(moodInsights);
      }
      
      // Collect motivation insights  
      const motivationInsights = await AsyncStorage.getItem('onboarding_motivation_insights');
      if (motivationInsights) {
        insights.motivation = JSON.parse(motivationInsights);
      }
      
      return insights;
    } catch (error) {
      console.warn('⚠️ Failed to collect progressive insights:', error);
      return {};
    }
  },

  cleanupProgressiveCache: async () => {
    try {
      await AsyncStorage.multiRemove([
        'onboarding_mood_insights',
        'onboarding_motivation_insights'
      ]);
      console.log('🧹 Progressive insight cache cleaned up');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup progressive cache:', error);
    }
  },

  // 🛡️ FALLBACK PROFILE GENERATOR - Smart baseline profile from onboarding data
  generateFallbackProfile: (payload: OnboardingPayload, progressiveInsights: Record<string, any>, userId: string) => {
    try {
      console.log('🛡️ Generating intelligent fallback profile from onboarding data...');
      
      // 📊 MOTIVATION ANALYSIS: Convert motivations to insights
      const motivationInsights = payload.motivation?.map(motivation => {
        const motivationMap: Record<string, string> = {
          'stress_reduction': 'Stress yönetimi konusunda odaklanmak istiyorsun. Günlük nefes egzersizleri sana yardımcı olacak.',
          'mental_clarity': 'Zihinsel netlik arayışındasın. Düzenli mood takibi düşüncelerini organize etmene yardımcı olabilir.',
          'emotional_regulation': 'Duygu düzenleme becerilerin geliştirmek istiyorsun. Günlük mood kayıtları bu süreçte önemli.',
          'anxiety_management': 'Kaygı yönetimi önceliğin. Nefes teknikleri ve mindfulness pratikleri etkili olacak.',
          'habit_formation': 'Olumlu alışkanlıklar oluşturmak istiyorsun. Küçük, tutarlı adımlarla başlayalım.',
          'self_awareness': 'Kendini tanıma yolculuğundasın. Mood takibi öz-farkındalığını artıracak.',
          'goal_achievement': 'Hedeflerine ulaşmak için motivasyon arıyorsun. Günlük takip ilerleme görmeni sağlayacak.',
          'better_relationships': 'İlişkilerini iyileştirmek istiyorsun. Duygusal farkındalık bu konuda önemli.'
        };
        
        return motivationMap[motivation] || `${motivation} konusunda hedeflerin var ve bu olumlu bir başlangıç.`;
      }) || ['ObsessLess yolculuğuna başladığın için tebrikler!'];

      // 🎭 MOOD BASELINE: First mood analysis
      let moodBaseline = 'Ruh halini takip etmeye başladın, bu önemli bir adım.';
      if (payload.first_mood?.score) {
        const score = payload.first_mood.score;
        if (score >= 4) {
          moodBaseline = `Başlangıç mood seviyeniz oldukça iyi (${score}/5). Bu pozitif enerjiyi korumaya odaklanabilirsin.`;
        } else if (score <= 2) {
          moodBaseline = `Başlangıç mood seviyeniz düşük (${score}/5). Bu sadece bir başlangıç noktası - zamanla iyileşecek.`;
        } else {
          moodBaseline = `Orta seviye mood (${score}/5) ile başlıyorsun. Günlük takiple daha iyi anlayacaksın.`;
        }
      }

      // 🏠 LIFESTYLE INSIGHTS: Analyze lifestyle data
      let lifestyleInsights = [];
      if (payload.lifestyle) {
        const lifestyle = payload.lifestyle;
        
        if (lifestyle.exercise) {
          const exercise = lifestyle.exercise;
          if (exercise === 'regular') {
            lifestyleInsights.push('Düzenli egzersiz alışkanlığın mood stabiliten için mükemmel bir temel.');
          } else if (exercise === 'light') {
            lifestyleInsights.push('Hafif egzersiz rutinin iyi. Mood takibi ile egzersiz-ruh hali bağlantısını keşfedeceksin.');
          } else {
            lifestyleInsights.push('Egzersizin mood üzerindeki etkisini takip ederek motivasyonunu artırabilirsin.');
          }
        }
        
        if (lifestyle.sleep_hours) {
          const sleepHours = lifestyle.sleep_hours;
          if (sleepHours < 6) {
            lifestyleInsights.push('Uyku süresi mood için kritik. Daha fazla uyumaya odaklanmak ruh halini iyileştirebilir.');
          } else if (sleepHours >= 7) {
            lifestyleInsights.push('Yeterli uyku süresi mood stabiliteni destekliyor. Bu sağlıklı alışkanlığını koru.');
          }
        }
        
        if (lifestyle.social) {
          const social = lifestyle.social;
          if (social === 'low') {
            lifestyleInsights.push('Sosyal aktiviteler mood için önemli. Küçük sosyal etkileşimler bile fark yaratabilir.');
          } else if (social === 'high') {
            lifestyleInsights.push('Aktif sosyal hayatın mood dengen için harika bir kaynak.');
          }
        }
      }

      // 🔔 REMINDER PERSONALIZATION
      let reminderInsights = [];
      if (payload.reminders?.enabled) {
        reminderInsights.push(`${payload.reminders.time || '09:00'} saatinde günlük mood kaydı için hatırlatıcı aktif. Tutarlılık başarının anahtarı.`);
      } else {
        reminderInsights.push('Mood takibini alışkanlık haline getirmek için kendi ritmini oluştur.');
      }

      // 🎯 PERSONALIZED GOALS based on data
      const personalizedGoals = [
        'Haftada en az 5 mood kaydı yaparak ruh halindeki değişimleri fark et',
        'Mood seviyeni etkileyen faktörleri keşfet ve not al',
        ...motivationInsights.slice(0, 1) // Add main motivation as goal
      ];

      // 🏆 FALLBACK PROFILE STRUCTURE
      return {
        insights: [
          ...motivationInsights,
          moodBaseline,
          ...lifestyleInsights,
          ...reminderInsights,
          'Bu profil onboarding verilerinden oluşturuldu. Uygulamayı kullandıkça daha kişisel öneriler alacaksın.'
        ],
        patterns: [
          {
            type: 'onboarding_baseline',
            title: 'Başlangıç Profili',
            description: moodBaseline,
            confidence: 0.8,
            source: 'fallback_generator'
          }
        ],
        baseline: {
          motivationAnalysis: motivationInsights,
          personalizedGoals: personalizedGoals,
          lifestyleFactors: lifestyleInsights
        },
        generatedAt: new Date().toISOString(),
        source: 'intelligent_fallback',
        profileVersion: '2.0-fallback',
        dataPoints: {
          motivationCount: payload.motivation?.length || 0,
          hasMoodBaseline: !!payload.first_mood?.score,
          hasLifestyleData: !!payload.lifestyle,
          hasReminders: !!payload.reminders?.enabled,
          progressiveInsights: Object.keys(progressiveInsights).length
        },
        fallbackReason: 'AI analysis timeout/failure - generated from onboarding data'
      };
      
    } catch (error) {
      console.warn('⚠️ Fallback profile generation failed, using minimal profile:', error);
      
      // MINIMAL FALLBACK: Very basic profile
      return {
        insights: [
          'ObsessLess\'e hoş geldin! Mood takip yolculuğun başlıyor.',
          'Günlük mood kayıtları yaparak duygularını daha iyi anlayacaksın.',
          'Zamanla kişiselleştirilmiş öneriler almaya başlayacaksın.'
        ],
        patterns: [],
        baseline: {
          personalizedGoals: ['Mood takibine başla', 'Düzenli kayıt yap', 'Değişimleri gözlemle']
        },
        generatedAt: new Date().toISOString(),
        source: 'minimal_fallback',
        profileVersion: '2.0-minimal',
        fallbackReason: 'Complete AI failure - minimal profile'
      };
    }
  },

  complete: async (userId: string): Promise<{ success: boolean; criticalErrors: string[]; warnings: string[] }> => {
    const { payload, startedAt } = get();
    const durationMs = Date.now() - startedAt;
    const result = { success: true, criticalErrors: [] as string[], warnings: [] as string[] };
    
    console.log('🔄 Starting enhanced onboarding completion...');

    // ✅ STEP 1: CRITICAL - Local Persistence (rarely fails but essential)
    try {
      // 🚀 V2: Persist with new storage keys  
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_PAYLOAD, JSON.stringify(payload)),
        AsyncStorage.setItem(STORAGE_KEY_STEP, '6') // Mark as completed (step 6)
      ]);
      console.log('✅ V2 Local persistence completed');
    } catch (error) {
      const errorMsg = 'Local storage persistence failed';
      result.criticalErrors.push(errorMsg);
      console.error('❌ CRITICAL:', errorMsg, error);
    }

    // ✅ STEP 2: User ID Resolution (critical for all user-specific operations)
    let uidForKey = userId;
    if (!isUUID(uidForKey)) {
      try {
        const { default: svc } = await import('@/services/supabase');
        const current = (svc as any)?.getCurrentUser?.() || (svc as any)?.currentUser || null;
        if (current && typeof current === 'object' && current.id) uidForKey = current.id;
      } catch {}
      
      if (!isUUID(uidForKey)) {
        const stored = await AsyncStorage.getItem('currentUserId');
        if (stored && isUUID(stored)) uidForKey = stored as any;
      }
    }

    if (!isUUID(uidForKey)) {
      const errorMsg = 'Unable to resolve valid user ID';
      result.criticalErrors.push(errorMsg);
      result.success = false;
      console.error('❌ CRITICAL:', errorMsg);
      return result; // Can't proceed without valid user ID
    }

    // ✅ STEP 3: User-specific storage (critical for user data integrity)  
    try {
      await AsyncStorage.setItem('profile_v2', JSON.stringify({ 
        userId: uidForKey, 
        payload, 
        savedAt: new Date().toISOString() 
      }));
      // 🚫 REMOVED: User-specific completion flag moved to end after all critical operations succeed
      console.log('✅ User-specific storage completed');
    } catch (error) {
      const errorMsg = 'User-specific storage failed';
      result.criticalErrors.push(errorMsg);
      console.error('❌ CRITICAL:', errorMsg, error);
    }

    // ✅ STEP 4: CRITICAL - First Mood Entry (important baseline data)
    if (payload.first_mood?.score) {
      try {
        await moodTracker.saveMoodEntry({
          user_id: uidForKey,
          mood_score: Math.max(10, Math.min(100, payload.first_mood.score * 20)), // 1-5 → 20-100 consistent mapping
          energy_level: 5, // Default neutral energy (1-10 scale)
          anxiety_level: 5, // Default neutral anxiety (1-10 scale)
          notes: 'İlk onboarding ruh hali kaydı - Baseline ölçüm',
          triggers: payload.first_mood.tags || [],
          activities: [],
        });
        console.log('✅ First mood entry saved successfully');
      } catch (error) {
        const errorMsg = 'First mood entry save failed';
        result.criticalErrors.push(errorMsg);
        console.error('❌ CRITICAL:', errorMsg, error);
        
        // Try to track the failure for recovery later
        try {
          const { safeTrackAIInteraction } = await import('@/features/ai-fallbacks/telemetryHelpers');
          const { AIEventType } = await import('@/features/ai-fallbacks/telemetry');
          await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
            event: 'onboarding_mood_save_failed',
            userId: uidForKey,
            moodScore: payload.first_mood.score,
            error: error instanceof Error ? error.message : String(error)
          });
        } catch {}
      }
    }

    // ✅ STEP 5: CRITICAL - Supabase Profile Sync + Offline Queue Insurance
    
    // 🛡️ PROACTIVE: Always add profile to offline queue first (insurance against network issues)
    try {
      const { offlineSyncService } = await import('@/services/offlineSync');
      await offlineSyncService.addToSyncQueue({
        type: 'CREATE',
        entity: 'user_profile',
        data: { payload, userId: uidForKey },
        priority: 'critical' as any,
      });
      console.log('🛡️ Profile data proactively queued for offline sync (insurance)');
    } catch (queueError) {
      console.error('❌ CRITICAL: Failed to queue profile for offline sync:', queueError);
      
      // 🚨 ENHANCED ERROR HANDLING: Track queue failure with user notification
      try {
        const { onboardingSyncErrorService } = await import('@/features/ai-fallbacks/onboardingSyncErrorService');
        await onboardingSyncErrorService.trackSyncError(
          uidForKey,
          'queue_failed',
          `Queue failed: ${queueError.message || 'Unknown error'}`,
          {
            showAlert: true,
            showNotification: true,
            immediate: true,
            delay: 10000 // Retry in 10 seconds
          }
        );
      } catch (trackingError) {
        console.error('Failed to track queue error:', trackingError);
      }
      
      result.criticalErrors.push('Profile queue failed - user will be notified and retry scheduled');
    }

    // 🚀 IMMEDIATE: Try direct Supabase sync (if online)
    try {
      await get().syncToSupabase(uidForKey);
      console.log('✅ Supabase profile sync completed');
      
      // 🎉 SUCCESS: Record successful sync timestamp
      await AsyncStorage.setItem('last_profile_sync', new Date().toISOString());
    } catch (error) {
      const errorMsg = 'Supabase profile sync failed (queued for retry)';
      console.warn('⚠️ WARNING:', errorMsg, error);
      
      // 🚨 ENHANCED ERROR HANDLING: Track Supabase failure with user notification
      try {
        const { onboardingSyncErrorService } = await import('@/features/ai-fallbacks/onboardingSyncErrorService');
        await onboardingSyncErrorService.trackSyncError(
          uidForKey,
          'supabase_failed', 
          `Supabase sync failed: ${error.message || 'Network or server error'}`,
          {
            showNotification: true, // Show notification, but not immediate alert (less disruptive)
            immediate: true,
            delay: 30000, // Retry in 30 seconds
            persistError: true
          }
        );
      } catch (trackingError) {
        console.error('Failed to track Supabase error:', trackingError);
      }
      
      // Profile is already in offline queue, so sync will happen when online
      result.warnings.push('Profile sync will complete when network is stable (you\'ll be notified)');
      console.log('📋 Profile will sync when network is available (already queued with error tracking)');
    }

    // ✅ STEP 6: NON-CRITICAL - Notification Scheduling (user can enable later)
    if (payload.reminders?.enabled && payload.reminders.time) {
      try {
        const [h, m] = (payload.reminders.time || '09:00').split(':').map(Number);
        const now = new Date();
        const scheduleAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 9, m || 0, 0);
        await NotificationScheduler.scheduleDailyMoodReminder(scheduleAt);
        console.log('✅ Daily reminder scheduled successfully');
      } catch (error) {
        const warningMsg = 'Notification scheduling failed (can be enabled later in settings)';
        result.warnings.push(warningMsg);
        console.warn('⚠️ WARNING:', warningMsg, error);
      }
    }

    // ✅ STEP 7: ENHANCED AI INTEGRATION - Merge Progressive Insights + Final Analysis
    try {
      console.log('🤖 Generating comprehensive AI profile from onboarding data...');
      
      // 1. Collect all progressive insights gathered during onboarding
      const progressiveInsights = await get().collectProgressiveInsights();
      console.log(`🔍 Collected ${Object.keys(progressiveInsights).length} progressive insight sets`);
      
      // 2. 🚀 ONBOARDING OPTIMIZED: Fast AI analysis with timeout & fallback
      console.log('⚡ Starting fast AI analysis for onboarding (8s timeout)...');
      let aiResult = null;
      
      try {
        // Race between AI processing and timeout
        const aiPromise = pipeline.unifiedPipeline.process({
          userId: uidForKey,
          content: {
            type: 'onboarding_completion',
            payload,
            duration: durationMs,
            completedAt: new Date().toISOString(),
            progressiveInsights // Include previously gathered insights
          },
          type: 'data',
          context: {
            source: 'today',
            timestamp: Date.now(),
            metadata: {
              isInitialProfile: true,
              generatePersonalization: true,
              enableInsights: true,
              enhancedAnalysis: true,
              progressiveDataAvailable: Object.keys(progressiveInsights).length > 0,
              onboardingMode: true, // Special flag for faster processing
              fastMode: true // Enable simplified analysis for onboarding
            }
          }
        });
        
        // 🏃‍♂️ FAST TIMEOUT: 8 seconds max for onboarding
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('ONBOARDING_AI_TIMEOUT: Analysis took too long, using fallback'));
          }, 8000);
        });
        
        // Race condition: whichever finishes first
        aiResult = await Promise.race([aiPromise, timeoutPromise]);
        console.log('✅ Fast AI analysis completed successfully!');
        
      } catch (aiError) {
        const isTimeout = aiError?.message?.includes('ONBOARDING_AI_TIMEOUT');
        console.warn(`⚡ AI analysis ${isTimeout ? 'timed out' : 'failed'}, switching to intelligent fallback...`);
        
        // 🔄 INTELLIGENT FALLBACK: Generate basic profile from onboarding data
        aiResult = get().generateFallbackProfile(payload, progressiveInsights, uidForKey);
        console.log('🛡️ Fallback profile generated successfully');
      }

      // 3. Create comprehensive AI profile merging all insights
      const insightsArray = Array.isArray(aiResult?.insights) ? aiResult.insights : [];
      const patternsArray = Array.isArray(aiResult?.patterns) ? aiResult.patterns : [];
      
      const comprehensiveProfile = {
        // Final analysis insights
        insights: insightsArray,
        patterns: patternsArray,
        
        // Progressive insights collected during onboarding
        baseline: {
          moodInsights: progressiveInsights.mood || [],
          motivationAnalysis: progressiveInsights.motivation || [],
          personalizedGoals: progressiveInsights.motivation?.personalizedGoals || []
        },
        
        // Profile metadata
        generatedAt: new Date().toISOString(),
        source: 'onboarding_completion_enhanced',
        profileVersion: '2.0',
        dataPoints: {
          motivations: payload.motivation?.length || 0,
          firstMoodScore: payload.first_mood?.score,
          lifestyleData: !!payload.lifestyle,
          remindersEnabled: payload.reminders?.enabled || false
        }
      };

      // 4. Cache comprehensive profile for immediate use
      await AsyncStorage.setItem(
        `ai_profile_${uidForKey}`,
        JSON.stringify(comprehensiveProfile)
      );
      
      // 5. Also cache as initial insights for Today page
      if (comprehensiveProfile.insights.length > 0) {
        await AsyncStorage.setItem(
          `initial_insights_${uidForKey}`,
          JSON.stringify({
            insights: comprehensiveProfile.insights,
            fromOnboarding: true,
            generatedAt: new Date().toISOString()
          })
        );
      }
      
      console.log('✅ Comprehensive AI profile generated and cached');
      console.log(`📊 Profile stats: ${insightsArray.length} insights, ${patternsArray.length} patterns`);

      // 6. Clean up temporary progressive caches
      await get().cleanupProgressiveCache();

    } catch (error) {
      const warningMsg = 'AI profile generation failed (non-critical)';
      result.warnings.push(warningMsg);
      console.warn('⚠️ WARNING:', warningMsg, error);
    }

    // ✅ STEP 8: NON-CRITICAL - Analytics Tracking (important but not blocking)
    try {
      const { safeTrackAIInteraction } = await import('@/features/ai-fallbacks/telemetryHelpers');
      await safeTrackAIInteraction(AIEventType.ONBOARDING_COMPLETED, {
        userId: uidForKey,
        durationMs,
        steps: get().step + 1,
        motivations: payload.motivation,
        hasReminder: !!payload.reminders?.enabled,
        criticalErrorCount: result.criticalErrors.length,
        warningCount: result.warnings.length,
        success: result.success
      });
      console.log('✅ Completion analytics tracked');
    } catch (error) {
      const warningMsg = 'Analytics tracking failed (telemetry issue)';
      result.warnings.push(warningMsg);
      console.warn('⚠️ WARNING:', warningMsg, error);
    }

    // ✅ FINAL: Determine overall success
    if (result.criticalErrors.length > 0) {
      result.success = false;
      console.error(`❌ Onboarding completion had ${result.criticalErrors.length} critical errors`);
      console.error('🚫 Completion flags NOT set due to critical errors - user can retry onboarding');
    } else {
      console.log(`✅ Onboarding completion successful! ${result.warnings.length} warnings (non-critical)`);
      
      // 🎉 SUCCESS: Now safe to set completion flags after all critical operations succeeded
      try {
        await AsyncStorage.setItem('ai_onboarding_completed', 'true');
        await AsyncStorage.setItem('ai_onboarding_completed_at', new Date().toISOString());
        await AsyncStorage.setItem(`ai_onboarding_completed_${uidForKey}`, 'true');
        console.log('🎯 Completion flags set successfully - user can now access main app');
      } catch (flagError) {
        console.error('❌ Failed to set completion flags:', flagError);
        // This is bad but not critical enough to fail the whole onboarding
        result.warnings.push('Completion flags failed to set - may need manual intervention');
      }
    }

    return result;
  },

  // =============================================================================
  // 🔄 OFFLINE-SAFE AI ANALYSIS METHODS
  // =============================================================================

  /**
   * 🤖 Analyze motivation patterns with robust offline fallback
   * Ensures onboarding never hangs on AI failures
   */
  analyzeMotivationWithFallback: async (motivations: MotivationKey[]) => {
    if (!motivations || motivations.length === 0) return;

    console.log('🎯 Progressive AI: Analyzing motivation patterns with offline fallback...');
    
    let analysisResult = null;
    let usedFallback = false;

    try {
      // 🌐 Network check: Skip AI if offline
      let isOnline = true;
      try {
        const NetInfo = require('@react-native-community/netinfo').default;
        const netState = await NetInfo.fetch();
        isOnline = netState.isConnected && netState.isInternetReachable !== false;
      } catch {
        isOnline = false;
      }

      if (!isOnline) {
        console.log('📴 Offline detected - using motivation fallback immediately');
        usedFallback = true;
      } else {
        // ⏱️ Online: Try AI with timeout protection
        const AI_TIMEOUT = 8000; // 8 seconds max
        
        const aiPromise = pipeline.unifiedPipeline.process({
          userId: 'temp_onboarding',
          content: {
            type: 'onboarding_motivation',
            motivations,
            context: 'user_goals_analysis'
          },
          type: 'data',
          context: {
            source: 'today',
            metadata: {
              isOnboardingStep: true,
              progressiveAnalysis: true,
              step: 'motivation',
              fastMode: true // Request fast processing
            }
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT)
        );

        analysisResult = await Promise.race([aiPromise, timeoutPromise]);
        console.log('✅ AI motivation analysis completed successfully');
      }

    } catch (error) {
      usedFallback = true;
      const errorType = error instanceof Error ? error.message : 'unknown';
      console.warn(`⚠️ AI motivation analysis failed (${errorType}) - using fallback`);
    }

    // 🎯 Generate insights (AI or fallback)
    let insights;
    if (analysisResult && !usedFallback) {
      // Use AI results
      insights = {
        insights: analysisResult.insights || [],
        patterns: analysisResult.patterns || [],
        personalizedGoals: (analysisResult as any).personalizedGoals || [],
        generatedAt: new Date().toISOString(),
        source: 'ai_analysis'
      };
    } else {
      // Generate intelligent fallback based on motivation patterns
      insights = get().generateMotivationFallback(motivations);
    }

    // 💾 Cache insights for completion phase
    try {
      await AsyncStorage.setItem('onboarding_motivation_insights', JSON.stringify(insights));
      console.log(`✅ Motivation insights cached (${insights.source})`);
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache motivation insights (non-blocking):', cacheError);
    }
  },

  /**
   * 🤖 Analyze first mood with robust offline fallback
   */
  analyzeFirstMoodWithFallback: async (score?: 1|2|3|4|5, tags?: string[]) => {
    if (!score) return;

    console.log('🎯 Progressive AI: Analyzing first mood with offline fallback...');
    
    let analysisResult = null;
    let usedFallback = false;

    try {
      // 🌐 Network check
      let isOnline = true;
      try {
        const NetInfo = require('@react-native-community/netinfo').default;
        const netState = await NetInfo.fetch();
        isOnline = netState.isConnected && netState.isInternetReachable !== false;
      } catch {
        isOnline = false;
      }

      if (!isOnline) {
        console.log('📴 Offline detected - using mood fallback immediately');
        usedFallback = true;
      } else {
        // ⏱️ Try AI with timeout
        const AI_TIMEOUT = 6000; // 6 seconds max for mood analysis
        
        const aiPromise = pipeline.unifiedPipeline.process({
          userId: 'temp_onboarding',
          content: {
            type: 'onboarding_first_mood',
            mood_score: score * 20, // 1-5 → 20-100 mapping
            tags: tags || [],
            context: 'initial_baseline'
          },
          type: 'data',
          context: {
            source: 'today',
            metadata: {
              isOnboardingStep: true,
              progressiveAnalysis: true,
              step: 'first_mood',
              fastMode: true
            }
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT)
        );

        analysisResult = await Promise.race([aiPromise, timeoutPromise]);
        console.log('✅ AI first mood analysis completed successfully');
      }

    } catch (error) {
      usedFallback = true;
      const errorType = error instanceof Error ? error.message : 'unknown';
      console.warn(`⚠️ AI first mood analysis failed (${errorType}) - using fallback`);
    }

    // 🎯 Generate insights (AI or fallback)
    let insights;
    if (analysisResult && !usedFallback) {
      // Use AI results
      insights = {
        insights: analysisResult.insights || [],
        generatedAt: new Date().toISOString(),
        source: 'ai_analysis'
      };
    } else {
      // Generate intelligent fallback based on mood score
      insights = get().generateMoodFallback(score, tags);
    }

    // 💾 Cache insights
    try {
      await AsyncStorage.setItem('onboarding_mood_insights', JSON.stringify(insights));
      console.log(`✅ First mood insights cached (${insights.source})`);
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache mood insights (non-blocking):', cacheError);
    }
  },

  /**
   * 🧠 Generate intelligent motivation fallback when AI is unavailable
   */
  generateMotivationFallback: (motivations: MotivationKey[]) => {
    console.log('🧠 Generating intelligent motivation fallback...');

    // Map motivations to actionable insights
    const motivationInsights: Record<string, any> = {
      'reduce_symptoms': {
        goal: 'Semptom azaltma odaklı yaklaşım',
        techniques: ['Progressive muscle relaxation', 'Mindful breathing', 'ERP exercises'],
        personalizedTip: 'Küçük adımlarla başla - her gün biraz daha fazla meydan oku'
      },
      'improve_relationships': {
        goal: 'İlişkileri güçlendirme',
        techniques: ['Communication skills', 'Boundary setting', 'Social exposure'],
        personalizedTip: 'İlişkilerinde açık ve net iletişim kurmaya odaklan'
      },
      'work_productivity': {
        goal: 'İş hayatında verimlilik',
        techniques: ['Time management', 'Priority setting', 'Workplace accommodations'],
        personalizedTip: 'Önceliklerini belirle ve küçük görevlere böl'
      },
      'emotional_regulation': {
        goal: 'Duygu düzenleme becerisi',
        techniques: ['CBT techniques', 'Emotion tracking', 'Coping strategies'],
        personalizedTip: 'Duygularını gözlemle ve yargılamadan kabul et'
      },
      'self_confidence': {
        goal: 'Özgüven artırma',
        techniques: ['Achievement tracking', 'Positive affirmations', 'Skill building'],
        personalizedTip: 'Küçük başarılarını kutla ve kaydını tut'
      }
    };

    const matchedInsights = motivations
      .map(m => motivationInsights[m])
      .filter(Boolean);

    return {
      insights: matchedInsights.map(insight => ({
        type: 'motivation_analysis',
        title: insight.goal,
        description: insight.personalizedTip,
        actionable: true,
        confidence: 0.8
      })),
      patterns: [{
        type: 'goal_pattern',
        title: `${motivations.length} temel motivasyon alanı tespit edildi`,
        description: 'Çok yönlü iyileşme yaklaşımı öneriliyor',
        actionable: true
      }],
      personalizedGoals: matchedInsights.map(insight => insight.goal),
      generatedAt: new Date().toISOString(),
      source: 'intelligent_fallback'
    };
  },

  /**
   * 🧠 Generate intelligent mood fallback when AI is unavailable
   */
  generateMoodFallback: (score: 1|2|3|4|5, tags?: string[]) => {
    console.log('🧠 Generating intelligent mood fallback...');

    // Mood-based insights
    const moodInsights: Record<number, any> = {
      1: {
        level: 'Çok Düşük',
        focus: 'Temel ihtiyaçlar ve güvenlik',
        suggestion: 'Önce kendini güvende hisset, küçük self-care aktivitelerine odaklan',
        priority: 'high'
      },
      2: {
        level: 'Düşük',
        focus: 'Duygusal destek ve stabil rutinler',
        suggestion: 'Günlük rutinlerini basitleştir ve destek sistemini güçlendir',
        priority: 'high'
      },
      3: {
        level: 'Orta',
        focus: 'Denge ve yapılandırılmış iyileşme',
        suggestion: 'Tedavi teknikleri ve kademeli ilerleme planı uygulamaya başla',
        priority: 'medium'
      },
      4: {
        level: 'İyi',
        focus: 'Beceri geliştirme ve ilerleme',
        suggestion: 'Mevcut başarılarını koruyarak yeni teknikleri dene',
        priority: 'medium'
      },
      5: {
        level: 'Çok İyi',
        focus: 'Sürdürülebilirlik ve uzun vadeli planlama',
        suggestion: 'Bu pozitif durumu koruyacak stratejiler geliştir',
        priority: 'low'
      }
    };

    const moodAnalysis = moodInsights[score];

    return {
      insights: [{
        type: 'mood_baseline',
        title: `Başlangıç ruh hali: ${moodAnalysis.level}`,
        description: moodAnalysis.suggestion,
        actionable: true,
        confidence: 0.85,
        priority: moodAnalysis.priority
      }],
      generatedAt: new Date().toISOString(),
      source: 'intelligent_fallback'
    };
  }

}));


