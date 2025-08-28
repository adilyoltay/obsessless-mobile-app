import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
// ✅ REMOVED: LinearGradient moved to dashboard
import * as Haptics from 'expo-haptics';


// Components
import ScreenLayout from '@/components/layout/ScreenLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import FAB from '@/components/ui/FAB';
import { MoodQuickEntry } from '@/components/mood/MoodQuickEntry';

// Services & Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from '@/services/offlineSync';
import { moodDeletionCache } from '@/services/moodDeletionCache';
import { UUID_REGEX } from '@/utils/validators';
import moodTracker from '@/services/moodTrackingService';
// 🚫 AI Pipeline - DISABLED (Sprint 2: Minimal AI Cleanup)
// import * as pipeline from '@/features/ai-fallbacks/pipeline';
// import { unifiedGamificationService } from '@/features/ai-fallbacks/gamification';
// import { moodDataFlowTester } from '@/features/ai-fallbacks/moodDataFlowTester';
import { useGamificationStore } from '@/store/gamificationStore';
import achievementService from '@/services/achievementService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import type { MoodEntry as ServiceMoodEntry } from '@/services/moodTrackingService';
import { sanitizePII } from '@/utils/privacy';
import { secureDataService } from '@/services/encryption/secureDataService';
// 🚫 AI Telemetry & Risk - DISABLED (Sprint 2: Minimal AI Cleanup) 
// import { trackAIInteraction, AIEventType } from '@/features/ai-fallbacks/telemetry';
// import { advancedRiskAssessmentService } from '@/features/ai-fallbacks/riskAssessmentService';
import patternPersistenceService from '@/services/patternPersistenceService';

// 🚫 Adaptive Suggestions - DISABLED (Sprint 2: Minimal AI Cleanup)
// import { useAdaptiveSuggestion, AdaptiveSuggestion } from '@/features/ai-fallbacks/hooks';
// import AdaptiveSuggestionCard from '@/components/ui/AdaptiveSuggestionCard';  
// import { mapUnifiedResultToRegistryItems, extractUIQualityMeta } from '@/features/ai-fallbacks/insights';


const { width } = Dimensions.get('window');

interface MoodEntry {
  id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes: string;
  trigger?: string;
  created_at: string;
  user_id: string;
}

