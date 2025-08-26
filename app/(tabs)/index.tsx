import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Dimensions,
  Pressable,
  Animated
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

// Custom UI Components
import { Toast } from '@/components/ui/Toast';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
// ✅ REMOVED: BottomSheet - Today'den başarı listesi kaldırıldı
import moodTracker from '@/services/moodTrackingService';
import CheckinBottomSheet from '@/components/checkin/CheckinBottomSheet';

import { useGamificationStore } from '@/store/gamificationStore';
import * as Haptics from 'expo-haptics';

// Gamification Components
import { StreakCounter } from '@/components/gamification/StreakCounter';
// ✅ REMOVED: AchievementBadge - Today'den başarı listesi kaldırıldı
import { MicroRewardAnimation } from '@/components/gamification/MicroRewardAnimation';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { safeStorageKey } from '@/lib/queryClient';

// Stores

// Storage utility & Privacy & Encryption
import { StorageKeys } from '@/utils/storage';
import { sanitizePII } from '@/utils/privacy';
import { secureDataService } from '@/services/encryption/secureDataService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// AI Integration - Sprint 7 via Context
import { useAI, useAIUserData, useAIActions } from '@/contexts/AIContext';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
// import DebugAIPipelineOverlay from '@/components/dev/DebugAIPipelineOverlay'; // REMOVED - Kullanıcı için çok teknik
// Removed CoreAnalysisService - using UnifiedAIPipeline only

// Unified AI Pipeline (ACTIVE - Jan 2025)
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
// import { shouldUseUnifiedPipeline } from '@/utils/gradualRollout'; // DEPRECATED - 100% rollout

import { unifiedGamificationService } from '@/features/ai/services/unifiedGamificationService';

