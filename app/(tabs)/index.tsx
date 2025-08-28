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

// 🚫 AI Integration - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
// All AI imports removed - using only static suggestions and basic CRUD

// Art Therapy removed
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
  

  
  // 🚫 AI Integration - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
  // const { isInitialized: aiInitialized, availableFeatures } = useAI();
  // const { hasCompletedOnboarding } = useAIUserData();
  // const { generateInsights } = useAIActions();
  
  // 🚫 AI State Monitoring - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
  /*
  useEffect(() => {
    console.log('🔄 AI State Update:', {
      aiInitialized,
      featuresCount: availableFeatures.length,
      hasAIInsights: availableFeatures.includes('AI_INSIGHTS')
    });
  }, [aiInitialized, availableFeatures]);
  */
  
  // 🚫 AI Retry Logic - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
  /*
  const aiInitRetryRef = useRef(false);
  useEffect(() => {
    if (aiInitialized && availableFeatures.includes('AI_INSIGHTS') && user?.id && !aiInitRetryRef.current) {
      console.log('🚀 AI became available, retrying loadAIInsights...');
      aiInitRetryRef.current = true;
      loadAIInsights();
    }
  }, [aiInitialized, availableFeatures, user?.id]);
  */


  

  
  // ✅ FIXED: Progressive UI Timer Management - prevent overlapping pipeline runs
  const deepAnalysisTimerRef = useRef<number | null>(null);
  
  // ✅ OPTIMIZATION: Cache loaded module data to avoid duplicate AsyncStorage reads
  const moduleDataCacheRef = useRef<{
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
    healingPoints: 0,
    moodCheckins: 0,
    breathworkSessions: 0,
    weeklyProgress: {
      mood: 0,
      breathwork: 0
    },
    breathworkAnxietyDelta: 0  // Avg anxiety reduction from breathwork sessions
  });

  // 🎭 Mood Journey State - Enerji ve Anksiyete dahil
  const [moodJourneyData, setMoodJourneyData] = useState<{
    weeklyEntries: any[];
    todayAverage: number;
    weeklyTrend: 'up' | 'down' | 'stable';
    weeklyEnergyAvg: number;
    weeklyAnxietyAvg: number;
  } | null>(null);


  
  // 🚫 Adaptive Interventions - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
  // const [adaptiveSuggestion, setAdaptiveSuggestion] = useState<AdaptiveSuggestion | null>(null);
  // 🚫 Adaptive Suggestions - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
  // const [adaptiveMeta, setAdaptiveMeta] = useState<any>(null);
  // const adaptiveRef = useRef<boolean>(false);
  // const { generateSuggestion, snoozeSuggestion, trackSuggestionClick, trackSuggestionDismissal, loading: adaptiveLoading } = useAdaptiveSuggestion();

  // 🚫 DEBUG: Monitor adaptive suggestion state changes - DISABLED
  /*
  useEffect(() => {
    console.log('🔍 AdaptiveSuggestion state changed:', { 
      adaptiveSuggestion, 
      show: adaptiveSuggestion?.show, 
      category: adaptiveSuggestion?.category
    });
  }, [adaptiveSuggestion]);
  */



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
        // 🚫 AI State Logging - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
        // console.log('🔄 Current AI state on focus:', { aiInitialized, featuresCount: availableFeatures.length });
        onRefresh();
        
        // 🚫 Adaptive Suggestion Reset - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
        // adaptiveRef.current = false;
      }
    }, [user?.id])
  );

  /**
   * 🎨 Enhanced Color-Journey Helpers
   * Mood spektrum renklerine ve emotion mapping'e dayalı fonksiyonlar
   */
  
  // 🌈 Advanced mood color mapping (0-100 scale, Spektrum dashboard ile tamamen uyumlu)
  const getAdvancedMoodColor = (score: number): string => {
    if (score >= 90) return '#C2185B'; // 90-100: Heyecanlı - Soft pink (anxiety-friendly)
    if (score >= 80) return '#7E57C2'; // 80-89: Enerjik - Soft purple  
    if (score >= 70) return '#4CAF50'; // 70-79: Mutlu - Green
    if (score >= 60) return '#26A69A'; // 60-69: Sakin - Teal
    if (score >= 50) return '#66BB6A'; // 50-59: Normal - Light Green
    if (score >= 40) return '#FFA726'; // 40-49: Endişeli - Orange
    if (score >= 30) return '#FF7043'; // 30-39: Sinirli - Red Orange
    if (score >= 20) return '#5C6BC0'; // 20-29: Üzgün - Indigo
    return '#F06292'; // 0-19: Kızgın - Rose
  };



  // 📊 Get emotion distribution from weekly data
  const getEmotionDistribution = () => {
    if (!moodJourneyData || !moodJourneyData.weeklyEntries.length) return [];
    
    const entries = moodJourneyData.weeklyEntries.filter(entry => entry.mood_score > 0);
    if (entries.length === 0) return [];

    const emotionCounts = {
      'Heyecanlı': entries.filter(e => e.mood_score >= 90).length,
      'Enerjik': entries.filter(e => e.mood_score >= 80 && e.mood_score < 90).length,
      'Mutlu': entries.filter(e => e.mood_score >= 70 && e.mood_score < 80).length,
      'Sakin': entries.filter(e => e.mood_score >= 60 && e.mood_score < 70).length,
      'Normal': entries.filter(e => e.mood_score >= 50 && e.mood_score < 60).length,
      'Endişeli': entries.filter(e => e.mood_score >= 40 && e.mood_score < 50).length,
      'Sinirli': entries.filter(e => e.mood_score >= 30 && e.mood_score < 40).length,
      'Üzgün': entries.filter(e => e.mood_score >= 20 && e.mood_score < 30).length,
      'Kızgın': entries.filter(e => e.mood_score < 20).length,
    };

    const total = entries.length;
    return Object.entries(emotionCounts)
      .filter(([_, count]) => count > 0)
      .map(([emotion, count]) => ({
        emotion,
        percentage: Math.round((count / total) * 100),
        color: getAdvancedMoodColor(
          emotion === 'Heyecanlı' ? 95 :
          emotion === 'Enerjik' ? 85 :
          emotion === 'Mutlu' ? 75 :
          emotion === 'Sakin' ? 65 :
          emotion === 'Normal' ? 55 :
          emotion === 'Endişeli' ? 45 :
          emotion === 'Sinirli' ? 35 :
          emotion === 'Üzgün' ? 25 : 15
        )
      }))
      .sort((a, b) => b.percentage - a.percentage); // En yüksek yüzdeden başla
  };

  // 🎯 Get dominant emotion
  const getDominantEmotion = () => {
    const distribution = getEmotionDistribution();
    if (distribution.length === 0) return { emotion: 'Henüz Yok', percentage: 0 };
    
    const dominant = distribution[0];
    return { emotion: dominant.emotion, percentage: dominant.percentage };
  };

  /**
   * 🎨 Render Art Therapy Widget
   */
  const renderArtTherapyWidget = () => {
    // Art Therapy removed - always return null to hide widget
    return null;
  };

  /**
   * 🛡️ Render Risk Assessment Section
   */
  // Risk section removed









  /**
   * 🚫 Load AI Insights - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
   */
  const loadAIInsights = async () => {
    console.log('✅ loadAIInsights skipped (AI disabled)');
    return;
    
    // 🚫 All AI logic disabled below
    /*
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
    */
    
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
          let moodEntries, allBreathworkSessions;
          
          if (moduleDataCacheRef.current && (Date.now() - moduleDataCacheRef.current.lastUpdated) < 60000) {
            // Use cached data if fresh (< 1 minute old)
            console.log('✅ Using cached module data for deep analysis');
            ({ moodEntries, allBreathworkSessions } = moduleDataCacheRef.current);
          } else {
            // Fallback to AsyncStorage if cache is stale or missing
            console.log('⚠️ Cache stale or missing, reading from AsyncStorage');
            const today = new Date().toDateString();
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            moodEntries = await moodTracker.getMoodEntries(user.id, 7);

            const breathworkKey = StorageKeys.BREATH_SESSIONS(user.id);
            const breathworkData = await AsyncStorage.getItem(breathworkKey);
            allBreathworkSessions = breathworkData ? JSON.parse(breathworkData) : [];
          }

          // 🚫 Deep analysis phase - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
          console.log('✅ Skipping AI pipeline analysis (AI disabled)');
          
          console.log('✅ Phase 2: Deep insights loaded with ALL MODULE DATA');
          
          // 🚫 ADAPTIVE SUGGESTIONS - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
          console.log('✅ Skipping adaptive suggestion generation (AI disabled)');
        } catch (error) {
          console.warn('⚠️ Phase 2 deep analysis failed:', error);
        } finally {
          // Clear timer ref when done
          deepAnalysisTimerRef.current = null;
        }
      }, 3000);
      
    } catch (error) {
      console.error('loadAIInsights error, using static fallback:', error);
      
      // 🔄 STATIC FALLBACK: Provide meaningful insights when AI completely fails
      try {
        const { staticSuggestionsService } = await import('@/services/fallback/staticSuggestions');
        
        const staticInsights = staticSuggestionsService.generateErrorFallbackInsights('ai_insights_failed');
        
        // Convert to expected format for quickInsights
        const formattedInsights = staticInsights.map((insight, index) => ({
          id: insight.id,
          text: `${insight.title}: ${insight.content}`,
          category: insight.category,
          priority: index === 0 ? 'high' : 'medium' as 'high' | 'medium' | 'low',
          actionable: insight.actionable,
          confidence: insight.confidence,
          source: 'static_fallback'
        }));
        
        console.log('✅ Static fallback insights loaded for Today screen:', formattedInsights.length);
        
      } catch (fallbackError) {
        console.error('❌ Static fallback also failed:', fallbackError);
        // Final fallback - at least show something encouraging
        console.log('💪 Emergency fallback: Her yeni gün yeni fırsatlar getirir. Bugün kendine karşı nazik ol ve küçük adımlar at.');
      }
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

      // Get mood data
      const weekMoods = await moodTracker.getMoodEntries(user.id, 7);
      

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
      
      // 🚫 AI Cache Invalidation - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
      // pipeline.triggerInvalidation('manual_refresh', user.id);

      // 🌍 TIMEZONE-AWARE: Use timezone-safe date operations  
      const { isSameDayInUserTimezone, toUserLocalDate } = require('@/utils/timezoneUtils');
      const todayUserDate = toUserLocalDate(new Date());
      const weekAgoUserDate = new Date(todayUserDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // 1. ✅ Mood Entries
      const moodEntries = await moodTracker.getMoodEntries(user.id, 7);
      const todayMood = moodEntries.filter((m: any) => 
        isSameDayInUserTimezone(m.timestamp, new Date())
      );
      
      // 2. ✅ Breathwork Sessions
      const breathworkKey = StorageKeys.BREATH_SESSIONS(user.id);
      const breathworkData = await AsyncStorage.getItem(breathworkKey);
      const allBreathworkSessions = breathworkData ? JSON.parse(breathworkData) : [];
      const todayBreathwork = allBreathworkSessions.filter((s: any) => 
        isSameDayInUserTimezone(s.timestamp, new Date())
      );
      const weeklyBreathwork = allBreathworkSessions.filter((s: any) => {
        const sessionUserDate = toUserLocalDate(s.timestamp);
        return sessionUserDate >= weekAgoUserDate;
      });
      
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
      
      // ✅ GÜNCEL: Tüm modül verilerini set et
      setTodayStats({
        healingPoints: profile.healingPointsToday,
        moodCheckins: todayMood.length,
        breathworkSessions: todayBreathwork.length,
        weeklyProgress: {
          mood: moodEntries.length,
          breathwork: weeklyBreathwork.length
        },
        breathworkAnxietyDelta // ✅ Breathwork anxiety reduction average
      });

      // 🎭 Mood Journey Data - Mood, Enerji, Anksiyete hesaplaması
      if (moodEntries.length > 0) {
        const todayAvg = todayMood.length > 0 
          ? todayMood.reduce((sum: number, entry: any) => sum + entry.mood_score, 0) / todayMood.length
          : 0;
        
        // Haftalık enerji ve anksiyete ortalamaları
        const weeklyEntriesWithData = moodEntries.filter((entry: any) => 
          entry.energy_level != null && entry.anxiety_level != null
        );
        
        const weeklyEnergyAvg = weeklyEntriesWithData.length > 0
          ? weeklyEntriesWithData.reduce((sum: number, entry: any) => sum + entry.energy_level, 0) / weeklyEntriesWithData.length
          : 0;
          
        const weeklyAnxietyAvg = weeklyEntriesWithData.length > 0
          ? weeklyEntriesWithData.reduce((sum: number, entry: any) => sum + entry.anxiety_level, 0) / weeklyEntriesWithData.length
          : 0;
        
        // Basit trend hesaplaması
        const weeklyTrend = moodEntries.length >= 2 ? 
          (moodEntries[0]?.mood_score > moodEntries[moodEntries.length - 1]?.mood_score ? 'up' : 'down') : 'stable';
        
        setMoodJourneyData({
          weeklyEntries: moodEntries.slice(0, 7),
          todayAverage: todayAvg,
          weeklyTrend,
          weeklyEnergyAvg,
          weeklyAnxietyAvg
        });
      } else {
        setMoodJourneyData(null);
      }

      // ✅ OPTIMIZATION: Cache module data to avoid duplicate AsyncStorage reads in loadAIInsights
      moduleDataCacheRef.current = {
        moodEntries,
        allBreathworkSessions,
        lastUpdated: Date.now()
      };

      // Load AI Insights with Progressive UI (Phase-1: cache/heuristic → Phase-2: deep)
      // ✅ Load AI Insights for Progressive UI (Adaptive Suggestions)
      if (FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE')) {
        await loadAIInsights();
      }
      

      
      console.log('📊 Today stats updated:', {
        mood: todayMood.length,
        breathwork: todayBreathwork.length,
        healingPoints: profile.healingPointsToday,
        weeklyTotals: {
          mood: moodEntries.length,
          breathwork: weeklyBreathwork.length
        }
      });
      
      // ✅ PERFORMANS: Weekly summary cache - Future optimization için hazır
      try {
        const summaryCache = {
          timestamp: Date.now(),
          weeklyTotals: {
            mood: moodEntries.length,
            breathwork: weeklyBreathwork.length
          },
          todayTotals: {
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
      { points: 100, name: 'Başlangıç', emoji: '🌱' },
      { points: 500, name: 'Öğrenci', emoji: '📚' },
      { points: 1000, name: 'Usta', emoji: '⚔️' },
      { points: 2500, name: 'Uzman', emoji: '🏆' },
      { points: 5000, name: 'Kahraman', emoji: '🛡️' }
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
  const handleAdaptiveSuggestionAccept = async (suggestion: any) => {
    console.log('✅ handleAdaptiveSuggestionAccept skipped (AI disabled)');
    return; // 🚫 AI DISABLED - Sprint 2: Hard Stop AI Fallbacks
    
    // if (!user?.id || !suggestion.cta) return;

    try {
      const clickTime = Date.now();
      
      // 🚫 AI Telemetry - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
      // await trackAIInteraction(AIEventType.ADAPTIVE_SUGGESTION_CLICKED, {
      //   userId: user.id,
      //   category: suggestion.category,
      //   source: 'today',
      //   targetScreen: suggestion.cta.screen,
      //   hasNavigation: !!suggestion.cta.screen
      // });
      
      // 🚫 Analytics tracking - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
      // await trackSuggestionClick(user.id, suggestion);

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
      
      // 🚫 Hide suggestion after navigation - DISABLED
      // setAdaptiveSuggestion(null);
      // setAdaptiveMeta(null);
      
    } catch (error) {
      console.error('❌ Failed to handle adaptive suggestion accept:', error);
    }
  };

  /**
   * 😴 Handle Adaptive Suggestion Dismiss (Snooze)
   */
  const handleAdaptiveSuggestionDismiss = async (suggestion: any) => {
    console.log('✅ handleAdaptiveSuggestionDismiss skipped (AI disabled)');
    return; // 🚫 AI DISABLED - Sprint 2: Hard Stop AI Fallbacks
    
    // if (!user?.id) return;

    try {
      const snoozeHours = 2;
      
      // 🚫 Track dismissal in analytics - DISABLED
      // await trackSuggestionDismissal(user.id, suggestion, snoozeHours);
      
      // 🚫 Snooze for 2 hours - DISABLED
      // await snoozeSuggestion(user.id, snoozeHours);
      
      // 🚫 Hide suggestion - DISABLED
      // setAdaptiveSuggestion(null);
      // setAdaptiveMeta(null);
      
      console.log('😴 Adaptive suggestion snoozed for 2 hours');
    } catch (error) {
      console.error('❌ Failed to dismiss adaptive suggestion:', error);
    }
  };

  const handleCheckinComplete = (routingResult?: {
    type: 'MOOD' | 'BREATHWORK' | 'UNKNOWN';
    confidence: number;
    screen?: string;
    params?: any;
  }) => {
    // 🎯 Enhanced Contextual Treatment Navigation
    if (routingResult) {
      console.log('🧭 Smart routing result:', routingResult);
      
      // 🚫 AI Telemetry - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
      // trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
      //   userId: user?.id,
      //   routeType: routingResult.type,
      //   confidence: routingResult.confidence,
      //   source: 'voice_checkin'
      // });
      
      // Auto-navigate based on AI analysis (optional - user can dismiss)
      const shouldAutoNavigate = routingResult.confidence > 0.7;

      // Remap legacy screens removed
      let remappedScreen = routingResult.screen;

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

  // Check-in butonu artık en altta olacak
  const renderBottomCheckinButton = () => (
    <View style={styles.bottomCheckinContainer}>
      <Button
        variant="primary"
        onPress={() => {
          console.log('🔍 Check-in button pressed!');
          setCheckinSheetVisible(true);
        }}
        accessibilityLabel="Check-in başlat"
        style={styles.bottomCheckinButton}
        leftIcon={<MaterialCommunityIcons name="microphone-outline" size={20} color="#FFFFFF" />}
      >
        Check-in Yap
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





  const renderQuickStats = () => {
    // Milestone calculation for healing points badge
    const milestones = [
      { points: 100, name: 'Başlangıç', emoji: '🌱' },
      { points: 500, name: 'Öğrenci', emoji: '📚' },
      { points: 1000, name: 'Usta', emoji: '⚔️' },
      { points: 2500, name: 'Uzman', emoji: '🏆' },
      { points: 5000, name: 'Kahraman', emoji: '🛡️' }
    ];
    
    const currentMilestone = milestones.reduce((prev, curr) => 
      profile.healingPointsTotal >= curr.points ? curr : prev,
      milestones[0]
    );

    return (
      <View style={styles.quickStatsSection}>
        <View style={styles.quickStatCard}>
          <MaterialCommunityIcons name="calendar-today" size={28} color="#10B981" />
          <Text style={styles.quickStatValue}>{todayStats.moodCheckins}</Text>
          <Text style={styles.quickStatLabel}>Mood</Text>
        </View>
        <View style={styles.quickStatCard}>
          <MaterialCommunityIcons name="fire" size={28} color="#F59E0B" />
          <Text style={styles.quickStatValue}>{profile.streakCurrent}</Text>
          <Text style={styles.quickStatLabel}>Streak</Text>
        </View>
        <View style={styles.quickStatCard}>
          <MaterialCommunityIcons name="star-outline" size={28} color="#8B5CF6" />
          <Text style={styles.quickStatValue}>{profile.healingPointsToday}</Text>
          <Text style={styles.quickStatLabel}>
            {currentMilestone.emoji} {currentMilestone.name}
          </Text>
        </View>
      </View>
    );
  };

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
          <Text style={styles.moduleCount}>
            {moodJourneyData?.todayAverage > 0 ? moodJourneyData.todayAverage.toFixed(1) : '—'}
          </Text>
          <Text style={styles.moduleSubtext}>
            {moodJourneyData?.todayAverage > 0 
              ? 'Bugünkü ortalama' 
              : 'Bugün henüz yok'}
          </Text>
          <View style={styles.moduleFooter}>
            <Text style={styles.moduleAction}>Görüntüle →</Text>
            </View>
        </Pressable>
        
        {/* Enerji Özet */}
        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/(tabs)/mood')}
        >
          <View style={styles.moduleHeader}>
            <MaterialCommunityIcons name="lightning-bolt" size={18} color="#10B981" />
            <Text style={styles.moduleTitle}>Enerji</Text>
          </View>
          <Text style={styles.moduleCount}>
            {moodJourneyData?.weeklyEnergyAvg > 0 ? moodJourneyData.weeklyEnergyAvg.toFixed(1) : '—'}
          </Text>
          <Text style={styles.moduleSubtext}>
            {moodJourneyData?.weeklyEnergyAvg > 0 
              ? 'Haftalık ortalama' 
              : 'Veri henüz yok'}
          </Text>
          <View style={styles.moduleFooter}>
            <Text style={styles.moduleAction}>Görüntüle →</Text>
          </View>
        </Pressable>
        
        {/* Anksiyete Özet */}
        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/(tabs)/mood')}
        >
          <View style={styles.moduleHeader}>
            <MaterialCommunityIcons name="heart-pulse" size={18} color="#EF4444" />
            <Text style={styles.moduleTitle}>Anksiyete</Text>
          </View>
          <Text style={styles.moduleCount}>
            {moodJourneyData?.weeklyAnxietyAvg > 0 ? moodJourneyData.weeklyAnxietyAvg.toFixed(1) : '—'}
          </Text>
          <Text style={styles.moduleSubtext}>
            {moodJourneyData?.weeklyAnxietyAvg > 0 
              ? 'Haftalık ortalama' 
              : 'Veri henüz yok'}
          </Text>
          <View style={styles.moduleFooter}>
            <Text style={styles.moduleAction}>Görüntüle →</Text>
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
        
        {/* 🚫 Adaptive Intervention - DISABLED (Sprint 2: Hard Stop AI Fallbacks) */}
        {false && (
          <></>
        )}
        

        
        {renderQuickStats()}
        
        {/* 🎨 Enhanced Color-Journey */}
        {moodJourneyData && (
          <View style={styles.colorfulMoodJourney}>
            {/* Mini Spektrum Bar - Mood skalasına uygun sıralama */}
            <LinearGradient
              colors={['#F06292', '#5C6BC0', '#FF7043', '#FFA726', '#66BB6A', '#26A69A', '#4CAF50', '#7E57C2', '#C2185B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.miniSpectrumBar}
            />
            
            {/* Enhanced Header with Dominant Emotion */}
            <View style={styles.enhancedJourneyHeader}>
              <View style={styles.journeyTitleSection}>
                <Text style={styles.journeyTitle}>Mood Yolculuğun</Text>
              </View>
              <View style={styles.dominantEmotionSection}>
                <Text style={styles.dominantLabel}>Baskın:</Text>
                <Text style={styles.dominantEmotion}>
                  {getDominantEmotion().emotion}
                </Text>
              </View>
            </View>
            
            {/* Enhanced Bar Chart with Colors */}
            <View style={styles.colorfulBars}>
              {[...moodJourneyData.weeklyEntries].reverse().map((entry, index) => {
                const barHeight = Math.min(Math.max((entry.mood_score / 10) * 60, 6), 60);
                const isToday = index === 6;
                const days = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
                const today = new Date().getDay();
                const dayIndex = (today - (6 - index) + 7) % 7;
                
                // Enhanced color - mood_score (1-10) -> (10-100) scale
                const emotionColor = getAdvancedMoodColor(entry.mood_score * 10);
                
                return (
                  <View key={entry.id || index} style={styles.colorfulBarContainer}>
                    {/* Enhanced Color Bar */}
                    <View 
                      style={[
                        styles.emotionBar,
                        { 
                          height: barHeight,
                          backgroundColor: emotionColor,
                          opacity: isToday ? 1 : 0.85
                        }
                      ]}
                    />
                    
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                      {days[dayIndex]}
                    </Text>
                  </View>
                );
              })}
            </View>
            
            {/* Emotion Distribution Dots */}
            <View style={styles.emotionDots}>
              {getEmotionDistribution().slice(0, 3).map((emotion, index) => (
                <View key={index} style={styles.emotionDot}>
                  <View style={[styles.dot, { backgroundColor: emotion.color }]} />
                  <Text style={styles.dotLabel}>{emotion.emotion}</Text>
                  <Text style={styles.dotPercentage}>{emotion.percentage}%</Text>
                </View>
              ))}
            </View>
            
            {/* Stats Row */}
            <View style={styles.journeyStats}>
              <Text style={styles.journeyStat}>
                M: {moodJourneyData.todayAverage > 0 ? moodJourneyData.todayAverage.toFixed(1) : '—'}
              </Text>
              <Text style={styles.journeyStat}>
                E: {moodJourneyData.weeklyEnergyAvg > 0 ? moodJourneyData.weeklyEnergyAvg.toFixed(1) : '—'}
              </Text>
              <Text style={styles.journeyStat}>
                A: {moodJourneyData.weeklyAnxietyAvg > 0 ? moodJourneyData.weeklyAnxietyAvg.toFixed(1) : '—'}
              </Text>
            </View>
          </View>
        )}
        
        {renderModuleSummary()} {/* ✅ YENİ: Haftalık Özet Kartları */}
        {/* Risk section removed */}
        {renderArtTherapyWidget()}
        {/* ✅ REMOVED: Başarılarım bölümü - yinelenen bilgi, kalabalık yaratıyor */}
        {/* Hero'da healing points + streak yeterli, detaylar modül dashboard'larında */}
        
        {/* Check-in butonu en altta */}
        {renderBottomCheckinButton()}
        
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

  // Healing Point kartı eski haline döndü
  // Başarı gösterimi modül dashboard'larında mevcut
  bottomSpacing: {
    height: 100,
  },

  // Check-in butonu en altta
  bottomCheckinContainer: {
    marginHorizontal: 16,
    marginVertical: 20,
  },
  bottomCheckinButton: {
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  

  
  // Art Therapy Styles removed
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
  // CBT Suggestion Card styles removed
  

  
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
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 8,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    maxWidth: '32%',
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

  // 🎨 Enhanced Color-Journey Styles
  colorfulMoodJourney: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Mini spektrum bar
  miniSpectrumBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
    opacity: 0.8,
  },
  
  // Enhanced header
  enhancedJourneyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  journeyTitleSection: {
    flex: 1,
  },
  dominantEmotionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dominantLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginRight: 4,
  },
  dominantEmotion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter-Medium',
  },
  
  // Colorful bars
  colorfulBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  colorfulBarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  emotionBar: {
    width: 20,
    borderRadius: 4,
    minHeight: 8,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  
  // Emotion dots
  emotionDots: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  emotionDot: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  dotLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  dotPercentage: {
    fontSize: 9,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    fontWeight: '500',
  },

  // Legacy styles for backward compatibility
  moodJourneySimple: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  journeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
  },
  journeyTrend: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  weeklyBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100, // Height for bars + day labels
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  moodBar: {
    width: 18, // Wider bars since no data points overlay
    borderRadius: 3,
    minHeight: 6,
    marginBottom: 4, // Space for day labels
  },
  dayLabel: {
    fontSize: 11,
    color: '#9CA3AF', // Soluk gri
    fontFamily: 'Inter',
    marginTop: 4,
  },
  dayLabelToday: {
    color: '#374151', // Bugün için daha koyu
    fontWeight: '600',
  },

  journeyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
  },
  journeyStat: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
    flex: 1,
  },
  journeyTrendBottom: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Inter',
    fontWeight: '600',
  },
});