export default function MoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() || {};
  const { user } = useAuth();
  const { t } = useTranslation();

  // State
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [displayLimit, setDisplayLimit] = useState(5);
  
  // ✅ REMOVED: Pattern analysis and predictive insights state moved to dashboard
  const [moodPatterns, setMoodPatterns] = useState<any[]>([]); // Still needed for dashboard data generation
  const [predictiveInsights, setPredictiveInsights] = useState<any>(null); // Still needed for dashboard data generation
  
  // 🎯 Adaptive Suggestions State (Cross-Module)
  const [adaptiveSuggestion, setAdaptiveSuggestion] = useState<AdaptiveSuggestion | null>(null);
  const [adaptiveMeta, setAdaptiveMeta] = useState<any>(null); // Quality metadata for UI
  const { generateSuggestionFromPipeline, trackSuggestionClick, trackSuggestionDismissal, snoozeSuggestion } = useAdaptiveSuggestion();
  
  // 🧪 DEBUG: Mood Data Flow Testing
  const [showMoodDebug, setShowMoodDebug] = useState(false);
  const [debugReport, setDebugReport] = useState<any>(null);

  // 🛡️ RISK ASSESSMENT: Enhanced prediction state
  const [riskAssessmentData, setRiskAssessmentData] = useState<any>(null);

  // Pre-fill from voice trigger if available (only once)
  useEffect(() => {
    if (params.prefill === 'true' && !showQuickEntry) {
      console.log('📝 Opening mood form with pre-filled data:', params);
      setShowQuickEntry(true);
    }
  }, [params.prefill]); // Only trigger when prefill specifically changes

  // Load mood entries
  // 🔄 FOCUS REFRESH: Reload data when tab gains focus (after multi-intent saves)  
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        console.log('🔄 Mood tab focused, refreshing mood entries...');
        loadMoodEntries();
      }
    }, [user?.id, selectedTimeRange])
  );

  useEffect(() => {
    if (user?.id) {
      loadMoodEntries();
    }
  }, [user?.id, selectedTimeRange]);

  // 🧠 PATTERN PERSISTENCE: Load cached patterns first, then analyze if needed
  useEffect(() => {
    if (user?.id && moodEntries.length > 0) {
      loadCachedPatterns();
    }
  }, [moodEntries, user?.id]);

  // 🧠 AI PATTERN ANALYSIS: Analyze mood patterns when entries change (if cache miss)
  useEffect(() => {
    if (user?.id && moodEntries.length >= 3 && moodPatterns.length === 0) {
      // Only run analysis if we don't have cached patterns
      console.log('🧠 No cached patterns found, running fresh analysis...');
      analyzeMoodPatterns();
    }
  }, [moodEntries, user?.id, moodPatterns.length]);

  /**
   * 🧠 PATTERN PERSISTENCE: Load cached patterns from storage
   */
  const loadCachedPatterns = async () => {
    if (!user?.id) return;
    
    try {
      console.log('📖 Loading cached mood patterns...');
      const cachedPatterns = await patternPersistenceService.loadPatterns(user.id, moodEntries);
      
      if (cachedPatterns && cachedPatterns.length > 0) {
        console.log(`✅ Loaded ${cachedPatterns.length} cached patterns`);
        setMoodPatterns(cachedPatterns);
        
        // 📊 TELEMETRY: Track cache hit
        try {
          await trackAIInteraction(AIEventType.PATTERN_CACHE_HIT, {
            userId: user.id,
            patternsCount: cachedPatterns.length,
            entriesCount: moodEntries.length,
            cacheSource: 'pattern_persistence_service'
          });
        } catch (telemetryError) {
          console.warn('⚠️ Telemetry failed for pattern cache hit:', telemetryError);
        }
      } else {
        console.log('📭 No valid cached patterns found');
        
        // 📊 TELEMETRY: Track cache miss
        try {
          await trackAIInteraction(AIEventType.PATTERN_CACHE_MISS, {
            userId: user.id,
            entriesCount: moodEntries.length,
            reason: 'no_cached_patterns_available'
          });
        } catch (telemetryError) {
          console.warn('⚠️ Telemetry failed for pattern cache miss:', telemetryError);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load cached patterns:', error);
      
      // Don't block the UI - this is just an optimization
      // Fresh analysis will run automatically in the next useEffect
    }
  };

  /**
   * 🚀 NEW: UnifiedAIPipeline entegrasyon fonksiyonu
   * Mood verilerini UnifiedAIPipeline ile analiz eder
   */
  const loadMoodAIWithUnifiedPipeline = async (entries: MoodEntry[]) => {
    console.log(`🔍 Mood Analytics Debug: entries.length=${entries.length}, minRequired=3, user=${!!user?.id}`);
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE') || entries.length < 3) {
      console.log('⚠️ UnifiedAIPipeline for Mood disabled or insufficient data. Falling back.');
      return;
    }

    // 🔄 FORCE CACHE INVALIDATION for fresh analytics
    console.log('🔄 Force invalidating cache to get fresh mood analytics...');
    try {
      await pipeline.triggerInvalidation('manual_refresh', user.id);
      console.log('✅ Cache invalidated - will get fresh analytics');
    } catch (invalidationError) {
      console.warn('⚠️ Cache invalidation failed:', invalidationError);
    }

    try {
      console.log('🚀 Starting UnifiedAIPipeline mood analysis...');
      
      // 📊 TELEMETRY: Track insights request
      await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
        source: 'mood_screen',
        dataType: 'mood_patterns',
        entriesCount: entries.length
      }, user.id);

      // 🔒 PRIVACY: Sanitize PII from mood notes
      const sanitized = entries.slice(-50).map(m => ({
        ...m,
        notes: m.notes ? sanitizePII(m.notes) : m.notes
      }));

      // 🔐 AUDIT: Create encrypted audit payload (non-blocking)
      let auditPayload: any = sanitized;
      try {
        const encrypted = await secureDataService.encryptSensitiveData({
          moods: sanitized,
          dataType: 'mood_patterns'
        });
        auditPayload = encrypted;
      } catch (encryptionError) {
        console.warn('⚠️ Encryption failed, using sanitized data:', encryptionError);
      }

      // 🚀 UNIFIED PIPELINE: Process mood data
      const result = await pipeline.process({
        userId: user.id,
        type: 'data',
        content: { moods: sanitized },
        context: {
          source: 'mood',
          timestamp: Date.now(),
          metadata: {
            dataType: 'mood_patterns',
            privacy: {
              piiSanitized: true,
              encryptionLevel: 'sanitized_plaintext',
              dataEncrypted: !!auditPayload
            }
          }
        }
      });

      console.log('🎯 UnifiedAIPipeline mood analysis completed:', result);

      // 📊 TELEMETRY: Track pipeline completion
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_COMPLETED, {
        source: 'mood_screen',
        cacheHit: result.metadata?.source === 'cache',
        moduleCount: 1,
        dataPoints: sanitized.length,
        processingTime: result.metadata?.processingTime || 0
      }, user.id);

      // 🎯 ADAPTIVE SUGGESTIONS: Generate cross-module suggestion from pipeline
      try {
        const suggestion = await generateSuggestionFromPipeline(user.id, result, 'mood');
        if (suggestion.show) {
          setAdaptiveSuggestion(suggestion);
          
          // 📊 GENERATE QUALITY METADATA from UnifiedPipeline result
          try {
            const registryItems = mapUnifiedResultToRegistryItems(result, 'mood', {
              trigger: 'mood_analysis',
              baseCategory: 'mood',
            });
            const qualityMeta = extractUIQualityMeta(registryItems, 'suggestion');
            setAdaptiveMeta(qualityMeta);
            console.log('📊 Quality metadata for mood suggestion:', qualityMeta);
          } catch (metaError) {
            console.warn('⚠️ Quality metadata generation failed:', metaError);
            setAdaptiveMeta(null);
          }
          
          console.log('✨ Mood adaptive suggestion generated:', suggestion.title);
        } else {
          setAdaptiveSuggestion(null);
          setAdaptiveMeta(null);
        }
      } catch (error) {
        console.warn('⚠️ Adaptive suggestion generation failed (non-blocking):', error);
        setAdaptiveSuggestion(null);
        setAdaptiveMeta(null);
      }

      // 📊 MAP RESULTS: Convert UnifiedAIPipeline results to mood state format with enhanced metrics
      if (result.patterns) {
        const normalizedPatterns = Array.isArray(result.patterns) 
          ? result.patterns 
          : result.patterns.temporal || [];
          
        let mappedPatterns = normalizedPatterns.map((pattern: any) => {
          // 🎯 Extract dashboard metrics for enhanced mood analysis
          const dashboardMetrics = pattern.dashboardMetrics || {};
          
          return {
            type: pattern.type || 'temporal',
            title: pattern.title || pattern.description || 'Mood Pattern',
            description: pattern.description || pattern.pattern || '',
            confidence: pattern.confidence || 0.7,
            severity: pattern.severity || 'medium',
            actionable: pattern.actionable || true,
            suggestion: pattern.suggestion || 'Mood takibine devam et',
            source: 'unified_pipeline',
            // 📊 Enhanced data with dashboard metrics
            data: {
              ...pattern.data,
              // Weekly Delta Metrics
              weeklyDelta: dashboardMetrics.weeklyDelta,
              currentWeekAvg: dashboardMetrics.currentWeekAvg,
              previousWeekAvg: dashboardMetrics.previousWeekAvg,
              weeklyTrend: dashboardMetrics.trend,
              // MEA Correlation Metrics
              meaCorrelations: {
                moodEnergy: dashboardMetrics.moodEnergyCorrelation,
                moodAnxiety: dashboardMetrics.moodAnxietyCorrelation,
                energyAnxiety: dashboardMetrics.energyAnxietyCorrelation
              },
              emotionalProfile: dashboardMetrics.emotionalProfile,
              averages: {
                mood: dashboardMetrics.averageMood,
                energy: dashboardMetrics.averageEnergy,
                anxiety: dashboardMetrics.averageAnxiety
              },
              // Daily Pattern Metrics
              dailyPattern: dashboardMetrics.dayName ? {
                dayOfWeek: dashboardMetrics.dayOfWeek,
                dayName: dashboardMetrics.dayName,
                significance: dashboardMetrics.significance,
                sampleSize: dashboardMetrics.sampleSize
              } : undefined,
              // Data Quality Metrics
              dataPoints: dashboardMetrics.dataPoints,
              analyticsReady: true // Flag for dashboard consumption
            }
          };
        });

        // 📊 ADD CLINICAL ANALYTICS: Add clinical profile as pattern if available
        if (result.analytics?.mood) {
          const analytics = result.analytics.mood;
          
          const clinicalPattern = {
            type: 'clinical_profile',
            title: `${analytics.profile?.type ? (analytics.profile.type.charAt(0).toUpperCase() + analytics.profile.type.slice(1)) : 'Clinical'} Profil`,
            description: analytics.profile?.rationale?.join(', ') || 'Clinical mood profile analizi',
            confidence: analytics.confidence || 0.8,
            severity: analytics.profile?.type === 'stressed' || analytics.profile?.type === 'fatigued' ? 'high' : 'medium',
            actionable: true,
            suggestion: `Volatilite: ${analytics.volatility?.toFixed(1)}, En iyi zaman: ${analytics.bestTimes?.dayOfWeek || 'belirsiz'} ${analytics.bestTimes?.timeOfDay || ''}`,
            source: 'clinical_analytics',
            data: {
              profileType: analytics.profile?.type,
              confidence: analytics.confidence,
              weeklyDelta: analytics.weeklyDelta,
              volatility: analytics.volatility,
              baselines: analytics.baselines,
              correlations: analytics.correlations,
              bestTimes: analytics.bestTimes,
              sampleSize: analytics.sampleSize,
              dataQuality: analytics.dataQuality,
              analyticsReady: true
            }
          };
          
          mappedPatterns = [clinicalPattern, ...mappedPatterns];
          console.log('📊 Clinical analytics added to patterns:', clinicalPattern.title);
        }

        console.log('🎯 Enhanced mood patterns with dashboard metrics:', mappedPatterns);
        setMoodPatterns(mappedPatterns);

        // 💾 PATTERN PERSISTENCE: Save patterns to cache after successful analysis
        try {
          await patternPersistenceService.savePatterns(
            user.id,
            mappedPatterns,
            entries,
            'full_analysis',
            12 * 60 * 60 * 1000 // 12 hour TTL
          );
          console.log('💾 Patterns saved to cache successfully');
          
          // 📊 TELEMETRY: Track cache save
          await trackAIInteraction(AIEventType.PATTERN_CACHE_SAVED, {
            userId: user.id,
            patternsCount: mappedPatterns.length,
            entriesCount: entries.length,
            analysisSource: 'unified_pipeline',
            cacheType: 'full_analysis'
          });
          
        } catch (cacheError) {
          console.warn('⚠️ Failed to cache patterns (non-blocking):', cacheError);
        }
        
        // 📊 TELEMETRY: Track enhanced metrics delivery
        const enhancedMetricsCount = mappedPatterns.filter(p => p.data.analyticsReady).length;
        if (enhancedMetricsCount > 0) {
          await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
            source: 'mood_screen_enhanced',
            enhancedPatternsCount: enhancedMetricsCount,
            dashboardMetricsTypes: mappedPatterns
              .map(p => p.type)
              .filter((type, index, arr) => arr.indexOf(type) === index), // unique types
            meaAnalysisAvailable: mappedPatterns.some(p => p.data.meaCorrelations),
            weeklyDeltaAvailable: mappedPatterns.some(p => p.data.weeklyDelta !== undefined)
          }, user.id);
        }
      }

      // 📊 ENHANCED ANALYTICS: Process clinical-grade mood analytics first
      if (result.analytics?.mood) {
        const analytics = result.analytics.mood;
        console.log('🎯 Processing enhanced mood analytics:', analytics);
        
        // 📊 Store analytics in state for dashboard consumption
        const enhancedInsight = {
          riskLevel: analytics.baselines.mood < 30 ? 'high' : analytics.baselines.mood < 50 ? 'medium' : 'low',
          moodTrend: analytics.weeklyDelta,
          averageRecentMood: Math.round(analytics.baselines.mood),
          volatility: analytics.volatility,
          earlyWarning: {
            triggered: (analytics.baselines.mood < 30) || 
                      (analytics.weeklyDelta < -10) || 
                      (analytics.volatility > 15) ||
                      (analytics.profile?.type === 'stressed'),
            message: analytics.profile?.type === 'stressed' 
              ? `Stresli profil tespit edildi: ${analytics.profile.rationale.join(', ')}`
              : analytics.baselines.mood < 30
              ? `Düşük mood baseline: ${analytics.baselines.mood.toFixed(1)}`
              : analytics.weeklyDelta < -10
              ? `Haftalık mood düşüşü: ${analytics.weeklyDelta.toFixed(1)} puan`
              : analytics.volatility > 15
              ? `Yüksek mood volatilitesi: ${analytics.volatility.toFixed(1)}`
              : null
          },
          interventions: [],
          recommendations: [
            ...analytics.profile?.rationale || [],
            analytics.bestTimes?.dayOfWeek ? `En iyi gün: ${analytics.bestTimes.dayOfWeek}` : '',
            analytics.bestTimes?.timeOfDay ? `En iyi zaman: ${analytics.bestTimes.timeOfDay}` : ''
          ].filter(Boolean),
          // 🎯 ENHANCED DATA: Clinical-grade analytics
          enhancedAnalytics: {
            volatility: analytics.volatility,
            baselines: analytics.baselines,
            correlations: analytics.correlations,
            profile: analytics.profile,
            bestTimes: analytics.bestTimes,
            dataQuality: analytics.dataQuality,
            confidence: analytics.confidence,
            sampleSize: analytics.sampleSize
          },
          source: 'unified_pipeline_analytics'
        };
        
        setPredictiveInsights(enhancedInsight);
        
        // 📊 Enhanced Telemetry for analytics usage
        await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
          source: 'mood_screen_enhanced_analytics',
          analyticsProfile: analytics.profile?.type,
          volatility: analytics.volatility,
          weeklyDelta: analytics.weeklyDelta,
          dataQuality: analytics.dataQuality,
          confidence: analytics.confidence,
          correlationsCount: Object.keys(analytics.correlations).filter(k => {
            const correlation = (analytics.correlations as any)[k];
            return correlation?.r !== null;
          }).length,
          bestTimesAvailable: !!(analytics.bestTimes?.dayOfWeek || analytics.bestTimes?.timeOfDay)
        }, user.id);
        
        console.log('🎯 Enhanced mood analytics processed successfully');
      }
      // FALLBACK: Use progress insights if analytics unavailable
      else if (result.insights?.progress || result.patterns) {
        let predictiveInsight: any = null;
        
        // First, try to use progress insights from unified pipeline
        if (result.insights?.progress && result.insights.progress.length > 0) {
          const progressInsights = result.insights.progress;
          const avgMoodMetric = progressInsights.find((p: any) => p.metric === 'average_mood');
          const trendMetric = progressInsights.find((p: any) => p.metric === 'mood_trend');
          
          const avgMoodValue = avgMoodMetric?.value || 50;
          const trendChangeValue = trendMetric?.change || 0;
          
          predictiveInsight = {
            riskLevel: avgMoodValue < 30 ? 'high' : avgMoodValue < 50 ? 'medium' : 'low',
            moodTrend: trendChangeValue,
            averageRecentMood: Math.round(avgMoodValue),
            earlyWarning: {
              triggered: (avgMoodValue < 30) || (trendChangeValue < -15),
              message: avgMoodValue < 30 
                ? 'Son günlerde mood seviyende belirgin düşüş var. Destek almayı düşünür müsün?'
                : trendChangeValue < -15
                ? 'Mood seviyende düşüş trendi tespit ettik. Kendine iyi bakmanın zamanı.'
                : null
            },
            interventions: [],
            recommendations: progressInsights.map((p: any) => p.interpretation).filter(Boolean),
            source: 'unified_pipeline_progress'
          };
        }
        // 🚀 FALLBACK: Use enhanced pattern data if progress insights unavailable
        else if (result.patterns) {
          const normalizedPatterns = Array.isArray(result.patterns) ? result.patterns : result.patterns.temporal || [];
          const weeklyDeltaPattern = normalizedPatterns.find((p: any) => p.type === 'mood_weekly_delta');
          const meaPattern = normalizedPatterns.find((p: any) => p.type === 'mood_mea_correlation');
          
          if (weeklyDeltaPattern?.dashboardMetrics || meaPattern?.dashboardMetrics) {
            const weeklyMetrics = weeklyDeltaPattern?.dashboardMetrics;
            const meaMetrics = meaPattern?.dashboardMetrics;
            
            const currentMoodAvg = weeklyMetrics?.currentWeekAvg || meaMetrics?.averageMood || 50;
            const weeklyDelta = weeklyMetrics?.weeklyDelta || 0;
            
            predictiveInsight = {
              riskLevel: currentMoodAvg < 30 ? 'high' : currentMoodAvg < 50 ? 'medium' : 'low',
              moodTrend: weeklyDelta,
              averageRecentMood: Math.round(currentMoodAvg),
              earlyWarning: {
                triggered: (currentMoodAvg < 30) || (weeklyDelta < -10),
                message: currentMoodAvg < 30 
                  ? 'Mevcut mood seviyesi düşük - kendine iyi bakmaya odaklan'
                  : weeklyDelta < -10
                  ? `Haftalık mood ${weeklyDelta.toFixed(1)} puan düştü - trend'i takip et`
                  : null
              },
              interventions: [],
              recommendations: [
                weeklyDeltaPattern?.suggestion,
                meaPattern?.suggestion
              ].filter(Boolean),
              // 🎯 Enhanced metadata from patterns
              enhancedData: {
                weeklyMetrics: weeklyMetrics,
                meaAnalysis: meaMetrics,
                emotionalProfile: meaMetrics?.emotionalProfile
              },
              source: 'unified_pipeline_patterns'
            };
          }
        }
        
        if (predictiveInsight) {
          console.log('🔮 Enhanced predictive insights with unified metrics:', predictiveInsight);
          setPredictiveInsights(predictiveInsight);
        }
      }

      // 📊 TELEMETRY: Track insights delivery
      const insightsCount = (result.insights?.therapeutic?.length || 0) + (result.insights?.progress?.length || 0);
      const patternsCount = Array.isArray(result.patterns) ? result.patterns.length : 0;
      
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        source: 'mood_screen',
        insightsCount,
        patternsCount,
        deliveryTime: result.metadata?.processingTime || 0
      }, user.id);

    } catch (error) {
      console.error('❌ UnifiedAIPipeline mood analysis failed:', error);
      
      // 📊 TELEMETRY: Track pipeline error
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_ERROR, {
        source: 'mood_screen',
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackTriggered: true
      }, user.id);
      
      // 🚨 USER FEEDBACK: Inform user about analysis failure
      try {
        const { aiErrorFeedbackService, AIErrorType } = await import('@/features/ai-fallbacks/aiErrorFeedbackService');
        
        // Determine error type based on error message/type
        let errorType: keyof typeof AIErrorType = 'INSIGHTS_GENERATION_FAILED';
        if (error instanceof Error) {
          if (error.message.includes('network') || error.message.includes('fetch')) {
            errorType = 'NETWORK_ERROR';
          } else if (error.message.includes('unavailable') || error.message.includes('service')) {
            errorType = 'LLM_SERVICE_UNAVAILABLE';
          } else if (error.message.includes('rate') || error.message.includes('limit')) {
            errorType = 'RATE_LIMIT_EXCEEDED';
          }
        }
        
        await aiErrorFeedbackService.handleAIError(errorType, {
          userId: user.id,
          feature: 'mood_analysis',
          heuristicFallback: true,
          retryable: true,
          metadata: {
            entriesCount: entries.length,
            errorMessage: error instanceof Error ? error.message : String(error),
            source: 'mood_screen'
          }
        });
      } catch (feedbackError) {
        console.warn('⚠️ Failed to show mood analysis error feedback:', feedbackError);
      }
      
      // 🚀 FALLBACK: Use UnifiedAIPipeline as fallback
      console.log('🚀 Falling back to UnifiedAIPipeline...');
      await runUnifiedMoodAnalysis(entries);
    }
  };

  /**
   * 🚀 UNIFIED FALLBACK: Use UnifiedAIPipeline for mood pattern analysis
   * Replaces legacy MoodPatternAnalysisService with unified approach
   */
  const runUnifiedMoodAnalysis = async (entries: MoodEntry[]) => {
    if (!user?.id) return;
    
    try {
      console.log('🚀 Running unified mood analysis fallback...');
      
      // Use UnifiedAIPipeline instead of legacy service
      const result = await pipeline.process({
        userId: user.id,
        type: 'data',
        content: { moods: entries },
        context: {
          source: 'mood',
          timestamp: Date.now(),
          metadata: {
            dataType: 'mood_patterns',
            fallbackMode: true,
            entriesCount: entries.length
          }
        }
      });

      console.log('🔄 Unified fallback analysis completed:', result);
      
      // Extract patterns from unified result
      const unifiedPatterns = result?.patterns || [];
      
      // Handle patterns array format properly
      const patternsArray = Array.isArray(unifiedPatterns) ? unifiedPatterns : [];
      
      // Merge with existing heuristic patterns if any
      const mergedPatterns = moodPatterns && moodPatterns.length > 0 
        ? mergeHeuristicAndAIPatterns(moodPatterns, patternsArray)
        : patternsArray;
        
      setMoodPatterns(mergedPatterns);

      // 💾 PATTERN PERSISTENCE: Save fallback patterns to cache
      try {
        await patternPersistenceService.savePatterns(
          user.id,
          mergedPatterns,
          entries,
          'heuristic_fallback',
          6 * 60 * 60 * 1000 // 6 hour TTL (shorter for fallback)
        );
        console.log('💾 Fallback patterns saved to cache successfully');
        
        // 📊 TELEMETRY: Track fallback cache save
        await trackAIInteraction(AIEventType.PATTERN_CACHE_SAVED, {
          userId: user.id,
          patternsCount: mergedPatterns.length,
          entriesCount: entries.length,
          analysisSource: 'fallback_pipeline',
          cacheType: 'heuristic_fallback'
        });
        
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache fallback patterns (non-blocking):', cacheError);
      }
      
      // Also update insights if available (insights are managed in parent component)
      if (result?.insights) {
        const formattedInsights = Array.isArray(result.insights) ? result.insights : [];
        console.log(`📊 Generated ${formattedInsights.length} insights from unified analysis`);
      }
      
    } catch (fallbackError) {
      console.error('❌ Unified fallback analysis also failed:', fallbackError);
      // Keep existing heuristic patterns as final fallback
    }
  };

  const analyzeMoodPatterns = async () => {
    if (!user?.id || moodEntries.length < 3) return;

    try {
      console.log('🧠 Starting mood pattern analysis...');
      
      // Convert entries to the service format
      const serviceEntries = moodEntries.map(entry => ({
        id: entry.id,
        user_id: entry.user_id,
        mood_score: entry.mood_score,
        energy_level: entry.energy_level,
        anxiety_level: entry.anxiety_level,
        notes: entry.notes || '',
        trigger: (entry as any).trigger || '',
        created_at: entry.created_at
      }));

      // ⚡ PROGRESSIVE UI Phase-1: Start with quick heuristic analysis for immediate feedback
      const quickPatterns = generateQuickHeuristicPatterns(serviceEntries);
      console.log('⚡ Phase-1 (Heuristic) patterns:', quickPatterns);
      setMoodPatterns(quickPatterns);

      // 🚀 PROGRESSIVE UI Phase-2: Check if Progressive UI is enabled
      if (FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE')) {
        // Phase-2: Run UnifiedAIPipeline in background (3s delay)
        setTimeout(async () => {
          await loadMoodAIWithUnifiedPipeline(moodEntries);
        }, 3000);
      } else {
        // Non-progressive mode: Run immediately
        if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE')) {
          await loadMoodAIWithUnifiedPipeline(moodEntries);
        } else {
          // Unified mode: Use UnifiedAIPipeline
          await runUnifiedMoodAnalysis(moodEntries);
        }
      }

      // 🔮 PREDICTIVE INSIGHTS: Generate fallback risk assessment if not handled by UnifiedAIPipeline
      if (serviceEntries.length >= 5 && !predictiveInsights) {
        try {
          // Simple predictive analysis based on recent trends
          const recentEntries = serviceEntries.slice(-7); // Last 7 entries
          const avgRecentMood = recentEntries.reduce((sum, e) => sum + e.mood_score, 0) / recentEntries.length;
          const oldEntries = serviceEntries.slice(-14, -7); // Previous 7 entries
          const avgOldMood = oldEntries.length > 0 ? oldEntries.reduce((sum, e) => sum + e.mood_score, 0) / oldEntries.length : avgRecentMood;
          
          const moodTrend = avgRecentMood - avgOldMood;
          const riskLevel = avgRecentMood < 30 ? 'high' : avgRecentMood < 50 ? 'medium' : 'low';
          
          const predictiveInsight = {
            riskLevel,
            moodTrend,
            averageRecentMood: Math.round(avgRecentMood),
            earlyWarning: {
              triggered: riskLevel === 'high' || moodTrend < -15,
              message: riskLevel === 'high' 
                ? 'Son günlerde mood seviyende belirgin düşüş var. Destek almayı düşünür müsün?'
                : moodTrend < -15
                ? 'Mood seviyende düşüş trendi tespit ettik. Kendine iyi bakmanın zamanı.'
                : null
            },
            interventions: [] as Array<{type: string; action: string}>,
            recommendations: [] as string[]
          };

          // Add interventions based on patterns and risk level
          if (riskLevel !== 'low') {
            predictiveInsight.interventions.push({
              type: 'immediate',
              action: 'Nefes egzersizi yap (4-7-8 tekniği)'
            });
            
            if (moodTrend < -10) {
              predictiveInsight.interventions.push({
                type: 'preventive',
                action: 'Günlük mood takibini sürdür ve tetikleyicileri fark et'
              });
            }
          }

          // Add recommendations based on mood trend (simple analysis without patterns dependency)
          if (moodTrend < -10) {
            predictiveInsight.recommendations.push('Düşüş trendini fark ettin - nefes egzersizleri ve mindfulness teknikleri deneyebilirsin.');
          }
          
          if (avgRecentMood < 40) {
            predictiveInsight.recommendations.push('Düşük mood döneminde kendine ekstra iyi bak - sevdiğin aktiviteleri yapmayı dene.');
          }
          
          if (avgRecentMood >= 70) {
            predictiveInsight.recommendations.push('Pozitif bir dönemdesin! Bu iyi hissi sürdürmek için düzenli rutinlere devam et.');
          }

          console.log('🔮 Fallback predictive insights generated:', predictiveInsight);
          setPredictiveInsights(predictiveInsight);

        } catch (predictiveError) {
          console.error('⚠️ Fallback predictive analysis failed:', predictiveError);
        }
      }

    } catch (error) {
      console.error('❌ Pattern analysis failed:', error);
      // Set empty arrays to avoid UI crashes
      setMoodPatterns([]);
      setPredictiveInsights(null);
    }
  };

  // ⚡ PROGRESSIVE UI: Quick heuristic pattern generation for immediate feedback
  const generateQuickHeuristicPatterns = (entries: any[]): any[] => {
    const patterns: any[] = [];
    
    if (entries.length < 3) return patterns;
    
    // Quick mood trend analysis
    const recent = entries.slice(0, 3);
    const avgRecentMood = recent.reduce((sum, e) => sum + e.mood_score, 0) / recent.length;
    
    if (avgRecentMood < 40) {
      patterns.push({
        type: 'temporal',
        title: 'Son Günlerde Düşük Mood',
        description: `Son 3 kayıtta ortalama mood ${Math.round(avgRecentMood)}`,
        confidence: 0.8,
        severity: avgRecentMood < 30 ? 'high' : 'medium',
        actionable: true,
        suggestion: 'Kendine iyi bakmaya odaklan, nefes egzersizi deneyebilirsin',
        source: 'heuristic',
        data: {
          recentAverage: Math.round(avgRecentMood),
          sampleSize: recent.length
        }
      });
    } else if (avgRecentMood > 70) {
      patterns.push({
        type: 'temporal',
        title: 'Pozitif Mood Trendi',
        description: `Son kayıtlarda yüksek mood seviyesi (${Math.round(avgRecentMood)})`,
        confidence: 0.7,
        severity: 'low',
        actionable: false,
        suggestion: 'Bu pozitif durumu sürdürmeye devam et',
        source: 'heuristic'
      });
    }

    // 📈 ENHANCED MEA CORRELATION: Detailed Mood-Energy-Anxiety analysis
    const moods = entries.map(e => e.mood_score);
    const energies = entries.map(e => e.energy_level);
    const anxieties = entries.map(e => e.anxiety_level);
    
    // Calculate correlations using Pearson correlation coefficient
    const calculateCorrelation = (x: number[], y: number[]): number => {
      if (x.length !== y.length || x.length === 0) return 0;
      
      const n = x.length;
      const meanX = x.reduce((a, b) => a + b, 0) / n;
      const meanY = y.reduce((a, b) => a + b, 0) / n;
      
      let numerator = 0;
      let sumXSquared = 0;
      let sumYSquared = 0;
      
      for (let i = 0; i < n; i++) {
        const xDiff = x[i] - meanX;
        const yDiff = y[i] - meanY;
        numerator += xDiff * yDiff;
        sumXSquared += xDiff * xDiff;
        sumYSquared += yDiff * yDiff;
      }
      
      const denominator = Math.sqrt(sumXSquared * sumYSquared);
      return denominator === 0 ? 0 : numerator / denominator;
    };

    const moodEnergyCorr = calculateCorrelation(moods, energies);
    const moodAnxietyCorr = calculateCorrelation(moods, anxieties);
    const energyAnxietyCorr = calculateCorrelation(energies, anxieties);
    
    // Determine emotional profile
    let profileType = 'balanced';
    let profileTitle = 'Dengeli Duygusal Profil';
    let profileDescription = 'Mood, enerji ve anksiyete seviyelerin dengeli görünüyor';
    let severity: 'low' | 'medium' | 'high' = 'low';
    let suggestion = 'Bu dengeyi korumaya devam et';
    
    // Strong positive mood-energy + negative mood-anxiety = optimal
    if (moodEnergyCorr > 0.5 && moodAnxietyCorr < -0.3) {
      profileType = 'optimal';
      profileTitle = 'Optimal Duygusal Denge';
      profileDescription = 'Mood yüksek olduğunda enerji artıyor, anksiyete azalıyor - ideal durum';
      severity = 'low';
      suggestion = 'Harika! Bu optimal durumu sürdürmeye devam et';
    }
    // Strong negative mood-energy + positive mood-anxiety = depression risk
    else if (moodEnergyCorr < -0.3 && moodAnxietyCorr > 0.3) {
      profileType = 'depression_risk';
      profileTitle = 'Depresif Eğilim Riski';
      profileDescription = 'Düşük mood, düşük enerji ve yüksek anksiyete birlikte - dikkat gerekli';
      severity = 'high';
      suggestion = 'Enerji artırıcı aktiviteler (egzersiz, güneş ışığı) ve anksiyete azaltıcı teknikler uygulayın';
    }
    // High energy-anxiety correlation = manic tendency
    else if (energyAnxietyCorr > 0.6) {
      profileType = 'manic_tendency';
      profileTitle = 'Yüksek Enerji Dalgalanması';
      profileDescription = 'Enerji ve anksiyete birlikte değişiyor - dengeleme gerekli';
      severity = 'medium';
      suggestion = 'Sakinleştirici aktiviteler (meditasyon, yavaş nefes) ile dengeyi koruyun';
    }
    // Moderate correlations = balanced
    else if (Math.abs(moodEnergyCorr) < 0.4 && Math.abs(moodAnxietyCorr) < 0.4) {
      profileType = 'balanced';
      profileTitle = 'Dengeli Duygusal Profil';
      profileDescription = 'Duygu durumların bağımsız ve dengeli - sağlıklı bir pattern';
      severity = 'low';
      suggestion = 'Bu dengeyi korumaya devam et, mindfulness pratiği yapabilirsin';
    }
    else {
      profileType = 'unstable';
      profileTitle = 'Değişken Duygusal Durum';
      profileDescription = 'Duygu durumlarında düzensiz değişimler var';
      severity = 'medium';
      suggestion = 'Düzenli mood takibi ile pattern\'leri gözlemle ve sakinleştirici rutinler geliştir';
    }

    patterns.push({
      type: 'mea_correlation',
      title: profileTitle,
      description: profileDescription,
      confidence: Math.min(0.9, entries.length * 0.05),
      severity,
      actionable: profileType !== 'optimal',
      suggestion,
      source: 'heuristic',
      data: {
        profileType,
        correlations: {
          moodEnergy: Number(moodEnergyCorr.toFixed(3)),
          moodAnxiety: Number(moodAnxietyCorr.toFixed(3)),
          energyAnxiety: Number(energyAnxietyCorr.toFixed(3))
        },
        averages: {
          mood: Number((moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)),
          energy: Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)),
          anxiety: Number((anxieties.reduce((a, b) => a + b, 0) / anxieties.length).toFixed(1))
        },
        sampleSize: entries.length
      }
    });

    return patterns;
  };

  // ✨ PROGRESSIVE UI: Merge heuristic and AI patterns
  const mergeHeuristicAndAIPatterns = (heuristicPatterns: any[], aiPatterns: any[]): any[] => {
    const merged: any[] = [];
    
    // Add all AI patterns (they have priority)
    aiPatterns.forEach(aiPattern => {
      merged.push({ ...aiPattern, source: 'ai', updated: true });
    });
    
    // Add heuristic patterns that don't overlap with AI patterns
    heuristicPatterns.forEach(heuristic => {
      const hasAISimilar = aiPatterns.some(ai => 
        ai.type === heuristic.type && 
        ai.title.includes(heuristic.title.split(' ')[0])
      );
      
      if (!hasAISimilar) {
        merged.push({ ...heuristic, source: 'heuristic' });
      }
    });
    
    return merged;
  };

  const loadMoodEntries = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // 🌍 TIMEZONE-AWARE: Get extended period to ensure we capture all entries 
      // then filter by user's timezone to prevent edge cases
      const extendedPeriodDays = selectedTimeRange === 'today' ? 2 : 
                                selectedTimeRange === 'week' ? 10 : 35;
      
      // 🔄 Use intelligent merge service to get extended range
      const rawEntries = await moodTracker.getMoodEntries(user.id, extendedPeriodDays);
      
      // Map service MoodEntry to screen MoodEntry format
      const allEntries = (rawEntries || []).map(entry => ({
        id: entry.id,
        mood_score: entry.mood_score,
        energy_level: entry.energy_level,
        anxiety_level: entry.anxiety_level,
        notes: entry.notes || '',
        trigger: entry.triggers && entry.triggers.length > 0 ? entry.triggers[0] : undefined,
        created_at: entry.timestamp,
        user_id: entry.user_id
      }));
      
      // 🌍 TIMEZONE-AWARE: Filter entries by selected time range in user's timezone
      const { filterEntriesByUserTimeRange } = require('@/utils/timezoneUtils');
      const filteredEntries = filterEntriesByUserTimeRange(allEntries, selectedTimeRange);
      
      setMoodEntries(filteredEntries);
    } catch (error) {
      console.error('Failed to load mood entries:', error);
      setToastMessage('Mood kayıtları yüklenemedi');
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMoodEntries();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  };

    // ✅ REMOVED: analyzeMoodPatterns function moved to dashboard

    // ✅ REMOVED: runPredictiveMoodIntervention function moved to dashboard

  // ✅ MOVED TO DASHBOARD: Helper functions moved to UserCentricMoodDashboard

  // Helper function to get mood color based on score
  const getMoodColor = (score: number): string => {
    if (score >= 90) return '#EC4899'; // Heyecanlı
    if (score >= 80) return '#8B5CF6'; // Enerjik
    if (score >= 70) return '#10B981'; // Mutlu
    if (score >= 60) return '#06B6D4'; // Sakin
    if (score >= 50) return '#84CC16'; // Normal
    if (score >= 40) return '#EAB308'; // Endişeli
    if (score >= 30) return '#F97316'; // Sinirli
    if (score >= 20) return '#3B82F6'; // Üzgün
    return '#EF4444'; // Kızgın
  };

  // Helper function to get mood label based on score
  const getMoodLabel = (score: number): string => {
    if (score >= 90) return 'Heyecanlı';
    if (score >= 80) return 'Enerjik';
    if (score >= 70) return 'Mutlu';
    if (score >= 60) return 'Sakin';
    if (score >= 50) return 'Normal';
    if (score >= 40) return 'Endişeli';
    if (score >= 30) return 'Sinirli';
    if (score >= 20) return 'Üzgün';
    return 'Kızgın';
  };

  // 🧪 DEBUG: Test mood data flow
  const handleMoodDebugTest = async () => {
    if (!user?.id) return;
    
    // Open modal and start testing
    setShowMoodDebug(true);
    setDebugReport({ status: 'testing', message: 'Running mood data flow test...' });
    
    try {
      const report = await moodDataFlowTester.runCompleteTest(user.id);
      const summary = await moodDataFlowTester.getMoodDataSummary(user.id);
      
      setDebugReport({
        status: 'completed',
        report,
        summary,
        timestamp: Date.now()
      });
      
      console.log('🧪 Mood data flow test completed:', report);
      
    } catch (error) {
      setDebugReport({
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });
      console.error('🚨 Mood debug test failed:', error);
    }
  };

  const handleQuickEntry = async (data: {
    mood: number;
    energy: number;
    anxiety: number;
    notes: string;
    trigger?: string;
  }) => {
    if (!user?.id) return;

    try {
      // 🔄 EDIT MODE: Handle updating existing entries
      if (editingEntry) {
        console.log('✏️ Updating existing mood entry:', editingEntry.id);
        
        // Add to sync queue for UPDATE operation
        await offlineSyncService.addToSyncQueue({
          type: 'UPDATE',
          entity: 'mood_entry',
          data: {
            id: editingEntry.id,
            user_id: user.id,
            mood_score: data.mood,
            energy_level: data.energy,
            anxiety_level: data.anxiety,
            notes: data.notes,
            triggers: data.trigger ? [data.trigger] : [],
            activities: [],
            timestamp: (editingEntry as any).created_at || (editingEntry as any).timestamp, // Preserve original timestamp
            updated_at: new Date().toISOString(),
          },
          priority: 'high' as any,
        });
        
        // Update local state immediately for optimistic UI
        setMoodEntries(prev => prev.map(entry => 
          entry.id === editingEntry.id 
            ? {
                ...entry,
                mood_score: data.mood,
                energy_level: data.energy,
                anxiety_level: data.anxiety,
                notes: data.notes,
                triggers: data.trigger ? [data.trigger] : [],
              }
            : entry
        ));
        
        setToastMessage('Mood kaydı güncellendi ✏️');
        setShowToast(true);
        setShowQuickEntry(false);
        setEditingEntry(null); // Clear editing state
        
        // Haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      // 🔄 FIXED: Use moodTracker for consistent table handling (mood_entries canonical table)
      const moodEntry = {
        user_id: user.id,
        mood_score: data.mood,
        energy_level: data.energy,
        anxiety_level: data.anxiety,
        notes: data.notes,
        triggers: data.trigger ? [data.trigger] : [], // Convert single trigger to array format
        activities: [], // Not collected in this interface yet
        sync_attempts: 0
      };

      // 🚀 UNIFIED MOOD JOURNALING ANALYSIS
      let journalAnalysis = null;
      if (data.notes && data.notes.trim().length > 10) {
        try {
          console.log('🚀 Analyzing mood journal entry with UnifiedAIPipeline...');
          
          const analysisResult = await pipeline.process({
            userId: user.id,
            type: 'voice', // Journal notes treated as voice input for sentiment analysis
            content: data.notes,
            context: {
              source: 'mood',
              timestamp: Date.now(),
              metadata: {
                existingMoodScore: data.mood,
                energyLevel: data.energy,
                anxietyLevel: data.anxiety,
                trigger: data.trigger,
                dataType: 'mood_journal_analysis',
                contextualAnalysis: true
              }
            }
          });
          
          // Format analysis result for compatibility
          journalAnalysis = {
            sentiment: (analysisResult as any)?.voice?.sentiment || 'neutral',
            emotions: (analysisResult as any)?.voice?.emotions || [],
            triggers: (analysisResult as any)?.voice?.triggers || [],
            insights: analysisResult?.insights || [],
            confidence: (analysisResult as any)?.voice?.confidence || 0.5,
            suggestion: (analysisResult as any)?.suggestion || 'Mood kaydınız başarıyla analiz edildi'
          };
          
          console.log('📊 Unified journal analysis completed:', journalAnalysis);
        } catch (analysisError) {
          console.error('⚠️ Unified journal analysis failed:', analysisError);
          // Continue with entry save even if analysis fails
        }
      }

      // 🔄 Save via moodTracker for intelligent sync + consistent table usage
      const savedEntry = await moodTracker.saveMoodEntry(moodEntry);
      
      // 🔄 FIXED: Trigger cache invalidation after mood entry save
      try {
        await pipeline.triggerInvalidation('mood_added', user.id);
        console.log('🔄 Cache invalidated after mood entry: patterns + insights + progress');
      } catch (invalidationError) {
        console.warn('⚠️ Cache invalidation failed (non-critical):', invalidationError);
        // Don't block the user flow if cache invalidation fails
      }

      // 💾 PATTERN PERSISTENCE: Invalidate pattern cache after new entry
      try {
        await patternPersistenceService.invalidateCache(user.id);
        console.log('💾 Pattern cache invalidated after mood entry save');
        
        // 📊 TELEMETRY: Track cache invalidation
        await trackAIInteraction(AIEventType.PATTERN_CACHE_INVALIDATED, {
          userId: user.id,
          reason: 'mood_entry_added',
          timestamp: Date.now()
        });
        
      } catch (patternCacheError) {
        console.warn('⚠️ Pattern cache invalidation failed (non-blocking):', patternCacheError);
      }
      
      // 🎮 MOOD GAMIFICATION & ACHIEVEMENT TRACKING
      let gamificationResult = null;
      let pointsEarned = 0;
      let achievements: any[] = [];
      
      try {
        console.log('🎮 Calculating mood points and achievements...');
        
        // Get user's mood history for point calculation
        // 🔄 Use intelligent merge service for gamification history
        const userHistory = await moodTracker.getMoodEntries(user.id, 30); // Last 30 days
        
        // Calculate mood points using unified gamification service
        const moodEntryForPoints = {
          id: `temp_${Date.now()}`,
          user_id: user.id,
          mood_score: data.mood,
          energy_level: data.energy,
          anxiety_level: data.anxiety,
          notes: data.notes,
          trigger: data.trigger,
          timestamp: new Date().toISOString(),
          synced: false,
          sync_attempts: 0,
          triggers: data.trigger ? [data.trigger] : [],
          activities: []
        };
        
        const pointsResult = await unifiedGamificationService.awardUnifiedPoints(
          user.id,
          'mood_entry',
          {
            mood_score: data.mood,
            energy_level: data.energy,
            anxiety_level: data.anxiety,
            trigger: data.trigger
          },
          {
            moodEntry: moodEntryForPoints
          }
        );
        pointsEarned = pointsResult.totalPoints;
        
        // Check for mood-specific achievements (implemented in unified service)
        const achievementsList: any[] = []; // Achievements are handled internally by unified service
        achievements = achievementsList;
        
        // Track activity in main achievement service
        // Note: extending trackActivity to support 'mood' type would require service update
        // For now, we'll track it generically
        
        gamificationResult = {
          points: pointsEarned,
          achievements,
          breakdown: pointsResult.breakdown
        };
        
        console.log('🎮 Gamification completed:', gamificationResult);
        
        // ✅ YENİ: Streak güncelle
        try {
          await useGamificationStore.getState().updateStreak();
          console.log('✅ Streak updated after mood entry');
        } catch (streakError) {
          console.error('⚠️ Streak update failed:', streakError);
        }
        
      } catch (gamificationError) {
        console.error('⚠️ Mood gamification failed:', gamificationError);
        // Continue with entry save even if gamification fails
      }
      
      // Show enhanced feedback based on analysis and gamification
      let toastMsg = 'Mood kaydı oluşturuldu ✅';
      if (pointsEarned > 0) {
        toastMsg += ` 🎯 +${pointsEarned} puan kazandınız!`;
      }
      if (achievements.length > 0) {
        toastMsg += ` 🏆 ${achievements.length} rozet açıldı!`;
      }
      if (journalAnalysis?.insights) {
        const insightCount = journalAnalysis.insights.suggestions.length;
        if (insightCount > 0) {
          toastMsg += ` 📊 ${insightCount} insight`;
        }
      }
      
      setToastMessage(toastMsg);
      setShowToast(true);
      setShowQuickEntry(false);
      
      // Reload entries
      await loadMoodEntries();
      
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save mood entry:', error);
      
      // Add to offline queue
      try {
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: user.id,
            mood_score: data.mood,
            energy_level: data.energy,
            anxiety_level: data.anxiety,
            notes: data.notes,
            trigger: data.trigger,
            created_at: new Date().toISOString(),
          },
        });
        
        setToastMessage('Mood kaydı offline kaydedildi 📱');
        setShowToast(true);
        setShowQuickEntry(false);
        setEditingEntry(null); // Clear editing state
      } catch (syncError) {
        setToastMessage('Kayıt oluşturulamadı');
        setShowToast(true);
      }
    }
  };

  const handleEditEntry = async (entry: MoodEntry) => {
    try {
      console.log('✏️ Editing mood entry:', entry.id);
      
      // Find the entry in current list
      const currentEntry = moodEntries.find(e => e.id === entry.id);
      if (!currentEntry) {
        setToastMessage('Kayıt bulunamadı');
        setShowToast(true);
        return;
      }

      // Set the entry to be edited and show the form
      setEditingEntry(currentEntry);
      setShowQuickEntry(true);
      
      setToastMessage('Düzenleme formu açılıyor...');
      setShowToast(true);

      // Track edit action
      await trackAIInteraction('MOOD_ENTRY_EDIT', {
        entryId: entry.id,
        mood: entry.mood_score,
        energy: entry.energy_level,
        anxiety: entry.anxiety_level
      });

    } catch (error) {
      console.error('❌ Failed to edit entry:', error);
      setToastMessage('Düzenleme başlatılamadı');
      setShowToast(true);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      console.log('🗑️ Deleting mood entry:', entryId);

      // Confirm delete with user
      Alert.alert(
        'Kaydı Sil',
        'Bu mood kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        [
          {
            text: 'İptal',
            style: 'cancel',
          },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              try {
                const entryToDelete = moodEntries.find(e => e.id === entryId);
                if (!entryToDelete) {
                  setToastMessage('Kayıt bulunamadı');
                  setShowToast(true);
                  return;
                }

                // Track delete action before deletion
                await trackAIInteraction('MOOD_ENTRY_DELETE', {
                  entryId: entryId,
                  mood: entryToDelete.mood_score,
                  energy: entryToDelete.energy_level,
                  anxiety: entryToDelete.anxiety_level
                });

                if (user) {
                  // 🔄 CRITICAL FIX: Remote-First Deletion for Intelligent Merge
                  console.log('🌐 DELETION FLOW: Remote → Local (prevents intelligent merge restore)');
                  
                  try {
                    // 🟢 STEP 1: Delete from REMOTE first (prevents intelligent merge restore)
                    console.log('🌐 Step 1: Deleting from remote server...');
                    await supabaseService.deleteMoodEntry(entryId);
                    console.log('✅ Remote deletion successful - intelligent merge safe');

                  } catch (serverError) {
                    console.warn('⚠️ Remote deletion failed, using PRIORITY sync queue:', serverError);
                    
                    // 🚨 PRIORITY SYNC: Add to front of queue for immediate retry
                    if (UUID_REGEX.test(entryId)) {
                      await offlineSyncService.addToSyncQueue({
                        type: 'DELETE',
                        entity: 'mood_entry',
                        data: {
                          id: entryId,
                          user_id: user.id,
                          priority: 'high', // High priority for deletions
                          deleteReason: 'user_initiated' // Track deletion reason
                        }
                      });
                      console.log('📤 Added to HIGH PRIORITY delete queue');
                      
                      // 🔥 IMMEDIATE PROCESSING: Try to sync deletion right away
                      try {
                        console.log('⚡ Triggering immediate sync queue processing...');
                        await offlineSyncService.processSyncQueue();
                        console.log('🔥 Immediate sync queue processing completed');
                      } catch (immediateError) {
                        console.warn('⚠️ Immediate sync failed, will retry later:', immediateError);
                      }
                      
                      try {
                        await trackAIInteraction(AIEventType.DELETE_QUEUED_OFFLINE, {
                          entity: 'mood_entry', id: entryId, userId: user.id, priority: 'high'
                        }, user.id);
                      } catch {}
                    } else {
                      console.log('⏭️ Skipping remote queue for local-only ID:', entryId);
                    }
                  }

                  // Delete from local service
                  await moodTracker.deleteMoodEntry(entryId);
                  console.log('✅ Mood entry deleted from local storage');

                  // 🗑️ MARK AS DELETED: Prevent IntelligentMerge from restoring
                  await moodDeletionCache.markAsDeleted(entryId, user.id, 'user_initiated');
                  console.log('✅ Entry marked as deleted in cache - IntelligentMerge will ignore');

                  // 🔍 DEBUG: Verify deletion worked
                  console.log(`🔍 Verifying deletion of entry: ${entryId}`);
                  
                  // Remove from current state immediately
                  setMoodEntries(prev => {
                    const filtered = prev.filter(entry => entry.id !== entryId);
                    console.log(`🔍 UI state updated: ${prev.length} -> ${filtered.length} entries`);
                    return filtered;
                  });

                  // Show success message
                  setToastMessage('Mood kaydı silindi');
                  setShowToast(true);

                  // Haptic feedback
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                  // 🔄 DELAY: Give time for deletion to propagate before refresh
                  console.log('⏳ Waiting for deletion to propagate...');
                  await new Promise(resolve => setTimeout(resolve, 500));

                  // 🔍 DEBUG: Check LOCAL storage only (bypass intelligent merge)
                  try {
                    console.log('🔍 Verifying deletion in local storage only...');
                    const localOnlyExists = await moodTracker.checkEntryExistsInLocalStorage(entryId);
                    console.log(`🔍 Local storage check: Entry ${entryId} still exists: ${localOnlyExists}`);
                    
                    if (localOnlyExists) {
                      console.error('❌ DELETION BUG: Entry still exists in local storage after deletion!');
                      // Try to delete again with force flag
                      console.log('🔄 Attempting FORCE deletion...');
                      await moodTracker.forceDeleteMoodEntry(entryId);
                    } else {
                      console.log('✅ Entry successfully removed from local storage');
                    }
                  } catch (checkError) {
                    console.warn('⚠️ Could not verify local deletion:', checkError);
                  }

                  // Trigger refresh to update any dependent data
                  await loadMoodEntries();

                  // 💾 PATTERN PERSISTENCE: Invalidate pattern cache after entry deletion
                  try {
                    await patternPersistenceService.invalidateCache(user.id);
                    console.log('💾 Pattern cache invalidated after mood entry deletion');
                    
                    // 📊 TELEMETRY: Track cache invalidation for delete
                    await trackAIInteraction(AIEventType.PATTERN_CACHE_INVALIDATED, {
                      userId: user.id,
                      reason: 'mood_entry_deleted',
                      entryId: entryId,
                      timestamp: Date.now()
                    });
                    
                  } catch (patternCacheError) {
                    console.warn('⚠️ Pattern cache invalidation failed after delete (non-blocking):', patternCacheError);
                  }

                } else {
                  // 📱 OFFLINE MODE: Local deletion + Queue for later remote sync
                  console.log('📱 DELETION FLOW: Offline mode - Local → Queue');
                  
                  // Queue remote deletion for when connection returns
                  if (UUID_REGEX.test(entryId)) {
                    await offlineSyncService.addToSyncQueue({
                      type: 'DELETE',
                      entity: 'mood_entry',
                      data: {
                        id: entryId,
                        user_id: user.id,
                        priority: 'high',
                        deleteReason: 'user_initiated_offline'
                      }
                    });
                    console.log('📤 Added offline deletion to priority queue');
                  }
                  
                  // Remove from local storage
                  await moodTracker.deleteMoodEntry(entryId);
                  
                  // 🗑️ MARK AS DELETED: Prevent IntelligentMerge from restoring (offline mode)
                  await moodDeletionCache.markAsDeleted(entryId, user.id, 'user_initiated_offline');
                  console.log('✅ Entry marked as deleted in cache (offline mode)');
                  
                  // Remove from UI state immediately
                  setMoodEntries(prev => prev.filter(entry => entry.id !== entryId));
                  
                  setToastMessage('Mood kaydı offline silindi (senkronizasyon bekliyor)');
                  setShowToast(true);

                  // 💾 PATTERN PERSISTENCE: Invalidate pattern cache after offline deletion
                  try {
                    await patternPersistenceService.invalidateCache(user.id);
                    console.log('💾 Pattern cache invalidated after offline mood entry deletion');
                    
                    // 📊 TELEMETRY: Track cache invalidation for offline delete
                    await trackAIInteraction(AIEventType.PATTERN_CACHE_INVALIDATED, {
                      userId: user.id,
                      reason: 'mood_entry_deleted_offline',
                      entryId: entryId,
                      timestamp: Date.now()
                    });
                    
                  } catch (patternCacheError) {
                    console.warn('⚠️ Pattern cache invalidation failed after offline delete (non-blocking):', patternCacheError);
                  }
                }

              } catch (deleteError) {
                console.error('❌ Failed to delete mood entry:', deleteError);
                setToastMessage('Kayıt silinemedi');
                setShowToast(true);
              }
            },
          },
        ],
        { cancelable: true }
      );

    } catch (error) {
      console.error('❌ Failed to initiate delete:', error);
      setToastMessage('Silme işlemi başlatılamadı');
      setShowToast(true);
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    if (moodEntries.length === 0) {
      return {
        avgMood: 0,
        avgEnergy: 0,
        avgAnxiety: 0,
        totalEntries: 0,
        trend: 'stable' as 'up' | 'down' | 'stable',
      };
    }

    const avgMood = moodEntries.reduce((sum, e) => sum + e.mood_score, 0) / moodEntries.length;
    const avgEnergy = moodEntries.reduce((sum, e) => sum + e.energy_level, 0) / moodEntries.length;
    const avgAnxiety = moodEntries.reduce((sum, e) => sum + e.anxiety_level, 0) / moodEntries.length;

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (moodEntries.length >= 2) {
      const recent = moodEntries.slice(0, Math.ceil(moodEntries.length / 2));
      const older = moodEntries.slice(Math.ceil(moodEntries.length / 2));
      
      const recentAvg = recent.reduce((sum, e) => sum + e.mood_score, 0) / recent.length;
      const olderAvg = older.reduce((sum, e) => sum + e.mood_score, 0) / older.length;
      
      trend = recentAvg > olderAvg + 5 ? 'up' : 
              recentAvg < olderAvg - 5 ? 'down' : 'stable';
    }

    return { 
      avgMood: Math.round(avgMood), 
      avgEnergy: Math.round(avgEnergy), 
      avgAnxiety: Math.round(avgAnxiety),
      totalEntries: moodEntries.length, 
      trend 
    };
  };

  const stats = calculateStats();

  // 🔒 RISK ASSESSMENT: Enhanced prediction with riskAssessmentService integration
  const generateRiskAssessment = async (entries: MoodEntry[], patterns: any[], predictiveInsights: any) => {
    try {
      // 🚫 EARLY EXIT: Check feature flag
      if (!FEATURE_FLAGS.isEnabled('AI_RISK_ASSESSMENT')) {
        console.log('🚫 Risk assessment disabled, using fallback prediction');
        return {
          riskLevel: predictiveInsights?.riskLevel || 'low',
          earlyWarning: predictiveInsights?.earlyWarning || undefined,
          interventions: predictiveInsights?.interventions || [],
          recommendation: predictiveInsights?.earlyWarning?.message || 'Mood takibine devam et, her şey yolunda görünüyor.'
        };
      }

      if (entries.length < 3) {
        console.log('📊 Insufficient data for risk assessment, using basic prediction');
        return {
          riskLevel: 'low' as const,
          earlyWarning: undefined,
          interventions: [],
          recommendation: 'Daha fazla mood kaydı yapmana gerek var. En az 3 kayıt sonrasında risk değerlendirmesi yapabiliriz.'
        };
      }

      // 🔄 RISK ASSESSMENT SERVICE INTEGRATION
      // Create user profile from mood data
      const avgMood = entries.reduce((sum, e) => sum + e.mood_score, 0) / entries.length;
      const avgEnergy = entries.reduce((sum, e) => sum + e.energy_level, 0) / entries.length;
      const avgAnxiety = entries.reduce((sum, e) => sum + e.anxiety_level, 0) / entries.length;

      const userProfile = {
        userId: user?.id || 'anonymous',
        demographics: {
          ageGroup: 'adult', // Default - could be enhanced with actual data
          culturalBackground: 'turkish'
        },
        therapeuticProfile: {
          currentMoodLevel: avgMood,
          energyLevel: avgEnergy,
          anxietyLevel: avgAnxiety,
          stressLevel: Math.min(10, Math.max(1, Math.round(avgAnxiety))),
          copingSkills: avgMood > 60 ? 'good' : avgMood > 40 ? 'moderate' : 'needs_improvement'
        },
        moodHistory: entries.slice(0, 30).map(entry => ({
          timestamp: (entry as any).created_at || (entry as any).timestamp,
          moodScore: entry.mood_score,
          energyLevel: entry.energy_level,
          anxietyLevel: entry.anxiety_level,
          triggers: (entry as any).triggers || []
        }))
      };

      // Mock Y-BOCS data (array format matching YBOCSAnswer[])
      const ybocsData = Array.from({ length: 10 }, (_, i) => ({
        questionId: `ybocs_${i + 1}`,
        questionText: `Y-BOCS Question ${i + 1}`,
        response: Math.max(0, Math.min(4, Math.round((10 - avgMood/10) * 4 / 10))), // 0-4 scale
        severity: Math.max(0, Math.min(4, Math.round((10 - avgMood/10) * 4 / 10))),
        timestamp: new Date(),
        value: Math.max(0, Math.min(4, Math.round((10 - avgMood/10) * 4 / 10))),
        questionType: i < 5 ? 'obsessions' : 'compulsions'
      }));

      // Cultural context
      const culturalContext = {
        region: 'turkey',
        language: 'tr',
        collectivistic: true,
        familySupport: 'high', // Default assumption
        stigmaLevel: 'moderate'
      };

      // 🚀 CALL RISK ASSESSMENT SERVICE
      console.log('🛡️ Calling advanced risk assessment service...');
      const riskAssessment = await advancedRiskAssessmentService.assessInitialRisk(
        userProfile as any,
        ybocsData,
        culturalContext as any,
        { patterns, predictiveInsights }
      );

      console.log('✅ Risk assessment completed:', riskAssessment);

      // 🔄 MAP RISK ASSESSMENT TO UI FORMAT
      const mapRiskLevel = (level: string): 'high' | 'medium' | 'low' => {
        if (level === 'high' || level === 'severe' || level === 'critical') return 'high';
        if (level === 'moderate' || level === 'medium') return 'medium';
        return 'low';
      };

      const interventions = riskAssessment.immediateActions?.map((action: any) => ({
        type: (action.priority === 'urgent' || action.priority === 'critical') ? 'immediate' : 
              (action.type === 'preventive' || action.category === 'preventive') ? 'preventive' : 'supportive',
        action: action.description || action.title || action.action || 'Önerilen aksiyon'
      })) || [];

      return {
        riskLevel: mapRiskLevel(riskAssessment.immediateRisk?.toString() || 'low'),
        earlyWarning: riskAssessment.immediateRisk === true ? {
          triggered: true,
          message: riskAssessment.immediateActions?.[0]?.description || 
                   'Dikkat gerektiren mood değişiklikleri tespit edildi.'
        } : undefined,
        interventions: interventions,
        recommendation: (riskAssessment.immediateActions?.[0] as any)?.description ||
                       (riskAssessment.monitoringPlan as any)?.summary ||
                       (riskAssessment.monitoringPlan as any)?.guidelines ||
                       'Mood takibine devam et, risk seviyesi kontrol altında.'
      };

    } catch (error) {
      console.error('❌ Risk assessment service failed:', error);
      // Fallback to simple prediction
      return {
        riskLevel: predictiveInsights?.riskLevel || 'low',
        earlyWarning: predictiveInsights?.earlyWarning || undefined,
        interventions: predictiveInsights?.interventions || [],
        recommendation: predictiveInsights?.earlyWarning?.message || 'Mood takibine devam et, her şey yolunda görünüyor.'
      };
    }
  };

  // 🛡️ BACKGROUND: Load risk assessment asynchronously
  useEffect(() => {
    if (moodEntries.length >= 3 && user?.id) {
      const loadRiskAssessment = async () => {
        try {
          const riskData = await generateRiskAssessment(moodEntries, moodPatterns, predictiveInsights);
          setRiskAssessmentData(riskData);
          console.log('✅ Risk assessment loaded in background:', riskData);
        } catch (error) {
          console.error('❌ Background risk assessment failed:', error);
        }
      };

      // Debounce to avoid excessive calls
      const timeoutId = setTimeout(loadRiskAssessment, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [moodEntries.length, moodPatterns.length, predictiveInsights, user?.id]);

  // generateMoodJourneyData function removed with dashboard



  const getFilteredEntries = () => {
    return moodEntries.slice(0, displayLimit);
  };

  const filteredEntries = getFilteredEntries();

  return (
    <ScreenLayout>
      {/* Header - Matching OCD Design */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Mood Takibi</Text>
          <View style={styles.headerRight}>
            {/* 🧪 DEBUG: Mood Data Flow Test Button (Dev only) */}
            {(__DEV__ || process.env.NODE_ENV === 'development') && (
              <Pressable 
                style={[styles.debugButton, { marginRight: 12 }]}
                onPress={handleMoodDebugTest}
              >
                <MaterialCommunityIcons name="bug" size={20} color="#FF6B35" />
              </Pressable>
            )}

          </View>
        </View>
        
        {/* Time Range Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('today');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'today' && styles.tabTextActive]}>
              Bugün
            </Text>
            {selectedTimeRange === 'today' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('week');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'week' && styles.tabTextActive]}>
              Hafta
            </Text>
            {selectedTimeRange === 'week' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('month');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'month' && styles.tabTextActive]}>
              Ay
            </Text>
            {selectedTimeRange === 'month' && <View style={styles.tabIndicator} />}
          </Pressable>
        </View>
      </View>


      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#EC4899"
          />
        }
      >
        {/* 🎯 ADAPTIVE SUGGESTION CARD (Cross-Module) */}
        {adaptiveSuggestion?.show && (
          <AdaptiveSuggestionCard
            suggestion={adaptiveSuggestion}
            onAccept={async () => {
              if (!user?.id || !adaptiveSuggestion?.cta) return;
              await trackSuggestionClick(user.id, adaptiveSuggestion);
              router.push(adaptiveSuggestion.cta.screen, adaptiveSuggestion.cta.params);
              setAdaptiveSuggestion(null);
              setAdaptiveMeta(null);
            }}
            onDismiss={async () => {
              if (!user?.id) return;
              await trackSuggestionDismissal(user.id, adaptiveSuggestion);
              setAdaptiveSuggestion(null);
              setAdaptiveMeta(null);
            }}
            meta={adaptiveMeta}
            style={{ marginHorizontal: 16, marginBottom: 16 }}
          />
        )}

        {/* Date Display */}
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('tr-TR', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>


        {/* ✅ MOVED TO DASHBOARD: Spectrum, Patterns, Prediction features now in UserCentricMoodDashboard */}



        {/* Mood Entries List - Matching OCD Design */}
        <View style={styles.listSection}>

          {filteredEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="emoticon-sad-outline" size={48} color="#E5E7EB" />
              <Text style={styles.emptyText}>Henüz mood kaydı yok</Text>
              <Text style={styles.emptySubtext}>
                Aşağıdaki + butonuna tıklayarak ilk kaydınızı oluşturun
              </Text>
            </View>
          ) : (
            <View style={styles.recordingsContainer}>
              {filteredEntries.map((entry) => {
                const moodColor = entry.mood_score >= 70 ? '#10B981' : 
                                 entry.mood_score >= 40 ? '#F59E0B' : '#EF4444';
                
                return (
                  <View key={entry.id} style={styles.recordingCard}>
                    <View style={styles.recordingContent}>
                      <View style={styles.recordingHeader}>
                        <View style={styles.recordingInfo}>
                          <MaterialCommunityIcons 
                            name="emoticon-outline" 
                            size={20} 
                            color={moodColor} 
                          />
                          <Text style={styles.recordingTime}>
                            {new Date(entry.created_at).toLocaleTimeString('tr-TR', { 
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </Text>
                        </View>
                        <View style={styles.recordingScores}>
                          <Text style={[styles.moodScore, { color: moodColor }]}>
                            {entry.mood_score}/100
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.recordingMetrics}>
                        <View style={styles.metricItem}>
                          <MaterialCommunityIcons name="lightning-bolt" size={14} color="#F59E0B" />
                          <Text style={styles.metricValue}>Enerji: {entry.energy_level}</Text>
                        </View>
                        <View style={styles.metricItem}>
                          <MaterialCommunityIcons name="heart-pulse" size={14} color="#3B82F6" />
                          <Text style={styles.metricValue}>Anksiyete: {entry.anxiety_level}</Text>
                        </View>
                      </View>
                      
                      {entry.notes && (
                        <Text style={styles.recordingNotes} numberOfLines={2}>
                          {entry.notes}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleDeleteEntry(entry.id);
                      }}
                      style={styles.deleteIcon}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color="#9CA3AF" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Show More Button */}
          {filteredEntries.length > 0 && moodEntries.length > displayLimit && (
            <View style={styles.showMoreContainer}>
              <Pressable
                style={styles.showMoreButton}
                onPress={() => {
                  setDisplayLimit(prev => prev + 5);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.showMoreText}>Daha Fazla Göster</Text>
              </Pressable>
            </View>
          )}
        </View>
        
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* FAB - Floating Action Button */}
      <FAB 
        icon="plus" 
        onPress={() => {
          setShowQuickEntry(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        position="fixed"
        backgroundColor="#EC4899"
      />

      {/* Quick Entry Modal */}
      <MoodQuickEntry
        visible={showQuickEntry}
        onClose={() => {
          setShowQuickEntry(false);
          setEditingEntry(null); // Clear editing state when closing
        }}
        onSubmit={handleQuickEntry}
        editingEntry={editingEntry as any}
        initialData={params.prefill === 'true' ? {
          mood: params.mood ? Number(params.mood) : 50,
          energy: params.energy ? Number(params.energy) : 5,
          anxiety: params.anxiety ? Number(params.anxiety) : 5,
          notes: params.text as string || '',
          trigger: params.trigger as string || ''
        } : undefined}
      />

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
        type={toastMessage.includes('✅') ? 'success' : 'info'}
      />

      {/* 🧪 DEBUG: Mood Data Flow Report Modal */}
      {debugReport && (
        <Modal
          visible={showMoodDebug}
          transparent
          animationType="slide"
        >
          <View style={styles.debugModalOverlay}>
            <View style={styles.debugModalContainer}>
              <View style={styles.debugModalHeader}>
                <Text style={styles.debugModalTitle}>🧪 Mood Data Flow Test</Text>
                <Pressable 
                  style={styles.debugModalClose}
                  onPress={() => setShowMoodDebug(false)}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#666" />
                </Pressable>
              </View>
              
              <ScrollView style={styles.debugModalContent}>
                {debugReport.status === 'testing' && (
                  <Text style={styles.debugTestingText}>🔄 {debugReport.message}</Text>
                )}
                
                {debugReport.status === 'error' && (
                  <View style={styles.debugErrorContainer}>
                    <Text style={styles.debugErrorTitle}>❌ Test Failed</Text>
                    <Text style={styles.debugErrorText}>{debugReport.error}</Text>
                  </View>
                )}
                
                {debugReport.status === 'completed' && debugReport.report && (
                  <View style={styles.debugReportContainer}>
                    <Text style={styles.debugSectionTitle}>📊 Test Results</Text>
                    {Object.entries(debugReport.report.results).map(([key, value]) => (
                      <View key={key} style={styles.debugResultRow}>
                        <Text style={styles.debugResultLabel}>
                          {value ? '✅' : '❌'} {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </Text>
                      </View>
                    ))}
                    
                    {debugReport.summary && (
                      <View style={styles.debugSummaryContainer}>
                        <Text style={styles.debugSectionTitle}>📈 Data Summary</Text>
                        <Text style={styles.debugSummaryText}>
                          Total Entries: {debugReport.summary.totalEntries}
                        </Text>
                        <Text style={styles.debugSummaryText}>
                          Cache Keys: {debugReport.summary.cacheKeys.length}
                        </Text>
                        {debugReport.summary.lastEntry && (
                          <Text style={styles.debugSummaryText}>
                            Last Entry: {new Date(debugReport.summary.lastEntry.timestamp || debugReport.summary.lastEntry.created_at).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                    )}
                    
                    {debugReport.report.recommendations.length > 0 && (
                      <View style={styles.debugRecommendationsContainer}>
                        <Text style={styles.debugSectionTitle}>💡 Recommendations</Text>
                        {debugReport.report.recommendations.map((rec, index) => (
                          <Text key={index} style={styles.debugRecommendationText}>
                            • {rec}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Mood Dashboard removed */}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  visualModeSelector: {
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modeButtonActive: {
    backgroundColor: '#7C9885',
    borderColor: '#7C9885',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  wheelContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  wheelHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  wheelDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  wheelInfo: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  wheelInfoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  wheelLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
  },
  
  // Header Styles
  headerContainer: {
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
    alignItems: 'center',
  },
  
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  tabTextActive: {
    color: '#EC4899',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#EC4899',
  },
  
  // Date Display
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: 'Inter',
  },
  

  
  // ✅ REMOVED: Predictive mood intervention styles moved to dashboard
  
  // ✅ REMOVED: Spectrum, monthly view styles moved to dashboard
  
  // List Section Styles
  listSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // Recording Cards Styles
  recordingsContainer: {
    gap: 12,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recordingContent: {
    flex: 1,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  recordingScores: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodScore: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  recordingMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  recordingNotes: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  deleteIcon: {
    padding: 8,
    marginLeft: 8,
  },
  
  // Show More Button
  showMoreContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  showMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },

  // ✅ REMOVED: Pattern analysis styles moved to dashboard

  // 🧪 DEBUG: Mood Data Flow Debug Styles
  debugButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FFF5F5',
  },
  debugModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  debugModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  debugModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  debugModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  debugModalClose: {
    padding: 4,
  },
  debugModalContent: {
    padding: 16,
  },
  debugTestingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  debugErrorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  debugErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },
  debugErrorText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  debugReportContainer: {
    marginBottom: 16,
  },
  debugSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    marginTop: 16,
  },
  debugResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  debugResultLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  debugSummaryContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  debugSummaryText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  debugRecommendationsContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  debugRecommendationText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    marginBottom: 4,
  },
  
  bottomSpacing: {
    height: 100,
  },
});