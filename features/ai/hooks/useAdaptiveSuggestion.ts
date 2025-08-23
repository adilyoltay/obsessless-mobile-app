/**
 * 🎯 useAdaptiveSuggestion Hook
 * 
 * JITAI/Adaptive Interventions için minimal tetik kancası.
 * Privacy-first, flag-kontrollü, cooldown'lu adaptif öneriler.
 * 
 * Features:
 * - 4 saatlik cooldown
 * - Quiet hours (22:00-08:00) saygısı
 * - Flag-based feature control
 * - Minimal context generation
 * - Non-blocking error handling
 */

import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '../telemetry/aiTelemetry';

// Types
interface AdaptiveSuggestion {
  show: boolean;
  title?: string;
  content?: string;
  cta?: {
    screen: string;
    params?: any;
  };
  confidence?: number;
  category?: 'breathwork' | 'cbt' | 'mood' | 'tracking';
}

interface MinimalContext {
  userId: string;
  timestamp: number;
  currentContext: {
    userState: {
      stressLevel: 'low' | 'moderate' | 'high';
      activityState: 'unknown' | 'active' | 'resting';
      energyLevel: number; // 1-100
    };
  };
  recentActivity?: {
    compulsionCount?: number;
    moodEntries?: number;
    breathworkSessions?: number;
    cbtRecords?: number;
  };
}

// Constants
const COOLDOWN_HOURS = 4;
const SNOOZE_HOURS = 2;
const QUIET_START_HOUR = 22; // 22:00
const QUIET_END_HOUR = 8;    // 08:00

