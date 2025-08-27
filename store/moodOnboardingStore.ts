import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deriveFeatureFlags, applyReminderRule } from '@/features/onboarding/lib/deriveFeatureFlags';
import type { OnboardingPayload, MotivationKey } from '@/features/onboarding/types';
import moodTracker from '@/services/moodTrackingService';
import { isUUID } from '@/utils/validators';
import supabaseService from '@/services/supabase';
import { NotificationScheduler } from '@/services/notificationScheduler';
// ✅ NEW: AI integration for onboarding data
import * as pipeline from '@/features/ai/pipeline';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

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
    
    // 🤖 Progressive AI Analysis: Analyze motivations for personalization
    setTimeout(async () => {
      try {
        if (m && m.length > 0 && typeof window !== 'undefined') {
          console.log('🎯 Progressive AI: Analyzing motivation patterns...');
          
          const aiResult = await pipeline.unifiedPipeline.process({
            userId: 'temp_onboarding',
            content: {
              type: 'onboarding_motivation',
              motivations: m,
              context: 'user_goals_analysis'
            },
            type: 'data',
            context: {
              source: 'today',
              metadata: {
                isOnboardingStep: true,
                progressiveAnalysis: true,
                step: 'motivation'
              }
            }
          });
          
          // Cache motivation insights
          if (aiResult?.insights || aiResult?.patterns) {
            await AsyncStorage.setItem('onboarding_motivation_insights', JSON.stringify({
              insights: aiResult.insights || [],
              patterns: aiResult.patterns || [],
              personalizedGoals: (aiResult as any).personalizedGoals || [],
              generatedAt: new Date().toISOString()
            }));
            console.log('✅ Progressive AI: Motivation insights cached');
          }
        }
      } catch (error) {
        console.warn('⚠️ Progressive AI motivation analysis failed (non-blocking):', error);
      }
    }, 700);
  },
  
  setFirstMood: (score, tags) => {
    set((st) => ({ payload: { ...st.payload, first_mood: { score, tags, source: 'onboarding' } } }));
    // Auto-persist on change
    setTimeout(() => get().persistToStorage(), 100);
    
    // 🤖 Progressive AI Analysis: Generate baseline mood insights
    setTimeout(async () => {
      try {
        const { payload } = get();
        if (score && typeof window !== 'undefined') {
          console.log('🎯 Progressive AI: Analyzing first mood data...');
          
          const aiResult = await pipeline.unifiedPipeline.process({
            userId: 'temp_onboarding', // Will be updated with real userId on completion
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
                step: 'first_mood'
              }
            }
          });
          
          // Cache early insights for completion phase
          if (aiResult?.insights) {
            await AsyncStorage.setItem('onboarding_mood_insights', JSON.stringify({
              insights: aiResult.insights,
              generatedAt: new Date().toISOString()
            }));
            console.log('✅ Progressive AI: First mood insights cached');
          }
        }
      } catch (error) {
        console.warn('⚠️ Progressive AI analysis failed (non-blocking):', error);
      }
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
          energy_level: 50, // Default neutral energy
          anxiety_level: 50, // Default neutral anxiety  
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
          const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
          const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
            event: 'onboarding_mood_save_failed',
            userId: uidForKey,
            moodScore: payload.first_mood.score,
            error: error instanceof Error ? error.message : String(error)
          });
        } catch {}
      }
    }

    // ✅ STEP 5: CRITICAL - Supabase Profile Sync (essential for remote data)
    try {
      await get().syncToSupabase(uidForKey);
      console.log('✅ Supabase profile sync completed');
    } catch (error) {
      const errorMsg = 'Supabase profile sync failed';
      result.criticalErrors.push(errorMsg);
      console.error('❌ CRITICAL:', errorMsg, error);
      
      // Attempt offline queue fallback for critical profile data
      try {
        const { offlineSyncService } = await import('@/services/offlineSync');
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'user_profile',
          data: { payload, userId: uidForKey },
          priority: 'critical' as any,
        });
        console.log('🔄 Profile data queued for offline sync as fallback');
        result.warnings.push('Profile synced via offline queue (delayed)');
      } catch (queueError) {
        console.error('❌ Even offline queue failed:', queueError);
      }
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
      
      // 2. Run final comprehensive analysis with all data
      const aiResult = await pipeline.unifiedPipeline.process({
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
            progressiveDataAvailable: Object.keys(progressiveInsights).length > 0
          }
        }
      });

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
      const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
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
  }
}));


