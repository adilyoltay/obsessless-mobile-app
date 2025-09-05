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
import { adaptiveSuggestionAnalytics } from '../analytics/adaptiveSuggestionAnalytics';
import { circadianTimingEngine, TimingRecommendation } from '../timing/circadianTimingEngine';
import { abTestingFramework, ABTestVariant } from '../testing/abTestingFramework';
import type { UnifiedPipelineResult } from '../core/UnifiedAIPipeline';

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
  category?: 'breathwork' | 'mood';
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

// Default Constants (overridden by A/B tests)
const DEFAULT_COOLDOWN_HOURS = __DEV__ ? 0.1 : 4; // 6 minutes in dev, 4 hours in production
const DEFAULT_SNOOZE_HOURS = __DEV__ ? 0.05 : 2;  // 3 minutes in dev, 2 hours in production

// 🔧 DEV MODE: Auto-clear cooldown on hook init for testing
if (__DEV__) {
  AsyncStorage.removeItem('adaptive_suggestion_last_a477080d-4d3f-4edc-9c31-4a1076c0967b').catch(() => {});
  console.log('🔧 DEV: Auto-cleared adaptive suggestion cooldown for testing');
}
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
      
      // Compulsion/CBT data removed

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
   * 📊 Build complete ContextAnalysisResult for AI engines
   */
  const buildContextAnalysisResult = (userId: string, minimalContext: MinimalContext): any => {
    return {
      userId,
      timestamp: new Date(),
      analysisId: `context_${Date.now()}`,
      environmentalFactors: [
        {
          factor: 'TIME_OF_DAY',
          value: new Date().getHours(),
          confidence: 0.9,
          source: 'device'
        }
      ],
      userState: {
        ...minimalContext.currentContext.userState,
        activityState: minimalContext.currentContext.userState.activityState,
        stressLevel: minimalContext.currentContext.userState.stressLevel,
        moodIndicator: 'neutral' as const,
        socialEngagement: 50
      },
      riskAssessment: {
        overallRisk: minimalContext.currentContext.userState.stressLevel,
        riskFactors: [],
        protectiveFactors: [],
        interventionUrgency: minimalContext.currentContext.userState.stressLevel === 'high' ? 'medium' : 'low'
      },
      insights: { 
        keyObservations: [],
        patterns: [], 
        recommendations: [],
        predictedNeeds: []
      },
      privacyLevel: 'minimal' as const,
      dataQuality: 0.8,
      sources: ['device', 'user_activity']
    };
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

    // 🧪 Get A/B test assignment and parameters
    let testParameters: ABTestVariant['parameters'] | null = null;
    let testId: string | null = null;
    try {
      const testAssignment = await abTestingFramework.getUserTestAssignment(userId);
      testParameters = testAssignment.parameters;
      testId = testAssignment.testId;
      
      if (testId && testParameters) {
        console.log(`🧪 User in A/B test: ${testId}`, testParameters);
      }
    } catch (error) {
      console.warn('⚠️ Failed to get A/B test assignment:', error);
    }

    // Use test parameters or defaults
    const cooldownHours = testParameters?.cooldownHours || DEFAULT_COOLDOWN_HOURS;
    const snoozeHours = testParameters?.snoozeHours || DEFAULT_SNOOZE_HOURS;
    const respectCircadianTiming = testParameters?.respectCircadianTiming ?? true;
    const minimumTimingScore = testParameters?.minimumTimingScore ?? 30;

    try {
      setLoading(true);

      // 2. Snooze check
      const snoozeKey = `adaptive_suggestion_snooze_until_${userId}`;
      const snoozeUntil = await AsyncStorage.getItem(snoozeKey);
      if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) {
        console.log('😴 Adaptive suggestion snoozed');
        return { show: false };
      }

      // 3. Cooldown check (using A/B test parameters)
      const cooldownKey = `adaptive_suggestion_last_${userId}`;
      const lastSuggested = await AsyncStorage.getItem(cooldownKey);
      if (lastSuggested) {
        const timeSinceLastSuggestion = Date.now() - parseInt(lastSuggested);
        const cooldownMs = cooldownHours * 60 * 60 * 1000;
        
        if (timeSinceLastSuggestion < cooldownMs) {
          const hoursLeft = Math.ceil((cooldownMs - timeSinceLastSuggestion) / (60 * 60 * 1000));
          console.log(`⏰ Adaptive suggestion cooldown: ${hoursLeft}h remaining (A/B test: ${cooldownHours}h)`);
          if (__DEV__) {
            console.log(`🔧 DEV MODE: To clear cooldown, run in console: AsyncStorage.removeItem('${cooldownKey}')`);
          }
          return { show: false };
        }
      }

      // 4. Quiet hours check
      if (isQuietHours()) {
        console.log('🌙 Quiet hours - no adaptive suggestions');
        return { show: false };
      }

      // 4.5. 🕐 Smart Timing Check (A/B test controlled)
      let timingRecommendation: TimingRecommendation | null = null;
      if (respectCircadianTiming) {
        try {
          timingRecommendation = await circadianTimingEngine.getTimingRecommendation(userId);
          
          if (timingRecommendation.score < minimumTimingScore) {
            console.log(`⏰ Poor timing score: ${timingRecommendation.score}/100 (min: ${minimumTimingScore}) - ${timingRecommendation.rationale}`);
            
            // Show alternatives if available
            if (timingRecommendation.alternatives && timingRecommendation.alternatives.length > 0) {
              const bestAlternative = timingRecommendation.alternatives[0];
              console.log(`💡 Better timing available at ${bestAlternative.hour}:00 (score: ${bestAlternative.score})`);
            }
            
            return { show: false };
          }
          
          console.log(`⏰ Good timing: ${timingRecommendation.score}/100 - ${timingRecommendation.rationale}`);
        } catch (error) {
          console.warn('⚠️ Circadian timing check failed:', error);
          // Continue without timing optimization
        }
      } else {
        console.log('⏰ Circadian timing disabled by A/B test - proceeding without timing check');
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
        
        // Build complete JITAI context
        const jitaiContext = {
          userId,
          userProfile: {
            preferredLanguage: 'tr',
            symptomSeverity: context.currentContext.userState.stressLevel === 'high' ? 7 : 
                           context.currentContext.userState.stressLevel === 'low' ? 3 : 5,
            communicationStyle: 'encouraging' as any,
            triggerWords: [],
            avoidanceTopics: [],
            therapeuticGoals: [],
            preferredCBTTechniques: [],
            riskFactors: [],
            culturalContext: 'turkish'
          },
          currentContext: buildContextAnalysisResult(userId, context),
          interventionHistory: [],
          currentUserState: {
            isAppActive: true,
            lastInteraction: new Date(),
            recentMood: 'neutral',
            energyLevel: context.currentContext.userState.energyLevel,
            stressPattern: [context.currentContext.userState.stressLevel as any]
          },
          personalizationProfile: {
            preferredTimes: ['09:00', '14:00', '19:00'],
            responsiveStates: ['ACTIVE', 'RESTING'] as any[], // UserActivityState enum values
            effectiveCategories: ['breathwork', 'cbt'] as any[],
            culturalPreferences: { language: 'tr' },
            communicationStyle: 'encouraging' as const
          }
        };
        
        timing = await jitaiEngine.predictOptimalTiming(jitaiContext);
        confidence = timing?.optimalTiming?.confidence || 0;
        
        console.log('🎯 JITAI timing prediction:', { confidence });
        
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
        
        // Build complete intervention context
        const interventionContext = {
          userId,
          userProfile: {
            preferredLanguage: 'tr',
            symptomSeverity: context.currentContext.userState.stressLevel === 'high' ? 7 : 
                           context.currentContext.userState.stressLevel === 'low' ? 3 : 5,
            communicationStyle: 'encouraging' as any,
            triggerWords: [],
            avoidanceTopics: [],
            therapeuticGoals: [],
            preferredCBTTechniques: [],
            riskFactors: [],
            culturalContext: 'turkish'
          },
          currentContext: buildContextAnalysisResult(userId, context),
          userConfig: {
            enabled: true,
            userAutonomyLevel: 'high' as const,
            maxInterventionsPerHour: 2,
            maxInterventionsPerDay: 6,
            respectQuietHours: true,
            quietHours: {
              start: "22:00",
              end: "08:00"
            },
            preferredDeliveryMethods: [],
            allowInAppInterruptions: true,
            allowNotifications: false, // Only in-app for now
            enableHapticFeedback: true,
            adaptToUserFeedback: true,
            learnFromEffectiveness: true,
            culturalAdaptation: true,
            crisisOverride: true,
            emergencyContacts: [],
            escalationProtocol: true
          },
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
        // Generate fallback suggestion with enhanced breathwork logic
        suggestion = await generateEnhancedFallbackSuggestion(userId, context);
      }

      // 🔧 DEV MODE: Force suggestion for Quality Ribbon testing if no suggestion generated
      if (__DEV__ && (!suggestion || !suggestion.show)) {
        console.log('🔧 DEV: No suggestion generated, forcing one for Quality Ribbon test');
        suggestion = {
          show: true,
          id: `dev_test_${Date.now()}`,
          title: '🎯 Debug: Quality Ribbon Test',
          content: 'Bu Development modda Quality Ribbon görünümünü test etmek için otomatik oluşturulan bir önerdir.',
          category: 'mood',
          confidence: 0.85,
          priority: 'medium',
          timing: 'optimal',
          cta: {
            label: 'Teste Devam Et',
            screen: '/(tabs)/index',
            params: {}
          }
        };
      }

      // 8. Process and return suggestion
      if (suggestion && suggestion.show) {
        // Update last suggested timestamp
        await AsyncStorage.setItem(cooldownKey, Date.now().toString());
        
        // Track suggestion shown in both telemetry and analytics
        await trackAIInteraction(AIEventType.ADAPTIVE_SUGGESTION_SHOWN, {
          userId,
          category: suggestion.category || 'general',
          confidence,
          delivery: 'inline_card',
          source: 'today', // Consistent source for today-generated suggestions
          stressLevel: context.currentContext.userState.stressLevel,
          energyLevel: context.currentContext.userState.energyLevel
        });
        
        // 📊 Track in analytics for performance analysis
        await adaptiveSuggestionAnalytics.trackEvent('shown', userId, {
          show: true,
          title: suggestion.title,
          content: suggestion.content,
          category: suggestion.category,
          confidence,
          cta: suggestion.cta
        });

        // 🧪 Record A/B test event
        if (testId) {
          await abTestingFramework.recordTestEvent(userId, 'suggestion_shown', {
            suggestionCategory: suggestion.category,
            timingScore: timingRecommendation?.score,
            userStressLevel: context.currentContext.userState.stressLevel
          });
        }

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
          screen: '/(tabs)/index'
        }
      };
    }

    // High compulsions, low CBT → Remap to Mood suggestion
    if ((recentActivity?.compulsionCount || 0) > 5 && (recentActivity?.cbtRecords || 0) === 0) {
      return {
        show: true,
        title: "Nasıl Hissediyorsun?",
        content: "Son günlerde biraz zorlanıyor gibisiniz. Kısa bir mood kaydı iyi gelebilir.",
        category: 'mood',
        cta: {
          screen: '/(tabs)/index'
        }
      };
    }

    return { show: false };
  };

  /**
   * 🌬️ Enhanced fallback suggestion with breathwork service integration
   */
  const generateEnhancedFallbackSuggestion = async (userId: string, context: MinimalContext): Promise<any> => {
    const { recentActivity, currentContext } = context;
    
    // 1. Check if breathwork suggestion should be prioritized
    const shouldTryBreathwork = (
      currentContext.userState.stressLevel === 'high' ||
      currentContext.userState.energyLevel < 30 ||
      (recentActivity?.compulsionCount || 0) > 3
    );

    if (shouldTryBreathwork) {
      try {
        // Import breathwork service and mood tracker
        const { BreathworkSuggestionService } = await import('../services/breathworkSuggestionService');
        const moodTracker = (await import('@/services/moodTrackingService')).default;
        
        // Get mood score for context
        let moodScore: number | undefined = undefined;
        try {
          const lastMood = await moodTracker.getLastMoodEntry(userId);
          moodScore = lastMood?.mood_score;
        } catch (error) {
          console.warn('⚠️ Failed to get mood for breathwork context:', error);
        }
        
        const breathworkContext = {
          userId,
          currentTime: new Date(),
          moodScore,
          recentCompulsions: recentActivity?.compulsionCount || 0,
          anxietyLevel: moodScore ? Math.max(1, Math.min(10, Math.round(11 - moodScore/10))) : 
                      currentContext.userState.stressLevel === 'high' ? 8 : 
                      currentContext.userState.stressLevel === 'low' ? 3 : 5
        };
        
        const breathworkService = BreathworkSuggestionService.getInstance();
        const breathworkSuggestion = await breathworkService.generateSuggestion(breathworkContext);
        
        if (breathworkSuggestion) {
          const protocol = breathworkSuggestion.protocol?.name || 'box';
          const anxietyLevel = breathworkContext.anxietyLevel;
          
          return {
            show: true,
            id: `breathwork_${Date.now()}`,
            title: breathworkSuggestion.trigger?.reason || "Nefes Al",
            content: breathworkSuggestion.protocol.description || 
                    `${protocol === '4-7-8' ? '4-7-8' : 'Kutu'} nefes tekniği ile ${Math.ceil(breathworkSuggestion.protocol.duration / 60) || 5} dakika nefes egzersizi yaparak rahatlamaya ne dersiniz?`,
            category: 'breathwork',
            confidence: 0.8,
            priority: breathworkSuggestion.urgency === 'high' ? 'urgent' : 
                     breathworkSuggestion.urgency === 'low' ? 'low' : 'medium',
            timing: 'optimal',
            cta: {
              label: 'Nefes Egzersiziyle Başla',
              screen: '/(tabs)/breathwork',
              params: {
                protocol: anxietyLevel >= 7 ? '4-7-8' : 'box',
                autoStart: 'true',
                source: 'adaptive_suggestion'
              }
            }
          };
        }
        
        console.log('🌬️ Breathwork service returned no suggestion');
      } catch (error) {
        console.warn('⚠️ Enhanced breathwork suggestion failed:', error);
      }
    }

    // 2. Fall back to original suggestion logic
    return generateFallbackSuggestion(context);
  };

  /**
   * 🔄 Generate suggestion from UnifiedAIPipeline result
   */
  const generateSuggestionFromPipeline = useCallback(async (
    userId: string, 
    result: UnifiedPipelineResult, 
    source: 'mood' | 'cbt' | 'tracking' | 'today' = 'today'
  ): Promise<AdaptiveSuggestion> => {
    // 1. Flag checks
    if (!FEATURE_FLAGS.isEnabled('AI_JITAI_SYSTEM') || 
        !FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS')) {
      console.log('🚫 Pipeline-based adaptive suggestions disabled by flags');
      return { show: false };
    }

    try {
      // 2. Get A/B test parameters
      let testParameters: ABTestVariant['parameters'] | null = null;
      let testId: string | null = null;
      try {
        const testAssignment = await abTestingFramework.getUserTestAssignment(userId);
        testParameters = testAssignment.parameters;
        testId = testAssignment.testId;
      } catch (error) {
        console.warn('⚠️ Failed to get A/B test assignment:', error);
      }

      const cooldownHours = testParameters?.cooldownHours || DEFAULT_COOLDOWN_HOURS;
      const respectCircadianTiming = testParameters?.respectCircadianTiming ?? true;
      const minimumTimingScore = testParameters?.minimumTimingScore ?? 30;

      // 3. Check cooldown/snooze/quiet (reuse existing logic)
      const snoozeKey = `adaptive_suggestion_snooze_until_${userId}`;
      const snoozeUntil = await AsyncStorage.getItem(snoozeKey);
      if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) {
        return { show: false };
      }

      const cooldownKey = `adaptive_suggestion_last_${userId}`;
      const lastSuggested = await AsyncStorage.getItem(cooldownKey);
      if (lastSuggested) {
        const timeSinceLastSuggestion = Date.now() - parseInt(lastSuggested);
        const cooldownMs = cooldownHours * 60 * 60 * 1000;
        if (timeSinceLastSuggestion < cooldownMs) {
          return { show: false };
        }
      }

      if (isQuietHours()) {
        return { show: false };
      }

      // 4. Timing check
      if (respectCircadianTiming) {
        try {
          const timingRecommendation = await circadianTimingEngine.getTimingRecommendation(userId);
          if (timingRecommendation.score < minimumTimingScore) {
            console.log(`⏰ Poor timing score for ${source}: ${timingRecommendation.score}/${minimumTimingScore}`);
            return { show: false };
          }
        } catch (error) {
          console.warn('⚠️ Circadian timing check failed:', error);
        }
      }

      // 5. Extract metrics safely from pipeline result
      let weeklyDelta = 0;
      let volatility = 0;
      let baselines: any = {};
      let sampleSize = 0;
      let bestTimes: number[] = [];

      try {
        // Primary: analytics data
        if (result.analytics && source !== 'today' && result.analytics[source as keyof typeof result.analytics]) {
          const analytics = (result.analytics as any)[source];
          weeklyDelta = analytics.weeklyDelta || 0;
          volatility = analytics.volatility || 0;
          baselines = analytics.baselines || {};
          sampleSize = analytics.sampleSize || 0;
          bestTimes = analytics.bestTimes || [];
        }
        // Enhanced Fallback: patterns data with source-specific extraction
        else if (Array.isArray(result.patterns)) {
          const pattern = result.patterns.find((p: any) => p.category === source);
          if (pattern?.dashboardMetrics) {
            weeklyDelta = pattern.dashboardMetrics.weeklyDelta || 0;
            volatility = pattern.dashboardMetrics.volatility || 0;
            baselines = pattern.dashboardMetrics.baselines || {};
            sampleSize = pattern.dashboardMetrics.sampleSize || 0;
          }
        }
        // 🔧 ENHANCED FALLBACK: Source-specific heuristics when analytics missing
        else {
          console.log(`⚡ Analytics absent for ${source}, using enhanced fallbacks`);
          
          if (source === 'tracking') {
            // Tracking: enhanced trend analysis with pattern sophistication
            if (Array.isArray(result.patterns) && result.patterns.length > 0) {
              const temporalPatterns = result.patterns.filter((p: any) => p.temporal === true || p.type?.includes('temporal'));
              const allPatterns = result.patterns;
              
              // Enhanced pattern classification
              const increasingPatterns = allPatterns.filter((p: any) => 
                p.trend === 'increasing' || 
                p.description?.toLowerCase()?.includes('increase') || 
                p.description?.toLowerCase()?.includes('artı') ||
                p.description?.toLowerCase()?.includes('yüksel') ||
                p.severity === 'high' && p.confidence > 0.7).length;
                
              const decreasingPatterns = allPatterns.filter((p: any) => 
                p.trend === 'decreasing' || 
                p.description?.toLowerCase()?.includes('azal') || 
                p.description?.toLowerCase()?.includes('düş') ||
                p.description?.toLowerCase()?.includes('improve') ||
                p.severity === 'low' && p.confidence > 0.7).length;
              
              const stablePatterns = allPatterns.length - increasingPatterns - decreasingPatterns;
              
              // Sophisticated weeklyDelta calculation
              const trendStrength = (increasingPatterns * 12) - (decreasingPatterns * 12) + (stablePatterns * 0);
              weeklyDelta = Math.max(-25, Math.min(25, trendStrength)); // Clamped range
              
              // Enhanced sample size from multiple sources
              const patternSampleSize = temporalPatterns.length * 2; // Temporal patterns worth more
              const metadataSampleSize = result.metadata?.processingTime ? Math.min(10, Math.floor(result.metadata.processingTime / 400)) : 0;
              sampleSize = Math.max(patternSampleSize, metadataSampleSize, allPatterns.length);
              
              // Dynamic volatility based on pattern conflict
              const patternConflict = Math.abs(increasingPatterns - decreasingPatterns);
              const patternConsistency = stablePatterns / allPatterns.length;
              volatility = (patternConflict * 6) + (patternConsistency > 0.6 ? 0 : 10); // Conflict + inconsistency
              
              // Smart baseline inference
              // Neutral baseline mapping removed
              
              console.log(`📊 Tracking enhanced fallback: patterns=${allPatterns.length}, inc=${increasingPatterns}, dec=${decreasingPatterns}, stable=${stablePatterns}, weeklyDelta=${weeklyDelta}`);
            } else {
              // Enhanced metadata-only fallback
              const processingTime = result.metadata?.processingTime || 0;
              const contextSize = 0; // dataPoints not available in metadata type
              
              if (processingTime > 3000 || contextSize > 20) {
                // Rich context suggests active tracking
                sampleSize = Math.min(8, Math.floor(processingTime / 500) + Math.floor(contextSize / 5));
                weeklyDelta = -2; // Assume slight improvement for active users
                volatility = 8; // Moderate volatility for active tracking
                baselines.compulsions = 5;
              } else if (processingTime > 1000) {
                // Some context
                sampleSize = 3;
                weeklyDelta = 0; // Neutral
                volatility = 5;
                baselines.compulsions = 6;
              } else {
                // Minimal context
                sampleSize = 1;
                weeklyDelta = 0;
                volatility = 3;
                baselines.compulsions = 7; // Higher baseline for uncertainty
              }
              
              console.log(`📊 Tracking metadata fallback: processingTime=${processingTime}, contextSize=${contextSize}, sampleSize=${sampleSize}`);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to extract metrics from pipeline result:', error);
      }

      // 6. Generate suggestion based on source and metrics
      let suggestion: any = null;

      switch (source) {
        case 'mood':
          suggestion = generateMoodSuggestion(weeklyDelta, volatility, baselines, sampleSize);
          break;
        case 'cbt':
          suggestion = generateCBTSuggestion(weeklyDelta, volatility, baselines, sampleSize);
          break;
        case 'tracking':
          suggestion = generateTrackingSuggestion(weeklyDelta, volatility, baselines, sampleSize);
          break;
        default:
          return { show: false };
      }

      if (!suggestion || !suggestion.show) {
        return { show: false };
      }

      // 7. Track and return
      await AsyncStorage.setItem(cooldownKey, Date.now().toString());
      
      const confidence = 0.7; // Default confidence for pipeline-based suggestions
      
      await trackAIInteraction(AIEventType.ADAPTIVE_SUGGESTION_SHOWN, {
        userId,
        category: suggestion.category,
        confidence,
        delivery: 'cross_module_card',
        source: source || 'today', // Ensure source is always present
        hasWeeklyDelta: weeklyDelta !== 0,
        hasVolatility: volatility > 0,
        sampleSize
      });

      await adaptiveSuggestionAnalytics.trackEvent('shown', userId, suggestion);

      if (testId) {
        await abTestingFramework.recordTestEvent(userId, 'suggestion_shown', {
          suggestionCategory: suggestion.category
        });
      }

      return {
        show: true,
        title: suggestion.title,
        content: suggestion.content,
        cta: suggestion.cta,
        confidence,
        category: suggestion.category
      };

    } catch (error) {
      console.error(`❌ Pipeline-based suggestion generation failed for ${source}:`, error);
      return { show: false };
    }
  }, []);

  /**
   * 😊 Generate mood-specific suggestions
   */
  const generateMoodSuggestion = (weeklyDelta: number, volatility: number, baselines: any, sampleSize: number): any => {
    // Improvement → Remap reinforcement to Mood
    if (weeklyDelta > 10 && sampleSize >= 5) {
      return {
        show: true,
        title: "Güzel İvme!",
        content: "Mood'un bu hafta iyileşmiş. Devam etmek için kısa bir mood kaydı ekleyebilirsin.",
        category: 'mood',
        cta: { screen: '/(tabs)/index' }
      };
    }

    // Low mood/high volatility → breathwork
    if ((baselines.mood && baselines.mood < 40) || volatility > 15) {
      return {
        show: true,
        title: "Kısa Bir Mola",
        content: "Kendini zorlayıcı hissediyorsun. 5 dakikalık nefes egzersizi rahatlatabilir.",
        category: 'breathwork',
        cta: { screen: '/(tabs)/breathwork', params: { autoStart: true, protocol: 'box' } }
      };
    }

    // Missing recency → mood prompt
    if (sampleSize < 3) {
      return {
        show: true,
        title: "Nasıl Hissediyorsun?",
        content: "Son günlerde mood kaydı yok. Şimdi bir kayıt eklemek ister misin?",
        category: 'mood',
        cta: { screen: '/(tabs)/index' }
      };
    }

    return { show: false };
  };

  /**
   * 🧠 Generate CBT-specific suggestions
   */
  const generateCBTSuggestion = (weeklyDelta: number, volatility: number, baselines: any, sampleSize: number): any => {
    // Good CBT progress → mood tracking
    if (weeklyDelta > 8 && sampleSize >= 3) {
      return {
        show: true,
        title: "İlerleme Kaydı",
        content: "CBT kayıtların çok tutarlı! Mood tracking ile desteklemeye ne dersin?",
        category: 'mood',
        cta: { screen: '/(tabs)/index' }
      };
    }

    // High distortion volatility → breathwork before CBT
    if (volatility > 20) {
      return {
        show: true,
        title: "Önce Sakinleş",
        content: "Düşünceler karmaşık görünüyor. Önce nefes egzersizi ile sakinleşmeye ne dersin?",
        category: 'breathwork',
        cta: { screen: '/(tabs)/breathwork', params: { autoStart: true, protocol: '4-7-8' } }
      };
    }

    // Low CBT activity → Remap encourage to Mood
    if (sampleSize < 2) {
      return {
        show: true,
        title: "Kısa Bir Check-in",
        content: "Kendini nasıl hissettiğini kaydetmek iyi gelebilir.",
        category: 'mood',
        cta: { screen: '/(tabs)/index' }
      };
    }

    return { show: false };
  };

  /**
   * 📊 Generate tracking-specific suggestions
   */
  const generateTrackingSuggestion = (weeklyDelta: number, volatility: number, baselines: any, sampleSize: number): any => {
    // High compulsion increase → breathwork
    if (weeklyDelta > 15 || (baselines.compulsions && baselines.compulsions > 8)) {
      return {
        show: true,
        title: "Stresi Azalt",
        content: "Kompülsiyon sayın artmış. Hemen nefes egzersizi ile stresi azaltmaya ne dersin?",
        category: 'breathwork',
        cta: { screen: '/(tabs)/breathwork', params: { autoStart: true, protocol: '4-7-8' } }
      };
    }

    // Good resistance progress → Remap to Mood
    if (weeklyDelta < -10 && sampleSize >= 5) {
      return {
        show: true,
        title: "Başarını Kaydet",
        content: "Direnç oranın harika! Bunu kısa bir mood kaydı ile işaretlemek ister misin?",
        category: 'mood',
        cta: { screen: '/(tabs)/index' }
      };
    }

    // Consistent tracking → mood correlation
    if (sampleSize >= 7) {
      return {
        show: true,
        title: "Mood Korelasyonu",
        content: "Takip kayıtların çok düzenli! Mood ile korelasyonunu görmek ister misin?",
        category: 'mood',
        cta: { screen: '/(tabs)/index' }
      };
    }

    return { show: false };
  };

  /**
   * 📊 Track suggestion click for analytics
   */
  const trackSuggestionClick = useCallback(async (userId: string, suggestion: AdaptiveSuggestion, sessionDuration?: number): Promise<void> => {
    try {
      await adaptiveSuggestionAnalytics.trackEvent('clicked', userId, suggestion, { sessionDuration });
      
      // 🕐 Learn from successful interaction for circadian timing
      const currentHour = new Date().getHours();
      await circadianTimingEngine.learnFromInteraction(
        userId, 
        currentHour, 
        true, // Successful (clicked)
        suggestion.category === 'breathwork' ? 'high' : 'moderate' // Infer stress from category
      );

      // 🧪 Record A/B test click event
      try {
        await abTestingFramework.recordTestEvent(userId, 'suggestion_clicked', {
          suggestionCategory: suggestion.category,
          sessionDuration
        });
      } catch (error) {
        console.warn('⚠️ Failed to record A/B test click event:', error);
      }
      
      console.log('📊 Tracked adaptive suggestion click for analytics, timing, and A/B testing');
    } catch (error) {
      console.error('❌ Failed to track suggestion click:', error);
    }
  }, []);

  /**
   * 📊 Track suggestion dismissal for analytics
   */
  const trackSuggestionDismissal = useCallback(async (userId: string, suggestion: AdaptiveSuggestion, snoozeHours?: number): Promise<void> => {
    try {
      await adaptiveSuggestionAnalytics.trackEvent('dismissed', userId, suggestion, { snoozeHours });
      
      // 🕐 Learn from dismissal for circadian timing
      const currentHour = new Date().getHours();
      await circadianTimingEngine.learnFromInteraction(
        userId, 
        currentHour, 
        false, // Not successful (dismissed)
        suggestion.category === 'breathwork' ? 'high' : 'moderate' // Infer stress from category
      );

      // 🧪 Record A/B test dismissal event
      try {
        await abTestingFramework.recordTestEvent(userId, 'suggestion_dismissed', {
          suggestionCategory: suggestion.category,
          snoozeHours
        });
      } catch (error) {
        console.warn('⚠️ Failed to record A/B test dismissal event:', error);
      }
      
      console.log('📊 Tracked adaptive suggestion dismissal for analytics, timing, and A/B testing');
    } catch (error) {
      console.error('❌ Failed to track suggestion dismissal:', error);
    }
  }, []);

  /**
   * 😴 Snooze suggestion for specified hours
   */
  const snoozeSuggestion = useCallback(async (userId: string, hours?: number, source = 'unknown'): Promise<void> => {
    // Use A/B test parameter or provided value or default
    let snoozeHours = hours;
    if (!snoozeHours) {
      try {
        const testAssignment = await abTestingFramework.getUserTestAssignment(userId);
        snoozeHours = testAssignment.parameters?.snoozeHours || DEFAULT_SNOOZE_HOURS;
      } catch (error) {
        snoozeHours = DEFAULT_SNOOZE_HOURS;
      }
    }
    try {
      const snoozeKey = `adaptive_suggestion_snooze_until_${userId}`;
      const snoozeUntil = Date.now() + (snoozeHours * 60 * 60 * 1000);
      await AsyncStorage.setItem(snoozeKey, snoozeUntil.toString());
      
      // Track dismissal in both telemetry and analytics
      await trackAIInteraction(AIEventType.ADAPTIVE_SUGGESTION_DISMISSED, {
        userId,
        source,
        snoozeHours,
        category: 'dismissed' // Consistent category for dismissals
      });
      
      // 📊 Track dismissal in analytics (we need the suggestion object, so this will be handled from Today page)
      console.log(`😴 Adaptive suggestion snoozed for ${snoozeHours} hours (A/B test controlled)`);
    } catch (error) {
      console.error('❌ Failed to snooze adaptive suggestion:', error);
    }
  }, []);

  return {
    generateSuggestion,
    generateSuggestionFromPipeline,
    snoozeSuggestion,
    trackSuggestionClick,
    trackSuggestionDismissal,
    loading,
    isQuietHours
  };
}

export type { AdaptiveSuggestion };