export function useAdaptiveSuggestion() {
  const [loading, setLoading] = useState(false);

  /**
   * 🕐 Check if current time is within quiet hours
   */
  const isQuietHours = (): boolean => {
    const now = new Date();
    const hour = now.getHours();
    
    // 22:00-08:00 quiet period
    return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
  };

  /**
   * 📊 Build minimal context for JITAI/Adaptive systems
   */
  const buildMinimalContext = async (userId: string): Promise<MinimalContext> => {
    const context: MinimalContext = {
      userId,
      timestamp: Date.now(),
      currentContext: {
        userState: {
          stressLevel: 'moderate', // Default moderate
          activityState: 'unknown',
          energyLevel: 50 // Default neutral
        }
      }
    };

    try {
      // Minimal recent activity data (last 3 days for privacy)
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      
      // Get basic counts without PII
      const { StorageKeys } = await import('@/utils/storage');
      
      // Compulsions count
      try {
        const compulsionsKey = StorageKeys.COMPULSIONS(userId);
        const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
        if (compulsionsData) {
          const compulsions = JSON.parse(compulsionsData);
          const recentCompulsions = compulsions.filter((c: any) => 
            c.timestamp >= threeDaysAgo
          );
          context.recentActivity = context.recentActivity || {};
          context.recentActivity.compulsionCount = recentCompulsions.length;
          
          // Infer stress level from recent activity
          if (recentCompulsions.length > 10) {
            context.currentContext.userState.stressLevel = 'high';
            context.currentContext.userState.energyLevel = 30;
          } else if (recentCompulsions.length > 5) {
            context.currentContext.userState.stressLevel = 'moderate';
            context.currentContext.userState.energyLevel = 50;
          } else {
            context.currentContext.userState.stressLevel = 'low';
            context.currentContext.userState.energyLevel = 70;
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to get compulsions data for context:', error);
      }

      // CBT records count
      try {
        const thoughtRecordsKey = StorageKeys.THOUGHT_RECORDS(userId);
        const cbtData = await AsyncStorage.getItem(thoughtRecordsKey);
        if (cbtData) {
          const records = JSON.parse(cbtData);
          const recentRecords = records.filter((r: any) => 
            r.timestamp >= threeDaysAgo
          );
          context.recentActivity = context.recentActivity || {};
          context.recentActivity.cbtRecords = recentRecords.length;
        }
      } catch (error) {
        console.warn('⚠️ Failed to get CBT data for context:', error);
      }

      // Mood entries count
      try {
        const moodTracker = (await import('@/services/moodTrackingService')).default;
        const moodEntries = await moodTracker.getMoodEntries(userId, 3); // 3 days
        context.recentActivity = context.recentActivity || {};
        context.recentActivity.moodEntries = moodEntries.length;
      } catch (error) {
        console.warn('⚠️ Failed to get mood data for context:', error);
      }

      // Breathwork sessions count  
      try {
        const breathworkKey = StorageKeys.BREATH_SESSIONS(userId);
        const breathworkData = await AsyncStorage.getItem(breathworkKey);
        if (breathworkData) {
          const sessions = JSON.parse(breathworkData);
          const recentSessions = sessions.filter((s: any) => 
            s.timestamp >= threeDaysAgo
          );
          context.recentActivity = context.recentActivity || {};
          context.recentActivity.breathworkSessions = recentSessions.length;
        }
      } catch (error) {
        console.warn('⚠️ Failed to get breathwork data for context:', error);
      }

    } catch (error) {
      console.warn('⚠️ Error building minimal context, using defaults:', error);
    }

    return context;
  };

  /**
   * 🎯 Generate adaptive suggestion
   */
  const generateSuggestion = useCallback(async (userId: string): Promise<AdaptiveSuggestion> => {
    // 1. Flag checks - fail fast if any required flag is disabled
    if (!FEATURE_FLAGS.isEnabled('AI_JITAI_SYSTEM') || 
        !FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS')) {
      console.log('🚫 Adaptive suggestions disabled by feature flags');
      return { show: false };
    }

    try {
      setLoading(true);

      // 2. Snooze check
      const snoozeKey = `adaptive_suggestion_snooze_until_${userId}`;
      const snoozeUntil = await AsyncStorage.getItem(snoozeKey);
      if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) {
        console.log('😴 Adaptive suggestion snoozed');
        return { show: false };
      }

      // 3. Cooldown check
      const cooldownKey = `adaptive_suggestion_last_${userId}`;
      const lastSuggested = await AsyncStorage.getItem(cooldownKey);
      if (lastSuggested) {
        const timeSinceLastSuggestion = Date.now() - parseInt(lastSuggested);
        const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
        
        if (timeSinceLastSuggestion < cooldownMs) {
          const hoursLeft = Math.ceil((cooldownMs - timeSinceLastSuggestion) / (60 * 60 * 1000));
          console.log(`⏰ Adaptive suggestion cooldown: ${hoursLeft}h remaining`);
          return { show: false };
        }
      }

      // 4. Quiet hours check
      if (isQuietHours()) {
        console.log('🌙 Quiet hours - no adaptive suggestions');
        return { show: false };
      }

      // 5. Build minimal context
      const context = await buildMinimalContext(userId);
      console.log('📊 Built minimal context for adaptive suggestion:', {
        stressLevel: context.currentContext.userState.stressLevel,
        energyLevel: context.currentContext.userState.energyLevel,
        recentActivity: context.recentActivity
      });

      // 6. JITAI timing prediction
      let timing: any = null;
      let confidence = 0;

      try {
        const { jitaiEngine } = await import('../jitai/jitaiEngine');
        timing = await jitaiEngine.predictOptimalTiming(context);
        confidence = timing?.confidence || 0;
        
        console.log('🎯 JITAI timing prediction:', { confidence, timing });
        
        if (confidence < 0.5) {
          console.log('📉 JITAI confidence too low, skipping suggestion');
          return { show: false };
        }
      } catch (error) {
        console.warn('⚠️ JITAI timing prediction failed:', error);
        // Continue with default confidence
        confidence = 0.6; // Default moderate confidence
      }

      // 7. Adaptive intervention trigger
      let suggestion: any = null;
      
      try {
        const adaptiveInterventions = (await import('../interventions/adaptiveInterventions')).default;
        
        // Build intervention context
        const interventionContext = {
          userId,
          userProfile: {}, // Minimal profile
          currentContext: {
            analysisId: `adaptive_${Date.now()}`,
            riskAssessment: {
              overallRisk: context.currentContext.userState.stressLevel,
              riskFactors: [],
              protectiveFactors: [],
              interventionUrgency: context.currentContext.userState.stressLevel === 'high' ? 'medium' : 'low'
            },
            userState: context.currentContext.userState,
            environmentalFactors: [],
            insights: { patterns: [] }
          },
          userConfig: adaptiveInterventions.getDefaultConfig(),
          recentInterventions: [],
          recentUserActivity: {
            lastAppUsage: new Date(),
            sessionDuration: 0
          },
          deviceState: {
            batteryLevel: 1,
            isCharging: false,
            networkConnected: true,
            inFocus: true
          }
        };

        suggestion = await adaptiveInterventions.triggerContextualIntervention(interventionContext);
        console.log('💡 Adaptive intervention generated:', suggestion);

      } catch (error) {
        console.warn('⚠️ Adaptive intervention failed:', error);
        // Generate fallback suggestion based on context
        suggestion = generateFallbackSuggestion(context);
      }

      // 8. Process and return suggestion
      if (suggestion && suggestion.show) {
        // Update last suggested timestamp
        await AsyncStorage.setItem(cooldownKey, Date.now().toString());
        
        // Track suggestion shown
        await trackAIInteraction(AIEventType.ADAPTIVE_SUGGESTION_SHOWN, {
          userId,
          category: suggestion.category || 'general',
          confidence,
          delivery: 'inline_card',
          stressLevel: context.currentContext.userState.stressLevel,
          energyLevel: context.currentContext.userState.energyLevel
        });

        return {
          show: true,
          title: suggestion.title,
          content: suggestion.content,
          cta: suggestion.cta,
          confidence,
          category: suggestion.category
        };
      }

      return { show: false };

    } catch (error) {
      console.error('❌ Adaptive suggestion generation failed:', error);
      return { show: false };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 🛠️ Generate fallback suggestion based on context
   */
  const generateFallbackSuggestion = (context: MinimalContext): any => {
    const { recentActivity, currentContext } = context;
    
    // High stress → breathwork
    if (currentContext.userState.stressLevel === 'high') {
      return {
        show: true,
        title: "Nefes Al",
        content: "Stres seviyeniz yüksek görünüyor. 5 dakikalık nefes egzersizi yapmak ister misiniz?",
        category: 'breathwork',
        cta: {
          screen: '/(tabs)/breathwork',
          params: { autoStart: true, protocol: 'box' }
        }
      };
    }

    // Low activity → mood check
    if (!recentActivity || (recentActivity.moodEntries || 0) === 0) {
      return {
        show: true,
        title: "Nasıl Hissediyorsun?",
        content: "Bugün nasıl hissettiğinizi kaydetmek ister misiniz?",
        category: 'mood',
        cta: {
          screen: '/(tabs)/mood'
        }
      };
    }

    // High compulsions, low CBT → CBT suggestion
    if ((recentActivity?.compulsionCount || 0) > 5 && (recentActivity?.cbtRecords || 0) === 0) {
      return {
        show: true,
        title: "Düşünce Kaydı",
        content: "Son günlerde biraz zorlanıyor gibisiniz. Düşüncelerinizi kaydetmek yardımcı olabilir.",
        category: 'cbt',
        cta: {
          screen: '/(tabs)/cbt'
        }
      };
    }

    return { show: false };
  };

  /**
   * 😴 Snooze suggestion for specified hours
   */
  const snoozeSuggestion = useCallback(async (userId: string, hours: number = SNOOZE_HOURS): Promise<void> => {
    try {
      const snoozeKey = `adaptive_suggestion_snooze_until_${userId}`;
      const snoozeUntil = Date.now() + (hours * 60 * 60 * 1000);
      await AsyncStorage.setItem(snoozeKey, snoozeUntil.toString());
      
      // Track dismissal
      await trackAIInteraction(AIEventType.ADAPTIVE_SUGGESTION_DISMISSED, {
        userId,
        snoozeHours: hours
      });
      
      console.log(`😴 Adaptive suggestion snoozed for ${hours} hours`);
    } catch (error) {
      console.error('❌ Failed to snooze adaptive suggestion:', error);
    }
  }, []);

  return {
    generateSuggestion,
    snoozeSuggestion,
    loading,
    isQuietHours
  };
}

export type { AdaptiveSuggestion };
