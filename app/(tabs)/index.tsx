import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Dimensions
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Icons now used inside extracted components
import { useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Custom UI Components
import { Toast } from '@/components/ui/Toast';
import HeroCard from '@/components/today/HeroCard';
import QuickStatsRow from '@/components/today/QuickStatsRow';
// ✅ Extracted UI components handle their own visuals

import { useGamificationStore } from '@/store/gamificationStore';
// import * as Haptics from 'expo-haptics';

// Gamification Components (used inside extracted components)
import MoodJourneyCard from '@/components/today/MoodJourneyCard';
import WeeklySummaryGrid from '@/components/today/WeeklySummaryGrid';
import BottomCheckinCTA from '@/components/today/BottomCheckinCTA';
// ✅ REMOVED: AchievementBadge - Today'den başarı listesi kaldırıldı
import { MicroRewardAnimation } from '@/components/gamification/MicroRewardAnimation';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
// import { safeStorageKey } from '@/lib/queryClient'; // unused
import todayService from '@/services/todayService';

// Stores

// Storage utility & Privacy & Encryption (unused in Today screen after refactor)
// import { FEATURE_FLAGS } from '@/constants/featureFlags';

// 🚫 AI Integration - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
// All AI imports removed - using only static suggestions and basic CRUD

// Art Therapy removed
// Risk assessment UI removed

// const { width } = Dimensions.get('window'); // no direct usage after style prune

// Minimal styles actually used by this screen
const simpleStyles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#F3F4F6' },
  bottomSpacing: { height: 100 },
});

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


  

  
  // ✅ OPTIMIZATION: Cache loaded module data to avoid duplicate AsyncStorage reads
  const moduleDataCacheRef = useRef<{
    moodEntries: any[];
    allBreathworkSessions: any[];
    lastUpdated: number;
  } | null>(null);
  

  
  // (extracted) Animations moved into components
  
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
  }, [user?.id]);

  // (no deep analysis timers in use; cleanup not required)

  // Refresh stats when screen is focused (after returning from other screens)
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        if (__DEV__) console.log('🔄 Today screen focused, refreshing stats...');
        // 🚫 AI State Logging - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
        // console.log('🔄 Current AI state on focus:', { aiInitialized, featuresCount: availableFeatures.length });
        onRefresh();
        
        // 🚫 Adaptive Suggestion Reset - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
        // adaptiveRef.current = false;
      }
    }, [user?.id])
  );

  // 🎉 Micro-reward toast: show a brief toast when a new reward arrives
  useEffect(() => {
    if (lastMicroReward) {
      setToastMessage(lastMicroReward.message || '👏 Güzel ilerleme!');
      setShowToast(true);
    }
  }, [lastMicroReward]);

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









  // (AI insights disabled; legacy helpers removed)

  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      if (!user?.id) {
        setRefreshing(false);
        return;
      }
      // 🚫 AI Cache Invalidation - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
      // pipeline.triggerInvalidation('manual_refresh', user.id);

      const data = await todayService.getTodayData(
        user.id,
        useGamificationStore.getState().profile.healingPointsTotal,
        useGamificationStore.getState().profile.healingPointsToday,
      );

      setTodayStats(data.todayStats);
      setMoodJourneyData(data.moodJourneyData);

      // ✅ OPTIMIZATION: Cache module data to avoid duplicate AsyncStorage reads in loadAIInsights
      moduleDataCacheRef.current = {
        moodEntries: data.moodEntries,
        allBreathworkSessions: data.allBreathworkSessions,
        lastUpdated: Date.now()
      };

      // AI insights disabled
      

      
      if (__DEV__) console.log('📊 Today stats updated:', {
        mood: data.todayStats.moodCheckins,
        breathwork: data.todayStats.breathworkSessions,
        healingPoints: data.todayStats.healingPoints,
        weeklyTotals: data.todayStats.weeklyProgress,
      });
      
      // ✅ PERFORMANS: Weekly summary cache - Future optimization için hazır
      try {
        const summaryCache = {
          timestamp: Date.now(),
          weeklyTotals: data.todayStats.weeklyProgress,
          todayTotals: {
            mood: data.todayStats.moodCheckins,
            breathwork: data.todayStats.breathworkSessions,
          }
        };
        
        // Cache weekly summary for progressive UI (future enhancement)
        await AsyncStorage.setItem(`weekly_summary_${user.id}`, JSON.stringify(summaryCache));
        if (__DEV__) console.log('💾 Weekly summary cached for progressive UI');
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
    const milestones = [
      { points: 100, name: 'Başlangıç' },
      { points: 500, name: 'Öğrenci' },
      { points: 1000, name: 'Usta' },
      { points: 2500, name: 'Uzman' },
      { points: 5000, name: 'Kahraman' }
    ];
    const currentMilestone = milestones.reduce((prev, curr) => (
      profile.healingPointsTotal >= curr.points ? curr : prev
    ), milestones[0]);
    const nextMilestone = milestones.find(m => m.points > profile.healingPointsTotal) || milestones[milestones.length - 1];
    const base = currentMilestone.points === nextMilestone.points ? 0 : currentMilestone.points;
    const denom = nextMilestone.points - base || 1;
    const progressToNext = ((profile.healingPointsTotal - base) / denom) * 100;
    const isMaxLevel = nextMilestone.points === currentMilestone.points && profile.healingPointsTotal >= nextMilestone.points;
    return (
      <HeroCard
        healingPointsTotal={profile.healingPointsTotal}
        nextMilestoneName={nextMilestone.name}
        progressToNextPct={Math.min(100, Math.max(0, progressToNext))}
        nextMilestoneTarget={isMaxLevel ? undefined : nextMilestone.points}
        isMaxLevel={isMaxLevel}
      />
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
  // (extracted) BottomCheckinCTA replaces inline CTA





  const renderQuickStats = () => (
    <QuickStatsRow
      moodTodayCount={todayStats.moodCheckins}
      streakCurrent={profile.streakCurrent}
      healingPointsToday={profile.healingPointsToday}
    />
  );

  /**
   * 📊 Haftalık Özet Modül Kartları - Tüm modüllerden ilerleme
   */
  // (extracted) WeeklySummaryGrid replaces inline module summary

  // ✅ REMOVED: renderAchievements() - Today sayfası sadelik için kaldırıldı
  // Detaylı başarı görüntüleme modül dashboard'larında mevcut
  // MicroReward/Toast sistemi unlock anında çalışmaya devam ediyor

  return (
    <ScreenLayout>


      <ScrollView
        style={simpleStyles.scrollView}
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
        
        {/* 🎨 Mood Journey Card */}
        {moodJourneyData && <MoodJourneyCard data={moodJourneyData} />}
        
        <WeeklySummaryGrid data={moodJourneyData} />
        {/* Risk section removed */}
        {renderArtTherapyWidget()}
        {/* ✅ REMOVED: Başarılarım bölümü - yinelenen bilgi, kalabalık yaratıyor */}
        {/* Hero'da healing points + streak yeterli, detaylar modül dashboard'larında */}
        
        {/* Check-in butonu en altta */}
        <BottomCheckinCTA
          isVisible={checkinSheetVisible}
          onOpen={() => setCheckinSheetVisible(true)}
          onClose={() => setCheckinSheetVisible(false)}
          onComplete={handleCheckinComplete}
        />
        
        <View style={simpleStyles.bottomSpacing} />
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