// 🎯 JITAI/Adaptive Interventions (NEW - Minimal Trigger Hook)
import { useAdaptiveSuggestion, AdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';
import AdaptiveSuggestionCard from '@/components/ui/AdaptiveSuggestionCard';
import { mapUnifiedResultToRegistryItems, extractUIQualityMeta } from '@/features/ai/insights/insightRegistry';
import QualityRibbon from '@/components/ui/QualityRibbon';
// import { AdaptiveAnalyticsTrigger } from '@/components/dev/AdaptiveAnalyticsDebugOverlay'; // REMOVED - File deleted

// Art Therapy Integration - temporarily disabled
// Risk assessment UI removed

const { width } = Dimensions.get('window');

export default function TodayScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [checkinSheetVisible, setCheckinSheetVisible] = useState(false);
  // ✅ REMOVED: achievementsSheetVisible - Today'den başarı listesi kaldırıldı
  

  
  // AI Integration via Context
  const { isInitialized: aiInitialized, availableFeatures } = useAI();
  const { hasCompletedOnboarding } = useAIUserData();
  const { generateInsights } = useAIActions();
  
  // 🔍 DEBUG: Monitor AI state changes
  useEffect(() => {
    console.log('🔄 AI State Update:', {
      aiInitialized,
      featuresCount: availableFeatures.length,
      hasAIInsights: availableFeatures.includes('AI_INSIGHTS')
    });
  }, [aiInitialized, availableFeatures]);
  
  // 🔄 Retry loadAIInsights when AI becomes initialized
  const aiInitRetryRef = useRef(false);
  useEffect(() => {
    if (aiInitialized && availableFeatures.includes('AI_INSIGHTS') && user?.id && !aiInitRetryRef.current) {
      console.log('🚀 AI became available, retrying loadAIInsights...');
      aiInitRetryRef.current = true;
      // Note: loadAIInsights defined later, React may warn but functionality works
      loadAIInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiInitialized, availableFeatures, user?.id]);


  

  
  // ✅ FIXED: Progressive UI Timer Management - prevent overlapping pipeline runs
  const deepAnalysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ OPTIMIZATION: Cache loaded module data to avoid duplicate AsyncStorage reads
  const moduleDataCacheRef = useRef<{
    allCompulsions: any[];
    allCBTRecords: any[];
    moodEntries: any[];
    allBreathworkSessions: any[];
    lastUpdated: number;
  } | null>(null);
  

  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // Gamification store
  const { 
    profile, 
    lastMicroReward
    // ✅ REMOVED: achievements - Today'den başarı listesi kaldırıldı
  } = useGamificationStore();
  const { awardMicroReward } = useGamificationStore.getState();

  // Today's stats - Genişletildi: Tüm modüller
  const [todayStats, setTodayStats] = useState({
    compulsions: 0,
    healingPoints: 0,
    resistanceWins: 0,
    // ✅ YENİ: Diğer modül verileri
    cbtRecords: 0,
    moodCheckins: 0,
    breathworkSessions: 0,
    weeklyProgress: {
      compulsions: 0,
      cbt: 0,
      mood: 0,
      breathwork: 0
    },
    // ✅ YENİ: CBT mood improvement bilgisi
    cbtMoodDelta: 0,  // Avg mood improvement from CBT records
    // ✅ YENİ: Breathwork anxiety reduction bilgisi
    breathworkAnxietyDelta: 0  // Avg anxiety reduction from breathwork sessions
  });


  
  // 🎯 Adaptive Interventions State (JITAI)
  const [adaptiveSuggestion, setAdaptiveSuggestion] = useState<AdaptiveSuggestion | null>(null);
  const [adaptiveMeta, setAdaptiveMeta] = useState<any>(null); // Quality metadata for UI
  const adaptiveRef = useRef<boolean>(false); // Prevent duplicate triggers
  const { generateSuggestion, snoozeSuggestion, trackSuggestionClick, trackSuggestionDismissal, loading: adaptiveLoading } = useAdaptiveSuggestion();

  // 🔍 DEBUG: Monitor adaptive suggestion state changes
  useEffect(() => {
    console.log('🔍 AdaptiveSuggestion state changed:', { 
      adaptiveSuggestion, 
      show: adaptiveSuggestion?.show, 
      category: adaptiveSuggestion?.category
    });
  }, [adaptiveSuggestion]);



  // Load data on mount
  useEffect(() => {
    if (user?.id) {
      onRefresh();
    }
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [user?.id]);

  // ✅ FIXED: Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (deepAnalysisTimerRef.current) {
        clearTimeout(deepAnalysisTimerRef.current);
        console.log('🧹 Cleaned up deep analysis timer on unmount');
      }
    };
  }, []);

  // Refresh stats when screen is focused (after returning from other screens)
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        console.log('🔄 Today screen focused, refreshing stats...');
        console.log('🔄 Current AI state on focus:', { aiInitialized, featuresCount: availableFeatures.length });
        onRefresh();
        
        // 🎯 Reset adaptive suggestion ref for potential re-trigger
        adaptiveRef.current = false;
      }
    }, [user?.id, aiInitialized, availableFeatures])
  );

  /**
   * 🎨 Render Art Therapy Widget
   */
  const renderArtTherapyWidget = () => {
    if (!FEATURE_FLAGS.isEnabled('AI_ART_THERAPY') || !user?.id) {
      return null;
    }

    return (
      <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 16 }}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="palette" size={24} color="#8b5cf6" />
          <Text style={styles.sectionTitle}>Sanat Terapisi</Text>
        </View>

        <Pressable 
          style={styles.artTherapyCard}
          onPress={() => {
            router.push('/art-therapy');
          }}
        >
          <View style={styles.artTherapyContent}>
            <MaterialCommunityIcons name="brush" size={32} color="#8b5cf6" />
            <View style={styles.artTherapyInfo}>
              <Text style={styles.artTherapyTitle}>Duygu Resmi Çiz</Text>
              <Text style={styles.artTherapyDescription}>
                Bugünkü hislerinizi renkler ve şekillerle ifade edin
              </Text>
              <View style={styles.artTherapyTags}>
                <Text style={styles.artTag}>Rahatlatıcı</Text>
                <Text style={styles.artTag}>Yaratıcı</Text>
                <Text style={styles.artTag}>Terapötik</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#8b5cf6" />
          </View>
        </Pressable>
      </View>
    );
  };

  /**
   * 🛡️ Render Risk Assessment Section
   */
  // Risk section removed









  /**
   * 🤖 Load AI Insights - Simplified for Adaptive Suggestions Only
   */
  const loadAIInsights = async () => {
    // 🔍 DEBUG: Log all conditions
    console.log('🔍 loadAIInsights conditions:', {
      userId: !!user?.id,
      aiInitialized,
      availableFeatures,
      hasAIInsights: availableFeatures.includes('AI_INSIGHTS')
    });
    
    if (!user?.id || !aiInitialized || !availableFeatures.includes('AI_INSIGHTS')) {
      console.log('❌ loadAIInsights early return:', {
        reason: !user?.id ? 'no_user' : !aiInitialized ? 'ai_not_initialized' : 'no_ai_insights_feature'
      });
      return;
    }
    
    console.log('✅ loadAIInsights proceeding...');
    
    if (!FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE')) {
      // Progressive UI disabled - skip loading
      console.log('⚠️ AI_PROGRESSIVE disabled - skipping');
      return;
    }

    try {
      
      // PHASE 1: Quick heuristic insights generation
      console.log('✅ Phase 1: Generating quick heuristic insights...');
      const quickInsights = await generateQuickInsights();
      console.log(`✅ Phase 1: Generated ${quickInsights.length} heuristic insights for context`);
      
      // PHASE 2: Deep Analysis (Background, 3s delay)
      // ✅ FIXED: Clear existing timer to prevent overlapping runs
      if (deepAnalysisTimerRef.current) {
        clearTimeout(deepAnalysisTimerRef.current);
        console.log('🔄 Cleared existing deep analysis timer');
      }
      
      deepAnalysisTimerRef.current = setTimeout(async () => {
        try {
          console.log('🚀 Phase 2: Starting deep analysis with ALL MODULE DATA...');
          
          // ✅ OPTIMIZATION: Use cached module data to avoid duplicate AsyncStorage reads
          let allCompulsions, allCBTRecords, moodEntries, allBreathworkSessions;
          
          if (moduleDataCacheRef.current && (Date.now() - moduleDataCacheRef.current.lastUpdated) < 60000) {
            // Use cached data if fresh (< 1 minute old)
            console.log('✅ Using cached module data for deep analysis');
            ({ allCompulsions, allCBTRecords, moodEntries, allBreathworkSessions } = moduleDataCacheRef.current);
          } else {
            // Fallback to AsyncStorage if cache is stale or missing
            console.log('⚠️ Cache stale or missing, reading from AsyncStorage');
            const today = new Date().toDateString();
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
            const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
            allCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];

            const thoughtRecordsKey = StorageKeys.THOUGHT_RECORDS(user.id);
            const cbtData = await AsyncStorage.getItem(thoughtRecordsKey);
            allCBTRecords = cbtData ? JSON.parse(cbtData) : [];

            moodEntries = await moodTracker.getMoodEntries(user.id, 7);

            const breathworkKey = StorageKeys.BREATH_SESSIONS(user.id);
            const breathworkData = await AsyncStorage.getItem(breathworkKey);
            allBreathworkSessions = breathworkData ? JSON.parse(breathworkData) : [];
          }

          // Deep analysis phase - run unified pipeline analysis
          console.log('🔍 Starting unified pipeline analysis for Today...');
          
          let pipelineResult = null;
          try {
            // Process all module data through unified pipeline
            pipelineResult = await unifiedPipeline.process({
              userId: user.id,
              content: {
                compulsions: allCompulsions,
                cbtRecords: allCBTRecords,
                moodEntries,
                breathworkSessions: allBreathworkSessions
              },
              type: 'mixed',
              context: {
                source: 'today',
                timestamp: Date.now(),
                metadata: {
                  includeAllModules: true,
                  privacy: {
                    piiSanitized: true,
                    encryptionLevel: 'sanitized_plaintext'
                  }
                }
              }
            });
            
            console.log('📊 Today Pipeline Analysis completed:', {
              insights: pipelineResult.insights?.therapeutic?.length || 0,
              patterns: Array.isArray(pipelineResult.patterns) ? pipelineResult.patterns.length : 0,
              source: pipelineResult.metadata?.source
            });
          } catch (pipelineError) {
            console.warn('⚠️ Today pipeline analysis failed:', pipelineError);
          }
          
          console.log('✅ Phase 2: Deep insights loaded with ALL MODULE DATA');
          
          // 🎯 TRIGGER ADAPTIVE SUGGESTION after deep insights complete
          if (user?.id && !adaptiveRef.current) {
            console.log('🎯 Triggering adaptive suggestion after deep insights...');
            adaptiveRef.current = true; // Prevent duplicate calls
            
            try {
              const suggestion = await generateSuggestion(user.id);
              if (suggestion.show) {
                console.log('💡 Adaptive suggestion generated:', suggestion.category);
                setAdaptiveSuggestion(suggestion);
                console.log('✅ AdaptiveSuggestion STATE SET:', { suggestion, show: suggestion.show });
                
                // 📊 GENERATE QUALITY METADATA from pipeline result (if available) or fallback
                try {
                  if (pipelineResult) {
                    // Use pipeline result to generate quality metadata (like mood page)
                    // Map suggestion category to InsightCategory
                    const getInsightCategory = (suggestedCategory?: string): 'mood' | 'cbt' | 'ocd' | 'breathwork' | 'timeline' => {
                      switch (suggestedCategory) {
                        case 'breathwork': return 'breathwork';
                        case 'cbt': return 'cbt';
                        case 'mood': return 'mood';
                        case 'tracking': return 'ocd'; // tracking suggestions map to OCD category
                        default: return 'mood'; // default fallback
                      }
                    };

                    const registryItems = mapUnifiedResultToRegistryItems(pipelineResult, 'today', {
                      trigger: 'today_analysis',
                      baseCategory: getInsightCategory(suggestion.category),
                    });
                    const qualityMeta = extractUIQualityMeta(registryItems, 'suggestion');
                    setAdaptiveMeta(qualityMeta);
                    console.log('📊 Pipeline-based quality metadata set for Today suggestion:', qualityMeta);
                  } else {
                    // Fallback to heuristic estimation if no pipeline result
                    setAdaptiveMeta({
                      source: 'heuristic' as const,
                      qualityLevel: 'medium' as const,
                      sampleSize: undefined,
                      freshnessMs: 0,
                    });
                    console.log('📊 Fallback quality metadata set for Today suggestion');
                  }
                } catch (metaError) {
                  console.warn('⚠️ Quality metadata generation failed:', metaError);
                  setAdaptiveMeta(null);
                }
              } else {
                console.log('🚫 No adaptive suggestion at this time');
                setAdaptiveMeta(null);
              }
            } catch (error) {
              console.warn('⚠️ Adaptive suggestion generation failed:', error);
              setAdaptiveMeta(null);
            }
          }
        } catch (error) {
          console.warn('⚠️ Phase 2 deep analysis failed:', error);
        } finally {
          // Clear timer ref when done
          deepAnalysisTimerRef.current = null;
        }
      }, 3000);
      
    } catch (error) {
      console.error('loadAIInsights error:', error);
    }
  };
  
  /**
   * 🚀 Generate personalized quick heuristic insights for Phase 1
   * Uses last 7 days data to create meaningful patterns and trends
   */
  const generateQuickInsights = async (): Promise<any[]> => {
    const quickInsights = [];
    
    if (!user?.id) {
      // Fallback to generic insights if no user
      quickInsights.push({
        text: "Bugün mücadelene devam etmeye hazır mısın? Güçlü olduğunu unutma!",
        category: 'motivation',
        priority: 'medium'
      });
      return quickInsights;
    }

    try {
      // 📊 Gather last 7 days data for pattern analysis
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const today = new Date();
      const currentDay = today.toLocaleDateString('tr-TR', { weekday: 'long' });
      const currentHour = today.getHours();

      // Get compulsions data
      const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
      const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
      const allCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];
      const weekCompulsions = allCompulsions.filter((c: any) => 
        new Date(c.timestamp) >= weekAgo
      );

      // Get mood data
      const weekMoods = await moodTracker.getMoodEntries(user.id, 7);

      // Get CBT records
      const thoughtRecordsKey = StorageKeys.THOUGHT_RECORDS(user.id);
      const cbtData = await AsyncStorage.getItem(thoughtRecordsKey);
      const allCBTRecords = cbtData ? JSON.parse(cbtData) : [];
      const weekCBT = allCBTRecords.filter((r: any) => 
        new Date(r.timestamp) >= weekAgo
      );

      // 🎯 PATTERN ANALYSIS 1: Daily patterns
      if (weekCompulsions.length > 0) {
        const dayPatterns = weekCompulsions.reduce((acc: any, c: any) => {
          const day = new Date(c.timestamp).toLocaleDateString('tr-TR', { weekday: 'long' });
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {});

        const maxDay = Object.entries(dayPatterns).reduce((a: any, b: any) => 
          dayPatterns[a[0]] > dayPatterns[b[0]] ? a : b
        )[0] as string;

        if (currentDay === maxDay && dayPatterns[maxDay] >= 3) {
          quickInsights.push({
            text: `${currentDay} günleri genellikle biraz daha zorlayıcı geçiyor. Bugün kendine ekstra şefkat göster 💙`,
            category: 'pattern',
            priority: 'high'
          });
        }
      }

      // 🎯 PATTERN ANALYSIS 2: Time-based patterns
      if (weekCompulsions.length > 0) {
        const hourPatterns = weekCompulsions.reduce((acc: any, c: any) => {
          const hour = new Date(c.timestamp).getHours();
          const timeSlot = hour < 6 ? 'gece' : 
                         hour < 12 ? 'sabah' : 
                         hour < 18 ? 'öğleden sonra' : 'akşam';
          acc[timeSlot] = (acc[timeSlot] || 0) + 1;
          return acc;
        }, {});

        const currentTimeSlot = currentHour < 6 ? 'gece' : 
                               currentHour < 12 ? 'sabah' : 
                               currentHour < 18 ? 'öğleden sonra' : 'akşam';

        if (hourPatterns[currentTimeSlot] && hourPatterns[currentTimeSlot] >= 3) {
          const timeAdvice = currentTimeSlot === 'sabah' ? 'güçlü başla' :
                            currentTimeSlot === 'öğleden sonra' ? 'ara ver, nefes al' :
                            currentTimeSlot === 'akşam' ? 'gevşeme zamanı' : 'dinlen';
          
          quickInsights.push({
            text: `${currentTimeSlot.charAt(0).toUpperCase() + currentTimeSlot.slice(1)} saatleri biraz daha hassas. ${timeAdvice} 🌟`,
            category: 'timing',
            priority: 'medium'
          });
        }
      }

      // 🎯 PATTERN ANALYSIS 3: Weekly trends
      if (weekCompulsions.length >= 3) {
        const recentDays = weekCompulsions.filter((c: any) => 
          new Date(c.timestamp) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        );
        const olderDays = weekCompulsions.filter((c: any) => 
          new Date(c.timestamp) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        );

        const recentAvg = recentDays.length / 3;
        const olderAvg = olderDays.length / 4;

        if (recentAvg < olderAvg * 0.7) {
          quickInsights.push({
            text: "Son günlerde gerçekten ilerliyorsun! Bu pozitif momentum'u korumaya devam et ⬆️",
            category: 'trend',
            priority: 'high'
          });
        } else if (recentAvg > olderAvg * 1.3) {
          quickInsights.push({
            text: "Bu hafta biraz daha zorlu geçiyor gibi. Normal, dalgalanmalar olabilir. Kendine nazik ol 🤗",
            category: 'trend',
            priority: 'medium'
          });
        }
      }

      // 🎯 PATTERN ANALYSIS 4: CBT & Mood correlation
      if (weekCBT.length > 0 && weekMoods.length > 0) {
        const cbtDays = weekCBT.map((c: { timestamp: string }) => new Date(c.timestamp).toDateString());
        const moodOnCBTDays = weekMoods.filter(m => 
          cbtDays.includes(new Date(m.timestamp).toDateString())
        );

        if (moodOnCBTDays.length >= 2) {
          const avgMoodOnCBTDays = moodOnCBTDays.reduce((sum, m) => sum + (m.mood_score || 50), 0) / moodOnCBTDays.length;
          const otherMoods = weekMoods.filter(m => 
            !cbtDays.includes(new Date(m.timestamp).toDateString())
          );
          const avgOtherMoods = otherMoods.length > 0 ? 
            otherMoods.reduce((sum, m) => sum + (m.mood_score || 50), 0) / otherMoods.length : 50;

          if (avgMoodOnCBTDays > avgOtherMoods + 1) {
            quickInsights.push({
              text: "Düşünce kayıtları tuttuğun günlerde mood'un genellikle daha iyi. Bugün de bir düşünce kaydı alabilirsin 📝",
              category: 'correlation',
              priority: 'medium'
            });
          }
        }
      }

      // 🎯 PATTERN ANALYSIS 5: Resistance success patterns
      if (weekCompulsions.length > 0) {
        const resistanceWins = weekCompulsions.filter((c: any) => (c.resistanceLevel || 0) >= 3).length;
        const resistanceRate = resistanceWins / weekCompulsions.length;

        if (resistanceRate > 0.6) {
          quickInsights.push({
            text: `Bu hafta direnç oranın %${Math.round(resistanceRate * 100)}! Mücadele gücün gerçekten güçlü 💪`,
            category: 'success',
            priority: 'high'
          });
        } else if (resistanceRate < 0.3 && weekCompulsions.length >= 5) {
          quickInsights.push({
            text: "Bu hafta biraz daha zorlandın. Hatırla: her küçük adım bile değerli. Kendi hızında ilerle 🌱",
            category: 'encouragement',
            priority: 'medium'
          });
        }
      }

      // 🎯 Fallback: Time-based contextual insights if no patterns found
      if (quickInsights.length === 0) {
        if (currentHour < 12) {
          quickInsights.push({
            text: `Günaydın! ${currentDay} günü yeni fırsatlarla dolu. Bugün kendine nasıl iyi bakabilirsin?`,
            category: 'daily',
            priority: 'medium'
          });
        } else if (currentHour > 18) {
          quickInsights.push({
            text: `${currentDay} akşamı geliyor. Bugün kendine gösterdiğin özen için teşekkürler 🙏`,
            category: 'evening',
            priority: 'medium'
          });
        } else {
          quickInsights.push({
            text: "Bugün mücadelene devam etmeye hazır mısın? Güçlü olduğunu unutma!",
            category: 'motivation',
            priority: 'medium'
          });
        }
      }

      console.log(`🧠 Generated ${quickInsights.length} personalized heuristic insights`);
      return quickInsights.slice(0, 2); // Limit to 2 insights for UI

    } catch (error) {
      console.warn('⚠️ Personalized insights failed, using fallback:', error);
      // Fallback to basic insights
      return [{
        text: "Bugün mücadelene devam etmeye hazır mısın? Güçlü olduğunu unutma!",
        category: 'motivation',
        priority: 'medium'
      }];
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      if (!user?.id) {
        setRefreshing(false);
        return;
      }
      
      // 🗑️ Manual refresh - invalidate all AI caches
      unifiedPipeline.triggerInvalidation('manual_refresh', user.id);

      // ✅ GENIŞLETILDI: Tüm modüllerden veri topla
      const today = new Date().toDateString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // 1. Compulsions (mevcut)
      const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
      const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
      const allCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];
      const todayCompulsions = allCompulsions.filter((c: { timestamp: string }) => 
        new Date(c.timestamp).toDateString() === today
      );
      const weeklyCompulsions = allCompulsions.filter((c: { timestamp: string }) => 
        new Date(c.timestamp) >= weekAgo
      );
      
      // 2. ✅ YENİ: CBT Records
      const thoughtRecordsKey = StorageKeys.THOUGHT_RECORDS(user.id);
      const cbtData = await AsyncStorage.getItem(thoughtRecordsKey);
      const allCBTRecords = cbtData ? JSON.parse(cbtData) : [];
      const todayCBT = allCBTRecords.filter((r: any) => 
        new Date(r.timestamp).toDateString() === today
      );
      const weeklyCBT = allCBTRecords.filter((r: any) => 
        new Date(r.timestamp) >= weekAgo
      );
      
      // ✅ Calculate CBT mood improvement (avg delta)
      let cbtMoodDelta = 0;
      if (weeklyCBT.length > 0) {
        const validCBTRecords = weeklyCBT.filter((r: any) => 
          r.mood_before != null && r.mood_after != null
        );
        if (validCBTRecords.length > 0) {
          const totalMoodImprovement = validCBTRecords.reduce((sum: number, r: any) => 
            sum + (r.mood_after - r.mood_before), 0
          );
          cbtMoodDelta = Math.round((totalMoodImprovement / validCBTRecords.length) * 10) / 10; // 1 decimal place
        }
      }
      
      // 3. ✅ YENİ: Mood Entries
      const moodEntries = await moodTracker.getMoodEntries(user.id, 7);
      const todayMood = moodEntries.filter((m: any) => 
        new Date(m.timestamp).toDateString() === today
      );
      
      // 4. ✅ YENİ: Breathwork Sessions
      const breathworkKey = StorageKeys.BREATH_SESSIONS(user.id);
      const breathworkData = await AsyncStorage.getItem(breathworkKey);
      const allBreathworkSessions = breathworkData ? JSON.parse(breathworkData) : [];
      const todayBreathwork = allBreathworkSessions.filter((s: any) => 
        new Date(s.timestamp).toDateString() === today
      );
      const weeklyBreathwork = allBreathworkSessions.filter((s: any) => 
        new Date(s.timestamp) >= weekAgo
      );
      
      // ✅ Calculate Breathwork anxiety reduction (avg delta)
      let breathworkAnxietyDelta = 0;
      if (weeklyBreathwork.length > 0) {
        const validBreathworkSessions = weeklyBreathwork.filter((s: any) => 
          s.anxiety_before != null && s.anxiety_after != null
        );
        if (validBreathworkSessions.length > 0) {
          const totalAnxietyReduction = validBreathworkSessions.reduce((sum: number, s: any) => 
            sum + (s.anxiety_before - s.anxiety_after), 0  // Reduction = before - after
          );
          breathworkAnxietyDelta = Math.round((totalAnxietyReduction / validBreathworkSessions.length) * 10) / 10; // 1 decimal place
        }
      }
      
      // Calculate resistance wins
      const resistanceWins = todayCompulsions.filter((c: { resistanceLevel?: number }) => (c.resistanceLevel || 0) >= 3).length;
      
      // ✅ GÜNCEL: Tüm modül verilerini set et
      setTodayStats({
        compulsions: todayCompulsions.length,
        healingPoints: profile.healingPointsToday,
        resistanceWins,
        cbtRecords: todayCBT.length,
        moodCheckins: todayMood.length,
        breathworkSessions: todayBreathwork.length,
        weeklyProgress: {
          compulsions: weeklyCompulsions.length,
          cbt: weeklyCBT.length,
          mood: moodEntries.length,
          breathwork: weeklyBreathwork.length
        },
        cbtMoodDelta, // ✅ CBT mood improvement average
        breathworkAnxietyDelta // ✅ Breathwork anxiety reduction average
      });

      // ✅ OPTIMIZATION: Cache module data to avoid duplicate AsyncStorage reads in loadAIInsights
      moduleDataCacheRef.current = {
        allCompulsions,
        allCBTRecords,
        moodEntries,
        allBreathworkSessions,
        lastUpdated: Date.now()
      };

      // Load AI Insights with Progressive UI (Phase-1: cache/heuristic → Phase-2: deep)
      // ✅ Load AI Insights for Progressive UI (Adaptive Suggestions)
      if (FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE')) {
        await loadAIInsights();
      }
      

      
      console.log('📊 Today stats updated (TÜM MODÜLLER):', {
        compulsions: todayCompulsions.length,
        cbt: todayCBT.length,
        mood: todayMood.length,
        breathwork: todayBreathwork.length,
        healingPoints: profile.healingPointsToday,
        resistanceWins,
        weeklyTotals: {
          compulsions: weeklyCompulsions.length,
          cbt: weeklyCBT.length,
          mood: moodEntries.length,
          breathwork: weeklyBreathwork.length
        }
      });
      
      // ✅ PERFORMANS: Weekly summary cache - Future optimization için hazır
      try {
        const summaryCache = {
          timestamp: Date.now(),
          weeklyTotals: {
            compulsions: weeklyCompulsions.length,
            cbt: weeklyCBT.length,
            mood: moodEntries.length,
            breathwork: weeklyBreathwork.length
          },
          todayTotals: {
            compulsions: todayCompulsions.length,
            cbt: todayCBT.length,
            mood: todayMood.length,
            breathwork: todayBreathwork.length
          }
        };
        
        // Cache weekly summary for progressive UI (future enhancement)
        await AsyncStorage.setItem(`weekly_summary_${user.id}`, JSON.stringify(summaryCache));
        console.log('💾 Weekly summary cached for progressive UI');
      } catch (cacheError) {
        console.warn('⚠️ Weekly summary caching failed:', cacheError);
        // Non-blocking error, continue
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderHeroSection = () => {
    // Simple milestone calculation
    const milestones = [
      { points: 100, name: 'Başlangıç' },
      { points: 500, name: 'Öğrenci' },
      { points: 1000, name: 'Usta' },
      { points: 2500, name: 'Uzman' },
      { points: 5000, name: 'Kahraman' }
    ];
    
    const currentMilestone = milestones.reduce((prev, curr) => 
      profile.healingPointsTotal >= curr.points ? curr : prev,
      milestones[0]
    );
    const nextMilestone = milestones.find(m => m.points > profile.healingPointsTotal) || milestones[milestones.length - 1];
    const progressToNext = nextMilestone 
      ? ((profile.healingPointsTotal - (currentMilestone.points === nextMilestone.points ? 0 : currentMilestone.points)) / 
         (nextMilestone.points - (currentMilestone.points === nextMilestone.points ? 0 : currentMilestone.points))) * 100
      : 100;

    return (
      <Animated.View 
        style={[
          styles.heroSection,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {/* Main Points Display */}
        <View style={styles.mainPointsContainer}>
          <MaterialCommunityIcons name="star-outline" size={50} color="white" />
          <Text style={styles.mainPointsValue}>{profile.healingPointsTotal}</Text>
          <Text style={styles.mainPointsLabel}>Healing Points</Text>
        </View>

        {/* Progress to Next Level */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Sonraki Seviye: {nextMilestone.name}</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${Math.min(progressToNext, 100)}%` }]} />
          </View>
          <Text style={styles.progressValue}>
            {profile.healingPointsTotal} / {nextMilestone.points}
          </Text>
        </View>
        
        {/* ✅ YENİ: Streak Widget - Motivasyonel Görsel */}
        <View style={styles.streakWidgetContainer}>
          <StreakCounter />
        </View>
      </Animated.View>
    );
  };

  /**
   * 🎯 Quick Mood Entry Button + Emoji Bottom Sheet
   */
  const QUICK_MOOD_OPTIONS = [
    { label: 'Harika', emoji: '😄', value: 9 },
    { label: 'İyi', emoji: '🙂', value: 7 },
    { label: 'Nötr', emoji: '😐', value: 5 },
    { label: 'Düşük', emoji: '😔', value: 3 },
    { label: 'Zor', emoji: '😣', value: 1 },
  ];



  /**
   * 🎯 Handle Adaptive Suggestion CTA
   */
  const handleAdaptiveSuggestionAccept = async (suggestion: AdaptiveSuggestion) => {
    if (!user?.id || !suggestion.cta) return;

    try {
      const clickTime = Date.now();
      
      // Track click event in telemetry
      await trackAIInteraction(AIEventType.ADAPTIVE_SUGGESTION_CLICKED, {
        userId: user.id,
        category: suggestion.category,
        source: 'today', // Today screen is the source
        targetScreen: suggestion.cta.screen,
        hasNavigation: !!suggestion.cta.screen
      });
      
      // 📊 Track click in analytics
      await trackSuggestionClick(user.id, suggestion);

      // Navigate based on CTA
      switch (suggestion.cta.screen) {
        case '/(tabs)/breathwork':
          router.push({
            pathname: '/(tabs)/breathwork' as any,
            params: {
              autoStart: 'true',
              protocol: suggestion.cta.params?.protocol || 'box',
              source: 'adaptive_suggestion',
              ...(suggestion.cta.params || {})
            }
          });
          break;
          
        case '/(tabs)/cbt':
          // Remap CBT CTA to Mood
          router.push({
            pathname: '/(tabs)/mood' as any,
            params: {
              source: 'adaptive_suggestion',
              ...(suggestion.cta.params || {})
            }
          });
          break;
          
        case '/(tabs)/mood':
          router.push({
            pathname: '/(tabs)/mood' as any,
            params: {
              source: 'adaptive_suggestion',
              ...(suggestion.cta.params || {})
            }
          });
          break;
          
        case '/(tabs)/tracking':
          // Remap Tracking CTA to Breathwork
          router.push({
            pathname: '/(tabs)/breathwork' as any,
            params: {
              source: 'adaptive_suggestion',
              ...(suggestion.cta.params || {})
            }
          });
          break;
          
        default:
          console.warn('⚠️ Unknown adaptive suggestion screen:', suggestion.cta.screen);
          break;
      }
      
      // Hide suggestion after navigation
      setAdaptiveSuggestion(null);
      setAdaptiveMeta(null);
      
    } catch (error) {
      console.error('❌ Failed to handle adaptive suggestion accept:', error);
    }
  };

  /**
   * 😴 Handle Adaptive Suggestion Dismiss (Snooze)
   */
  const handleAdaptiveSuggestionDismiss = async (suggestion: AdaptiveSuggestion) => {
    if (!user?.id) return;

    try {
      const snoozeHours = 2;
      
      // 📊 Track dismissal in analytics
      await trackSuggestionDismissal(user.id, suggestion, snoozeHours);
      
      // Snooze for 2 hours (this also tracks in telemetry)
      await snoozeSuggestion(user.id, snoozeHours);
      
      // Hide suggestion
      setAdaptiveSuggestion(null);
      setAdaptiveMeta(null);
      
      console.log('😴 Adaptive suggestion snoozed for 2 hours');
    } catch (error) {
      console.error('❌ Failed to dismiss adaptive suggestion:', error);
    }
  };

  const handleCheckinComplete = (routingResult?: {
    type: 'MOOD' | 'CBT' | 'OCD' | 'BREATHWORK';
    confidence: number;
    screen?: string;
    params?: any;
  }) => {
    // 🎯 Enhanced Contextual Treatment Navigation
    if (routingResult) {
      console.log('🧭 Smart routing result:', routingResult);
      
      // Track successful routing  
      trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId: user?.id,
        routeType: routingResult.type,
        confidence: routingResult.confidence,
        source: 'voice_checkin'
      });
      
      // Auto-navigate based on AI analysis (optional - user can dismiss)
      const shouldAutoNavigate = routingResult.confidence > 0.7;

      // Remap legacy screens before navigation
      let remappedScreen = routingResult.screen;
      if (routingResult.type === 'CBT') {
        remappedScreen = 'mood';
      } else if (routingResult.type === 'OCD') {
        remappedScreen = 'breathwork';
      }

      if (shouldAutoNavigate && remappedScreen) {
        setTimeout(() => {
          // Give user a moment to see the analysis, then navigate
          router.push({
            pathname: `/(tabs)/${remappedScreen}` as any,
            params: {
              ...routingResult.params,
              source: 'ai_routing',
              confidence: routingResult.confidence.toString()
            }
          });
        }, 2000);
      }
    }
    
    // Always refresh data after check-in
    onRefresh();
  };

  const renderQuickMoodEntry = () => {
    console.log('🔍 renderQuickMoodEntry - checkinSheetVisible:', checkinSheetVisible);
    
    return (
      <View style={styles.quickMoodContainer}>
        <Button
          variant="primary"
          onPress={() => {
            console.log('🔍 Check-in button pressed!');
            setCheckinSheetVisible(true);
          }}
          accessibilityLabel="Check-in başlat"
          style={styles.quickMoodButton}
          leftIcon={<MaterialCommunityIcons name="microphone-outline" size={20} color="#FFFFFF" />}
        >
          Check-in
        </Button>
        <CheckinBottomSheet
          isVisible={checkinSheetVisible}
          onClose={() => {
            console.log('🔍 CheckinBottomSheet onClose called');
            setCheckinSheetVisible(false);
          }}
          onComplete={handleCheckinComplete}
        />
      </View>
    );
  };





  const renderQuickStats = () => (
    <View style={styles.quickStatsSection}>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="calendar-today" size={30} color="#10B981" />
        <Text style={styles.quickStatValue}>{todayStats.compulsions}</Text>
        <Text style={styles.quickStatLabel}>Kayıt (Bugün)</Text>      {/* ✅ POLISH: Etiket hizalama */}
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="fire" size={30} color="#F59E0B" />
        <Text style={styles.quickStatValue}>{profile.streakCurrent}</Text>
        <Text style={styles.quickStatLabel}>Streak</Text>              {/* ✅ POLISH: Zaten kısa */}
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="star-outline" size={30} color="#8B5CF6" />
        <Text style={styles.quickStatValue}>{profile.healingPointsToday}</Text>
        <Text style={styles.quickStatLabel}>Puan (Bugün)</Text>        {/* ✅ POLISH: Etiket hizalama */}
      </View>
    </View>
  );

  /**
   * 📊 Haftalık Özet Modül Kartları - Tüm modüllerden ilerleme
   */
  const renderModuleSummary = () => (
    <View style={styles.moduleSummarySection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="view-dashboard" size={20} color="#6B7280" />
        <Text style={styles.sectionTitle}>Haftalık Özet</Text>
      </View>
      
      <View style={styles.moduleGrid}>
        {/* Mood Özet */}
        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/(tabs)/mood')}
        >
          <View style={styles.moduleHeader}>
            <MaterialCommunityIcons name="emoticon-happy" size={18} color="#F59E0B" />
            <Text style={styles.moduleTitle}>Mood</Text>
            </View>
          <Text style={styles.moduleCount}>{todayStats.weeklyProgress.mood}</Text>
          <Text style={styles.moduleSubtext}>
            {todayStats.weeklyProgress.mood > 0 
              ? 'Check-in yapıldı' 
              : 'Bugün henüz yok'}
          </Text>
          <View style={styles.moduleFooter}>
            <Text style={styles.moduleAction}>Görüntüle →</Text>
            </View>
        </Pressable>
        
        {/* Breathwork Özet */}
        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/(tabs)/breathwork')}
        >
          <View style={styles.moduleHeader}>
            <MaterialCommunityIcons name="meditation" size={18} color="#8B5CF6" />
            <Text style={styles.moduleTitle}>Nefes</Text>
          </View>
          <Text style={styles.moduleCount}>{todayStats.weeklyProgress.breathwork}</Text>
          <Text style={styles.moduleSubtext}>
            {todayStats.weeklyProgress.breathwork > 0 
              ? `Anksiyete -${todayStats.breathworkAnxietyDelta > 0 ? todayStats.breathworkAnxietyDelta : 0}` 
              : 'Hazır mısın?'}
          </Text>
          <View style={styles.moduleFooter}>
            <Text style={styles.moduleAction}>
              {todayStats.weeklyProgress.breathwork > 0 ? 'Tekrar Et →' : 'Başla →'}
            </Text>
            </View>
        </Pressable>
      </View>
      </View>
    );

  // ✅ REMOVED: renderAchievements() - Today sayfası sadelik için kaldırıldı
  // Detaylı başarı görüntüleme modül dashboard'larında mevcut
  // MicroReward/Toast sistemi unlock anında çalışmaya devam ediyor

  return (
    <ScreenLayout>


      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeroSection()}
        
        {/* 🎯 Adaptive Intervention Suggestion Card (JITAI) */}
        {adaptiveSuggestion?.show && (
          <AdaptiveSuggestionCard
            suggestion={adaptiveSuggestion}
            onAccept={handleAdaptiveSuggestionAccept}
            onDismiss={handleAdaptiveSuggestionDismiss}
            meta={adaptiveMeta}
          />
        )}
        

        
        {renderQuickMoodEntry()}
        {renderQuickStats()}
        {renderModuleSummary()} {/* ✅ YENİ: Haftalık Özet Kartları */}
        {/* Risk section removed */}
        {renderArtTherapyWidget()}
        {/* ✅ REMOVED: Başarılarım bölümü - yinelenen bilgi, kalabalık yaratıyor */}
        {/* Hero'da healing points + streak yeterli, detaylar modül dashboard'larında */}
        
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={showToast && toastMessage.includes('hata') ? 'error' : 'success'}
        visible={showToast}
        onHide={() => setShowToast(false)}
      />
      
      {/* 📊 Adaptive Analytics Debug Trigger (Development Only) - REMOVED: Component deleted */}
      {/* <AdaptiveAnalyticsTrigger position="bottom-left" /> */}
      
      {/* Micro Reward Animation */}
      {lastMicroReward && (
        <MicroRewardAnimation 
          reward={lastMicroReward}
          onComplete={() => {}}
        />
      )}

      {/* Debug AI Pipeline Overlay - Development Only - REMOVED: Kullanıcı için çok teknik detay */}
      {/* {__DEV__ && FEATURE_FLAGS.isEnabled('DEBUG_MODE') && <DebugAIPipelineOverlay />} */}

    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  heroSection: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  mainPointsContainer: {
    alignItems: 'center',
  },
  mainPointsValue: {
    fontSize: 50,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  mainPointsLabel: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  progressContainer: {
    width: '100%',
    marginTop: 24,
  },
  progressLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 4,
    opacity: 0.9,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginTop: 4,
    textAlign: 'right',
    opacity: 0.9,
  },
  
  // ✅ YENİ: Streak Widget Stilleri
  streakWidgetContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  missionsSection: {
    marginTop: 4,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
  },


  quickStatsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginVertical: 24,
  },
  quickStatCard: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  // ✅ REMOVED: Achievement stilleri - Today'den başarı listesi kaldırıldı
  // Başarı gösterimi modül dashboard'larında mevcut
  bottomSpacing: {
    height: 100,
  },
  

  
  // Art Therapy Styles
  artTherapyCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#c4b5fd',
  },
  artTherapyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  artTherapyInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  artTherapyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b21a8',
    marginBottom: 6,
  },
  artTherapyDescription: {
    fontSize: 14,
    color: '#7c3aed',
    lineHeight: 20,
    marginBottom: 12,
  },
  artTherapyTags: {
    flexDirection: 'row',
    gap: 8,
  },
  artTag: {
    fontSize: 12,
    color: '#8b5cf6',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // Quick Mood entry styles
  quickMoodContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  quickMoodButton: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 14,
  },
  // ✅ REMOVED: sheetTitle, sheetSubtitle - achievements modalı için kullanılıyordu
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emojiItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flex: 1,
    marginHorizontal: 4,
  },
  emojiLabel: {
    fontSize: 12,
    color: '#374151',
    marginTop: 4,
  },
  // CBT Suggestion Card styles
  cbtSuggestionCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cbtSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cbtSuggestionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  cbtSuggestionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    fontFamily: 'Inter',
  },
  cbtSuggestionClose: {
    padding: 4,
  },
  cbtSuggestionText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  cbtSuggestionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  cbtSuggestionActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginRight: 4,
    fontFamily: 'Inter',
  },
  

  
  // Disabled quick stat card stilleri
  quickStatCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  
  // ✅ YENİ: Modül özet kartları stilleri
  moduleSummarySection: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    width: '47%', // 2 kart per row with gap
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  moduleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter-Medium',
  },
  moduleCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  moduleSubtext: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  moduleFooter: {
    alignItems: 'flex-end',
  },
  moduleAction: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
});