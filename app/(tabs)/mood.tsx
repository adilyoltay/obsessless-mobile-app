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
import UserCentricMoodDashboard from '@/components/ui/UserCentricMoodDashboard';

// Services & Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from '@/services/offlineSync';
import moodTracker from '@/services/moodTrackingService';
import { MoodPatternAnalysisService } from '@/features/ai/services/moodPatternAnalysisService';
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { SmartMoodJournalingService } from '@/features/ai/services/smartMoodJournalingService';
import { unifiedGamificationService } from '@/features/ai/services/unifiedGamificationService';
import { useGamificationStore } from '@/store/gamificationStore';
import achievementService from '@/services/achievementService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import type { MoodEntry as ServiceMoodEntry } from '@/services/moodTrackingService';
import { sanitizePII } from '@/utils/privacy';
import { secureDataService } from '@/services/encryption/secureDataService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';


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
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();

  // State
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showMoodDashboard, setShowMoodDashboard] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [displayLimit, setDisplayLimit] = useState(5);
  
  // ✅ REMOVED: Pattern analysis and predictive insights state moved to dashboard
  const [moodPatterns, setMoodPatterns] = useState<any[]>([]); // Still needed for dashboard data generation
  const [predictiveInsights, setPredictiveInsights] = useState<any>(null); // Still needed for dashboard data generation

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

  // 🧠 AI PATTERN ANALYSIS: Analyze mood patterns when entries change
  useEffect(() => {
    if (user?.id && moodEntries.length >= 3) {
      analyzeMoodPatterns();
    }
  }, [moodEntries, user?.id]);

  /**
   * 🚀 NEW: UnifiedAIPipeline entegrasyon fonksiyonu
   * Mood verilerini UnifiedAIPipeline ile analiz eder
   */
  const loadMoodAIWithUnifiedPipeline = async (entries: MoodEntry[]) => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE') || entries.length < 3) {
      return;
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
      const result = await unifiedPipeline.process({
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

      // 📊 MAP RESULTS: Convert UnifiedAIPipeline results to mood state format with enhanced metrics
      if (result.patterns) {
        const normalizedPatterns = Array.isArray(result.patterns) 
          ? result.patterns 
          : result.patterns.temporal || [];
          
        const mappedPatterns = normalizedPatterns.map((pattern: any) => {
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

        console.log('🎯 Enhanced mood patterns with dashboard metrics:', mappedPatterns);
        setMoodPatterns(mappedPatterns);
        
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

      // 📊 PREDICTIVE INSIGHTS: Enhanced mapping with unified pipeline metrics
      if (result.insights?.progress || result.patterns) {
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
      
      // 🔄 FALLBACK: Use existing MoodPatternAnalysisService as fallback
      console.log('🔄 Falling back to MoodPatternAnalysisService...');
      await runLegacyMoodAnalysis(entries);
    }
  };

  /**
   * 🔄 FALLBACK: Legacy mood analysis using MoodPatternAnalysisService
   */
  const runLegacyMoodAnalysis = async (entries: MoodEntry[]) => {
    if (!user?.id) return;
    
    try {
      const serviceEntries = entries.map(entry => ({
        id: entry.id,
        user_id: entry.user_id,
        mood_score: entry.mood_score,
        energy_level: entry.energy_level,
        anxiety_level: entry.anxiety_level,
        notes: entry.notes || '',
        trigger: (entry as any).trigger || '',
        created_at: entry.created_at,
        timestamp: entry.created_at,
        synced: true
      }));

      const patternService = MoodPatternAnalysisService.getInstance();
      const deepPatterns = await patternService.analyzeMoodPatterns(
        serviceEntries as any[],
        user.id,
        'full'
      );

      console.log('🔄 Fallback analysis completed:', deepPatterns);
      
      // Merge with existing heuristic patterns
      const mergedPatterns = mergeHeuristicAndAIPatterns(moodPatterns, deepPatterns);
      setMoodPatterns(mergedPatterns);
    } catch (fallbackError) {
      console.error('❌ Fallback mood analysis also failed:', fallbackError);
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
          // Legacy mode: Use MoodPatternAnalysisService
          await runLegacyMoodAnalysis(serviceEntries);
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
      
      // Get period days based on selected range
      const periodDays = selectedTimeRange === 'today' ? 1 : 
                        selectedTimeRange === 'week' ? 7 : 30;
      
      // 🔄 Use intelligent merge service instead of direct Supabase calls
      const rawEntries = await moodTracker.getMoodEntries(user.id, periodDays);
      
      // Map service MoodEntry to screen MoodEntry format
      const entries = (rawEntries || []).map(entry => ({
        id: entry.id,
        mood_score: entry.mood_score,
        energy_level: entry.energy_level,
        anxiety_level: entry.anxiety_level,
        notes: entry.notes || '',
        trigger: entry.triggers && entry.triggers.length > 0 ? entry.triggers[0] : undefined,
        created_at: entry.timestamp,
        user_id: entry.user_id
      }));
      
      setMoodEntries(entries);
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

  const handleQuickEntry = async (data: {
    mood: number;
    energy: number;
    anxiety: number;
    notes: string;
    trigger?: string;
  }) => {
    if (!user?.id) return;

    try {
      // 🔄 FIXED: Use moodTracker for consistent table handling (mood_tracking + intelligent merge)
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

      // 📝 SMART MOOD JOURNALING ANALYSIS
      let journalAnalysis = null;
      if (data.notes && data.notes.trim().length > 10) {
        try {
          console.log('📝 Analyzing mood journal entry...');
          const journalingService = new SmartMoodJournalingService();
          journalAnalysis = await journalingService.analyzeJournalEntry(
            user.id,
            data.notes,
            {
              existingMoodScore: data.mood,
              timestamp: new Date()
            }
          );
          console.log('📊 Journal analysis completed:', journalAnalysis);
        } catch (analysisError) {
          console.error('⚠️ Journal analysis failed:', analysisError);
          // Continue with entry save even if analysis fails
        }
      }

      // 🔄 Save via moodTracker for intelligent sync + consistent table usage
      const savedEntry = await moodTracker.saveMoodEntry(moodEntry);
      
      // 🔄 FIXED: Trigger cache invalidation after mood entry save
      try {
        await unifiedPipeline.triggerInvalidation('mood_added', user.id);
        console.log('🔄 Cache invalidated after mood entry: patterns + insights + progress');
      } catch (invalidationError) {
        console.warn('⚠️ Cache invalidation failed (non-critical):', invalidationError);
        // Don't block the user flow if cache invalidation fails
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
      } catch (syncError) {
        setToastMessage('Kayıt oluşturulamadı');
        setShowToast(true);
      }
    }
  };

  const handleEditEntry = async (entry: MoodEntry) => {
    // TODO: Implement edit functionality
    console.log('Edit entry:', entry);
  };

  const handleDeleteEntry = async (entryId: string) => {
    // TODO: Implement delete functionality
    console.log('Delete entry:', entryId);
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

  // ✅ NEW: Generate User-Centric Mood Journey Data from entries and patterns
  const generateMoodJourneyData = (entries: MoodEntry[], patterns: any[], predictiveInsights: any) => {
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate tracking days
    const firstEntry = entries.length > 0 ? new Date(entries[entries.length - 1].created_at) : today;
    const daysTracking = Math.max(1, Math.ceil((today.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate emotional growth level
    const avgMood = entries.length > 0 
      ? entries.reduce((sum, e) => sum + e.mood_score, 0) / entries.length 
      : 50;
    
    const recentEntries = entries.slice(0, 5);
    const olderEntries = entries.slice(5, 10);
    const recentAvg = recentEntries.length > 0 
      ? recentEntries.reduce((sum, e) => sum + e.mood_score, 0) / recentEntries.length 
      : avgMood;
    const olderAvg = olderEntries.length > 0 
      ? olderEntries.reduce((sum, e) => sum + e.mood_score, 0) / olderEntries.length 
      : avgMood;
    
    let emotionalGrowth: 'başlangıç' | 'gelişiyor' | 'stabil' | 'uzman' = 'başlangıç';
    if (entries.length >= 30) {
      if (recentAvg >= 70) emotionalGrowth = 'uzman';
      else if (recentAvg >= 60) emotionalGrowth = 'stabil';
      else if (recentAvg > olderAvg + 5) emotionalGrowth = 'gelişiyor';
    } else if (entries.length >= 10) {
      if (recentAvg > olderAvg + 5) emotionalGrowth = 'gelişiyor';
      else if (recentAvg >= 60) emotionalGrowth = 'stabil';
    }

    const moodTrend: 'yükseliyor' | 'stabil' | 'düşüyor' = 
      recentAvg > olderAvg + 5 ? 'yükseliyor' : 
      recentAvg < olderAvg - 5 ? 'düşüyor' : 'stabil';

    // Generate emotion distribution
    const emotionDistribution = [
      { emotion: 'Mutlu', percentage: Math.round((entries.filter(e => e.mood_score >= 70).length / Math.max(entries.length, 1)) * 100), color: '#4CAF50' },
      { emotion: 'Sakin', percentage: Math.round((entries.filter(e => e.mood_score >= 60 && e.mood_score < 70).length / Math.max(entries.length, 1)) * 100), color: '#26A69A' },
      { emotion: 'Normal', percentage: Math.round((entries.filter(e => e.mood_score >= 40 && e.mood_score < 60).length / Math.max(entries.length, 1)) * 100), color: '#66BB6A' },
      { emotion: 'Endişeli', percentage: Math.round((entries.filter(e => e.mood_score >= 30 && e.mood_score < 40).length / Math.max(entries.length, 1)) * 100), color: '#FFA726' },
      { emotion: 'Üzgün', percentage: Math.round((entries.filter(e => e.mood_score < 30).length / Math.max(entries.length, 1)) * 100), color: '#FF7043' }
    ].filter(emotion => emotion.percentage > 0);

    const dominantEmotion = emotionDistribution.length > 0 
      ? emotionDistribution.reduce((max, current) => current.percentage > max.percentage ? current : max).emotion
      : 'Normal';

    // Generate weekly colors - fixed date logic
    const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const weeklyColors = weekDays.map((day, index) => {
      // Get recent entries and assign them to days cyclically for demo
      const recentEntries = entries.slice(0, 7);
      const entryForDay = recentEntries[index % recentEntries.length];
      
      let avgMood = 50; // Default
      
      if (entries.length > 0) {
        if (index < entries.length) {
          // Use actual entry if available
          avgMood = entries[index].mood_score;
        } else {
          // Use average of all entries for missing days
          avgMood = Math.round(entries.reduce((sum, e) => sum + e.mood_score, 0) / entries.length);
        }
      }
      
      return {
        day,
        color: getMoodColor(avgMood),
        mood: avgMood,
        highlight: avgMood >= 80 ? 'Harika gün!' : avgMood <= 30 ? 'Zorlu gün' : undefined
      };
    });

    // ✅ DYNAMIC: Generate personalized encouragement based on actual mood data
    const generatePersonalizedEncouragement = () => {
      if (entries.length === 0) {
        return 'Mood takip yolculuğuna hoş geldin. Bu ilk adımın cesaret ister ve değerli.';
      }
      
      const recentEntries = entries.slice(0, 5);
      const avgRecentMood = recentEntries.length > 0 
        ? recentEntries.reduce((sum, e) => sum + e.mood_score, 0) / recentEntries.length 
        : 50;
      
      if (entries.length >= 30) {
        return `${entries.length} kayıtla düzenli takip yapıyorsun. Bu istikrar, duygusal farkındalığının ne kadar geliştiğini gösteriyor.`;
      } else if (entries.length >= 14) {
        return `${entries.length} kayıt tamamladın. İki haftadır sürdürdüğün bu takip, harika bir alışkanlık oluşturuyor.`;
      } else if (avgRecentMood >= 70) {
        return `Son kayıtlarda mood ortalaması ${Math.round(avgRecentMood)}. Pozitif bir dönemdesin ve bunu fark etmek güzel.`;
      } else if (avgRecentMood <= 40) {
        return `Zorlu bir dönemde ${entries.length} kayıt yapmışsın. Bu kendine olan saygının göstergesi.`;
      } else {
        return `${entries.length} mood kaydıyla duygularını gözlemleme becerilerin gelişiyor. Bu süreç zaman alır, sabırlı ol.`;
      }
    };

    const currentEncouragement = generatePersonalizedEncouragement();

    return {
      moodStory: {
        daysTracking,
        entriesCount: entries.length,
        emotionalGrowth,
        currentStreak: (() => {
          // ✅ DYNAMIC: Calculate actual streak based on consecutive days with mood entries
          if (entries.length === 0) return 0;
          
          let streak = 0;
          const today = new Date();
          
          // Check each day backwards from today
          for (let i = 0; i < 30; i++) { // Check last 30 days max
            const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            
            // Check if there's an entry for this day
            const hasEntryThisDay = entries.some(entry => {
              const entryDate = new Date(entry.created_at);
              return entryDate >= dayStart && entryDate < dayEnd;
            });
            
            if (hasEntryThisDay) {
              streak++;
            } else {
              // If no entry for a day, streak breaks
              break;
            }
          }
          
          return streak;
        })(),
        averageMood: Math.round(avgMood),
        moodTrend
      },
      personalInsights: {
        strongestPattern: (() => {
          if (patterns.length === 0) return 'Henüz yeterli veri yok - devam et';
          
          // Prioritize high-confidence actionable patterns
          const actionablePatterns = patterns.filter(p => p.actionable && p.confidence > 0.7);
          if (actionablePatterns.length > 0) {
            return actionablePatterns[0].title || 'Pattern tespit edildi';
          }
          
          // Fallback to highest confidence pattern
          const sortedPatterns = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
          return sortedPatterns[0].title || 'Duygusal pattern analizi yapılıyor';
        })(),
        challengeArea: (() => {
          if (patterns.length === 0) return 'Veri toplama ve düzenlilik';
          
          // 📊 ENHANCED: Use UnifiedAIPipeline MEA correlation analysis
          const unifiedMeaPattern = patterns.find(p => p.type === 'mood_mea_correlation' && p.source === 'unified_pipeline');
          if (unifiedMeaPattern?.data?.emotionalProfile) {
            const profileType = unifiedMeaPattern.data.emotionalProfile;
            
            switch (profileType) {
              case 'depression_risk':
                return 'Enerji artırıcı aktiviteler ve anksiyete yönetimi';
              case 'hyperarousal':
                return 'Yüksek uyarılma - sakinleştirici teknikler';
              case 'anxious_low_mood':
                return 'Mood ve anksiyete dengeleme stratejileri';
              case 'disconnected':
                return 'Duygusal bağlantı kurma ve farkındalık';
              case 'optimal':
                return 'Bu optimal durumu koruma stratejileri';
              default:
                return unifiedMeaPattern.suggestion || 'MEA dengelemesi';
            }
          }
          
          // Fallback to original logic
          const criticalPatterns = patterns.filter(p => p.severity === 'high' || p.severity === 'critical');
          if (criticalPatterns.length > 0) {
            return criticalPatterns[0].suggestion || 'Duygusal dengeleme teknikleri';
          }
          
          const meaPatterns = patterns.filter(p => p.type === 'mea_correlation');
          if (meaPatterns.length > 0) {
            const meaPattern = meaPatterns[0];
            if (meaPattern.data?.profileType === 'depression_risk') {
              return 'Enerji artırıcı aktiviteler ve anksiyete yönetimi';
            } else if (meaPattern.data?.profileType === 'manic_tendency') {
              return 'Sakinleştirici teknikler ve denge kurma';
            }
          }
          
          return 'Mood pattern\'lerini gözlemleme';
        })(),
        nextMilestone: (() => {
          const streakTarget = 7;
          const weeklyTarget = 21;
          const monthlyTarget = 30;
          
          if (entries.length < streakTarget) {
            return `${streakTarget - entries.length} daha kayıt (7 günlük hedef)`;
          } else if (entries.length < weeklyTarget) {
            return `${weeklyTarget - entries.length} daha kayıt (3 haftalık istikrar)`;
          } else if (entries.length < monthlyTarget) {
            return `${monthlyTarget - entries.length} daha kayıt (aylık uzman seviyesi)`;
          } else {
            const nextTarget = Math.ceil(entries.length / 30) * 30 + 30;
            return `${nextTarget - entries.length} daha kayıt (${Math.ceil(nextTarget/30)} aylık uzman)`;
          }
        })(),
        encouragement: currentEncouragement,
        actionableStep: (() => {
          if (predictiveInsights?.earlyWarning?.triggered) {
            return 'Öncelik: kendine iyi bak, nefes egzersizi yap';
          }
          
          if (patterns.length > 0) {
            const actionablePattern = patterns.find(p => p.actionable && p.suggestion);
            if (actionablePattern) {
              return actionablePattern.suggestion;
            }
          }
          
          if (entries.length < 7) {
            return 'Bugün mood kaydını yapmaya devam et';
          } else if (avgMood < 50) {
            return 'Mood düzenleme teknikleri deneyebilirsin';
          } else {
            return 'Duygusal farkındalığını sürdür, harikasın';
          }
        })()
      },
      emotionalSpectrum: {
        dominantEmotion,
        emotionDistribution,
        weeklyColors
      },
      patterns: patterns.map(pattern => ({
        type: pattern.type || 'temporal',
        title: pattern.title || 'Pattern',
        description: pattern.description || '',
        suggestion: pattern.suggestion || '',
        severity: pattern.severity || 'low',
        actionable: pattern.actionable || false
      })),
      prediction: {
        riskLevel: predictiveInsights?.riskLevel || 'low',
        earlyWarning: predictiveInsights?.earlyWarning || undefined,
        interventions: predictiveInsights?.interventions || [],
        recommendation: predictiveInsights?.earlyWarning?.message || 'Mood takibine devam et, her şey yolunda görünüyor.'
      },
      achievements: (() => {
        const achievements = [];
        
        // ✅ DYNAMIC: Generate achievements based on actual user progress
        if (entries.length > 0) {
          achievements.push({
            title: 'Mood Takip Yolculuğu Başladı',
            description: `${new Date(firstEntry).toLocaleDateString('tr-TR')} tarihinde ilk mood kaydını yaptın`,
            date: firstEntry,
            celebration: '🌟',
            impact: 'Duygusal farkındalık yolculuğunda cesaret gösterdin'
          });
        }
        
        // Progressive achievements based on actual entry count
        if (entries.length >= 7) {
          achievements.push({
            title: 'Haftalık Mood Uzmanı',
            description: `${entries.length} mood kaydı ile bir haftalık veri topladın`,
            date: today,
            celebration: '📊',
            impact: 'Tutarlı takip alışkanlığı oluşturmaya başladın'
          });
        }
        
        if (entries.length >= 30) {
          achievements.push({
            title: 'Aylık Mood Takipçisi',
            description: `${entries.length} kayıt ile bir aylık mood pattern\'in oluştu`,
            date: today,
            celebration: '📈',
            impact: 'Uzun vadeli duygusal pattern\'lerin görünür hale geldi'
          });
        }
        
        // Mood level achievement based on actual average
        if (avgMood >= 70 && entries.length >= 5) {
          achievements.push({
            title: 'Pozitif Mood Seviyesi',
            description: `Ortalama mood seviyesi ${Math.round(avgMood)} - harika bir durumdayın`,
            date: today,
            celebration: '☀️',
            impact: 'İyi duygusal durumunu fark edip değerlendiriyorsun'
          });
        }
        
        // High energy achievement
        const avgEnergy = entries.length > 0 
          ? entries.reduce((sum, e) => sum + e.energy_level, 0) / entries.length 
          : 50;
        if (avgEnergy >= 70 && entries.length >= 5) {
          achievements.push({
            title: 'Yüksek Enerji',
            description: `Ortalama enerji seviyen ${Math.round(avgEnergy)} - enerjik günler geçiriyorsun`,
            date: today,
            celebration: '⚡',
            impact: 'Yüksek enerji seviyeni fark etmek motivasyon artırıyor'
          });
        }
        
        // Anxiety management achievement
        const avgAnxiety = entries.length > 0 
          ? entries.reduce((sum, e) => sum + e.anxiety_level, 0) / entries.length 
          : 50;
        if (avgAnxiety <= 30 && entries.length >= 7) {
          achievements.push({
            title: 'Kaygı Yönetimi',
            description: `Ortalama kaygı seviyesi ${Math.round(avgAnxiety)} - güzel bir yönetim sergiliyor`,
            date: today,
            celebration: '🧘',
            impact: 'Kaygı seviyen kontrol altında ve bunun farkındasın'
          });
        }
        
        return achievements;
      })()
    };
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    const goalCount = selectedTimeRange === 'today' ? 3 : 
                     selectedTimeRange === 'week' ? 10 : 30;
    const currentCount = stats.totalEntries;
    return Math.min(Math.round((currentCount / goalCount) * 100), 100);
  };

  // Calculate weekly change
  const calculateWeeklyChange = () => {
    if (stats.trend === 'up') return '+10%';
    if (stats.trend === 'down') return '-5%';
    return '0%';
  };

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
          <Pressable 
            style={styles.headerRight}
            onPress={() => {
              console.log('🎭 Opening Mood Dashboard');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMoodDashboard(true);
            }}
          >
            <MaterialCommunityIcons name="chart-line" size={24} color="#EC4899" />
          </Pressable>
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
        {/* Date Display */}
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('tr-TR', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>

        {/* Summary Stats Card - Matching OCD Design */}
        <View style={styles.weekStatsCard}>
          <View style={styles.weekStatsHeader}>
            <View>
              <Text style={styles.weekStatsTitle}>
                Özet
              </Text>
            </View>
            {stats.trend !== 'stable' && (
              <View style={[styles.percentageBadge, 
                stats.trend === 'up' ? styles.trendUp : styles.trendDown]}>
                <Text style={styles.percentageText}>{calculateWeeklyChange()}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="emoticon-outline" size={24} color="#EC4899" />
              <Text style={styles.statValue}>{stats.avgMood}/100</Text>
              <Text style={styles.statLabel}>Ort. Mood</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="lightning-bolt-outline" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{stats.avgEnergy}/100</Text>
              <Text style={styles.statLabel}>Ort. Enerji</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="heart-pulse" size={24} color="#3B82F6" />
              <Text style={styles.statValue}>{stats.avgAnxiety}/100</Text>
              <Text style={styles.statLabel}>Ort. Anksiyete</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>İlerleme</Text>
              <Text style={styles.progressPercentage}>{calculateProgress()}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${calculateProgress()}%` }]} />
            </View>
          </View>
        </View>



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
        onClose={() => setShowQuickEntry(false)}
        onSubmit={handleQuickEntry}
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

      {/* ✅ NEW: User-Centric Mood Dashboard */}
      <UserCentricMoodDashboard
        visible={showMoodDashboard}
        onClose={() => setShowMoodDashboard(false)}
        moodJourney={generateMoodJourneyData(moodEntries, moodPatterns, predictiveInsights)}
        moodEntries={moodEntries}
        onStartAction={(actionId) => {
          console.log('🎭 User started mood action:', actionId);
          // Handle specific actions (e.g., start a new mood entry)
          if (actionId === 'next_mood_step') {
            setShowMoodDashboard(false);
            setShowQuickEntry(true);
          }
        }}
      />
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
  
  // Header Styles - Matching OCD/ERP
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
  
  // Tab Styles - Matching OCD/ERP
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
  
  // Stats Card - Matching OCD/ERP Design
  weekStatsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  weekStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  weekStatsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  weekStatsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendUp: {
    backgroundColor: '#D1FAE5',
  },
  trendDown: {
    backgroundColor: '#FEE2E2',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#065F46',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  
  // Progress Bar
  progressContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EC4899',
    fontFamily: 'Inter',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EC4899',
    borderRadius: 4,
  },
  
  // ✅ REMOVED: Predictive mood intervention styles moved to dashboard
  
  // ✅ REMOVED: Spectrum, monthly view styles moved to dashboard
  
  // List Section - Matching OCD/ERP
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
  
  // Recording Cards - Matching OCD/ERP
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
  
  bottomSpacing: {
    height: 100,
  },
});