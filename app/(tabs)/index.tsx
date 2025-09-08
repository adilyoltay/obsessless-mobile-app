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
import { useRouter, useLocalSearchParams } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Custom UI Components
import { Toast } from '@/components/ui/Toast';
import MindScoreCard, { DayMetrics } from '@/components/MindScoreCard';
import MindMetaRowCard from '@/components/MindMetaRowCard';
import MindMEAStatsCard from '@/components/MindMEAStatsCard';
// ✅ Extracted UI components handle their own visuals

import { useGamificationStore } from '@/store/gamificationStore';
// import * as Haptics from 'expo-haptics';

// Gamification Components (used inside extracted components)
import MoodJourneyCard from '@/components/today/MoodJourneyCard';
import BottomCheckinCTA from '@/components/today/BottomCheckinCTA';
// ✅ REMOVED: AchievementBadge - Today'den başarı listesi kaldırıldı
import { MicroRewardAnimation } from '@/components/gamification/MicroRewardAnimation';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { StorageKeys } from '@/utils/storage';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
// import { safeStorageKey } from '@/lib/queryClient'; // unused
import todayService from '@/services/todayService';
import { moodDataLoader } from '@/services/moodDataLoader';
import { eventBus, Events } from '@/services/eventBus';
import { getAdvancedMoodColor, getMoodGradient, getVAColorFromScores } from '@/utils/colorUtils';
import { getUserDateString } from '@/utils/timezoneUtils';
import { PanResponder, PanResponderGestureState, GestureResponderEvent } from 'react-native';

// Stores

// Storage utility & Privacy & Encryption (unused in Today screen after refactor)
// import { FEATURE_FLAGS } from '@/constants/featureFlags';

// 🚫 AI Integration - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
// All AI imports removed - using only static suggestions and basic CRUD

// Art Therapy removed
// Risk assessment UI removed

// const { width } = Dimensions.get('window'); // no direct usage after style prune

// Minimal styles actually used by this screen
import { Colors } from '@/constants/Colors';
const simpleStyles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: Colors.ui.background },
});

export default function TodayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() || {};
  const { user } = useAuth();
  const { t } = useTranslation();

  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [moodSectionY, setMoodSectionY] = useState(0);
  // Swipe left to Settings
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);
        return dx > 20 && dx > dy; // horizontal dominant
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx < -60 && Math.abs(gesture.vx) > 0.2) {
          router.push('/(tabs)/settings' as any);
        }
      },
    })
  ).current;
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [checkinSheetVisible, setCheckinSheetVisible] = useState(false);
  const [mindSparkStyle, setMindSparkStyle] = useState<'line' | 'bar'>('line');
  // coloredMindScoreCard removed (always hero non-colorized)
  const [heroStats, setHeroStats] = useState<{ moodVariance: number } | null>(null);
  const [selectedDayScore, setSelectedDayScore] = useState<number | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<{ score: number | null; trendPct: number | null; periodLabel: string; dominant?: string | null; moodP50?: number | null; energyP50?: number | null; anxietyP50?: number | null } | null>(null);
  const { colorMode, setColorMode, color: accentColor, gradient, setScore, setVA } = useAccentColor();
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
    lastMicroReward,
    initializeGamification
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
      // Initialize gamification for streak tracking
      initializeGamification(user.id);
    }
  }, [user?.id, initializeGamification]);

  // Auto-refresh Today when a new mood entry is saved anywhere in the app
  useEffect(() => {
    if (!user?.id) return;
    const unsub = eventBus.on(Events.MoodEntrySaved, (payload) => {
      try {
        if (!payload || !payload.userId || payload.userId !== user.id) return;
        onRefresh();
      } catch {}
    });
    return () => { try { unsub(); } catch {} };
  }, [user?.id]);

  // Deep-link focus: scroll to Mood Journey section (optional openDate handled by card)
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      const focus = Array.isArray(params.focus) ? params.focus[0] : (params.focus as string | undefined);
      if (focus === 'mood') {
        setTimeout(() => {
          try { scrollRef.current?.scrollTo({ y: Math.max(0, moodSectionY - 12), animated: true }); } catch {}
        }, 300);
      }
    }, [user?.id, params.focus, moodSectionY])
  );

  // Load color mode from settings when user changes
  useEffect(() => {
    (async () => {
      try {
        // One-time initialization for first app launch
        const first = await AsyncStorage.getItem(StorageKeys.FIRST_LAUNCH_DONE);
        if (!first) {
          try {
            const existing = await AsyncStorage.getItem(StorageKeys.SETTINGS);
            if (!existing) {
              const defaults = {
                // Visual prefs
                showMoodTrendOverlay: true,
                showEnergyOverlay: false,
                showAnxietyOverlay: false,
                visibleTimeRanges: ['day','week','month'],
                // Global colors + MindScore
                colorMode: 'today',
                mindSparkStyle: 'bar',
              } as any;
              await AsyncStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(defaults));
            }
          } finally {
            await AsyncStorage.setItem(StorageKeys.FIRST_LAUNCH_DONE, '1');
          }
        }
        const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
        if (saved) {
          const parsed = JSON.parse(saved);
          const mode = parsed?.colorMode as 'static' | 'today' | 'weekly' | undefined;
          if (mode) setColorMode(mode);
          const spark = parsed?.mindSparkStyle as 'line' | 'bar' | undefined;
          if (spark === 'line' || spark === 'bar') setMindSparkStyle(spark);
          // coloredMindScoreCard removed
        }
      } catch {}
    })();
  }, [user?.id]);

  // Load color mode from settings (global app setting)
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
        if (saved) {
          const parsed = JSON.parse(saved);
          const mode = parsed?.colorMode as 'static' | 'today' | 'weekly' | undefined;
          if (mode) setColorMode(mode);
          const spark = parsed?.mindSparkStyle as 'line' | 'bar' | undefined;
          if (spark === 'line' || spark === 'bar') setMindSparkStyle(spark);
          // coloredMindScoreCard removed
        }
      } catch {}
    })();
  }, [user?.id]);

  // (no deep analysis timers in use; cleanup not required)

  // Refresh stats when screen is focused (after returning from other screens)
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      if (__DEV__) console.log('🔄 Today screen focused, refreshing stats...');

      // Read latest colorMode from settings before refreshing
      (async () => {
        try {
          const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
          if (saved) {
            const parsed = JSON.parse(saved);
            const mode = parsed?.colorMode as 'static' | 'today' | 'weekly' | undefined;
            if (mode) setColorMode(mode);
          }
        } catch {}
        onRefresh();
      })();

      // 🚫 Adaptive Suggestion Reset - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
      // adaptiveRef.current = false;
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
  
  // 🌈 Advanced mood color mapping moved to utils/colorUtils



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
    const energyFor = (emotion: string) => (
      emotion === 'Heyecanlı' ? 9 :
      emotion === 'Enerjik'  ? 8 :
      emotion === 'Mutlu'    ? 7 :
      emotion === 'Sakin'    ? 5 :
      emotion === 'Normal'   ? 6 :
      emotion === 'Endişeli' ? 7 :
      emotion === 'Sinirli'  ? 8 :
      /* Üzgün/Kızgın */       emotion === 'Üzgün' ? 3 : 9
    );
    const scoreFor = (emotion: string) => (
      emotion === 'Heyecanlı' ? 95 :
      emotion === 'Enerjik'  ? 85 :
      emotion === 'Mutlu'    ? 75 :
      emotion === 'Sakin'    ? 65 :
      emotion === 'Normal'   ? 55 :
      emotion === 'Endişeli' ? 45 :
      emotion === 'Sinirli'  ? 35 :
      /* Üzgün/Kızgın */       emotion === 'Üzgün' ? 25 : 15
    );
    return Object.entries(emotionCounts)
      .filter(([_, count]) => count > 0)
      .map(([emotion, count]) => ({
        emotion,
        percentage: Math.round((count / total) * 100),
        color: getVAColorFromScores(scoreFor(emotion), energyFor(emotion))
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
      // Ensure chart caches are cleared so new entries reflect immediately
      try { moodDataLoader.invalidate(user.id); } catch {}
      // 🚫 AI Cache Invalidation - DISABLED (Sprint 2: Hard Stop AI Fallbacks)
      // pipeline.triggerInvalidation('manual_refresh', user.id);

      // Initialize gamification for streak tracking
      initializeGamification(user.id);
      
      const data = await todayService.getTodayData(
        user.id,
        useGamificationStore.getState().profile.healingPointsTotal,
        useGamificationStore.getState().profile.healingPointsToday,
      );

      setTodayStats(data.todayStats);
      setMoodJourneyData(data.moodJourneyData);

      // Extended week stats for MindScore stability from moodDataLoader
      try {
        const extended = await moodDataLoader.loadTimeRange(user.id, 'week');
        const mv = Number(extended.statistics?.moodVariance || 0);
        setHeroStats({ moodVariance: mv });
      } catch (e) {
        if (__DEV__) console.warn('MindScore hero stats load failed:', e);
        setHeroStats(null);
      }

      // 🎨 Resolve Hero color based on colorMode
      try {
        const toCoordServiceLike = (v:number) => Math.max(-1, Math.min(1, (v - 5.5) / 4.5));
        if (colorMode === 'static') {
          setScore(55);
          setVA({ x: 0, y: 0 });
        } else if (colorMode === 'today') {
          // Use normalized 'today' averages so Hero matches Mood Journey's bar color
          const todayAvgMood = Math.round(data.moodJourneyData?.todayAverage || 0);
          const todayEnergyAvg = typeof data.moodJourneyData?.weeklyEntries?.[0]?.energy_level === 'number'
            ? Math.round((data.moodJourneyData!.weeklyEntries![0] as any).energy_level)
            : NaN;

          let score = todayAvgMood > 0 ? todayAvgMood : 0;
          if (!score) {
            if (data.moodEntries && data.moodEntries.length > 0) {
              score = Math.round((data.moodEntries[0] as any).mood_score || 0);
            }
          }
          if (!score) score = 55;
          setScore(score);

          const energyFallback = data.moodJourneyData?.weeklyEnergyAvg || 6;
          const eAvg = Number.isFinite(todayEnergyAvg) && todayEnergyAvg > 0 ? todayEnergyAvg : Math.round(energyFallback);

          const m10 = Math.max(1, Math.min(10, score / 10));
          const e10 = Math.max(1, Math.min(10, eAvg));
          setVA({ x: toCoordServiceLike(m10), y: toCoordServiceLike(e10) });
        } else {
          // weekly
          let scores: number[] = [];
          if (data.moodJourneyData?.weeklyEntries?.length) {
            scores = data.moodJourneyData.weeklyEntries
              .map((e: any) => Number(e.mood_score) || 0)
              .filter((s: number) => s > 0);
          }
          if (!scores.length && data.moodEntries?.length) {
            scores = data.moodEntries.map((e: any) => Number(e.mood_score) || 0).filter((s: number) => s > 0);
          }
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          const score = avg > 0 ? avg : 55;
          setScore(score);
          const m10 = Math.max(1, Math.min(10, score / 10));
          const e10 = Math.max(1, Math.min(10, Math.round(data.moodJourneyData?.weeklyEnergyAvg || 6)));
          setVA({ x: toCoordServiceLike(m10), y: toCoordServiceLike(e10) });
        }
      } catch {}

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
    // Build 7-day metrics from normalized weeklyEntries if available
    const week: DayMetrics[] = (() => {
      const entries = moodJourneyData?.weeklyEntries || [];
      if (!entries.length) return [];
      return entries
        .map((e: any) => ({
          date: getUserDateString(e.timestamp),
          mood: Number.isFinite(e.mood_score) && e.mood_score > 0 ? Number(e.mood_score) : null,
          energy: Number.isFinite(e.energy_level) && e.energy_level > 0 ? Number(e.energy_level) : null, // 1–10 skalası korunsun - MindScoreCard'da dönüştürülecek
          anxiety: Number.isFinite(e.anxiety_level) && e.anxiety_level > 0 ? Number(e.anxiety_level) : null, // 1–10 skalası korunsun - MindScoreCard'da dönüştürülecek
        }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date))); // ascending
    })();

    // Tutarlılık için weighted score'lardan variance hesapla (MindScoreCard ile uyumlu)
    const moodVariance = heroStats?.moodVariance ?? (() => {
      // MindScoreCard ile aynı util fonksiyonunu kullanarak hizala
      try {
        const { weightedScore } = require('@/utils/mindScore');
        const scores: number[] = week
          .map(d => weightedScore(d.mood, d.energy, d.anxiety))
          .filter((v: any) => typeof v === 'number');
        if (scores.length <= 1) return 0;
        const mean = scores.reduce((s: number, n: number) => s + n, 0) / scores.length;
        return scores.reduce((s: number, n: number) => s + Math.pow(n - mean, 2), 0) / (scores.length - 1);
      } catch {
        return 0;
      }
    })();

    // Weekly gradient removed for MindScoreCard hero variant.
    // Card computes its own score-aligned gradient internally.

    // Compute EWMA-based score and 1g trend for external meta card
    let scoreNow: number | null = null;
    let trendPct: number | null = null;
    try {
      const { weightedScore } = require('@/utils/mindScore');
      const series = week.map(d => weightedScore(d.mood, d.energy, d.anxiety));
      const ewma = (arr: Array<number | null | undefined>) => {
        const vals = arr.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null));
        const n = vals.length; if (!n) return [] as number[];
        const alpha = 2 / (n + 1); const out: number[] = []; let prev: number | null = null;
        for (let i = 0; i < n; i++) {
          const x = vals[i] != null ? (vals[i] as number) : prev;
          if (x == null) prev = 50; else if (prev == null) prev = x; else prev = alpha * x + (1 - alpha) * prev;
          out.push(Math.max(0, Math.min(100, Number(prev))));
        }
        return out;
      };
      const sm = ewma(series);
      scoreNow = sm.length ? sm[sm.length - 1] : null;
      // Weekly trend: last vs first of the 7-day EWMA window
      const base = sm.length > 1 ? sm[0] : null;
      if (scoreNow != null && base != null && base !== 0) {
        trendPct = Math.round(((scoreNow - base) / Math.max(1, base)) * 100);
      }
    } catch {}

    // If we have no week data yet (fresh install), keep minimal graceful fallback
    return (
      <>
          <MindScoreCard
            week={week}
            loading={!moodJourneyData}
            onQuickStart={() => setCheckinSheetVisible(true)}
            sparkStyle={mindSparkStyle}
            moodVariance={moodVariance}
          // Always use hero variant (non-colorized)
            streakCurrent={profile.streakCurrent}
            streakBest={profile.streakBest}
            streakLevel={profile.streakLevel}
            variant={'hero'}
            selectedDayScoreOverride={selectedDayScore}
            dominantLabel={selectedMeta?.dominant ?? null}
            trendPctOverride={selectedMeta?.trendPct ?? null}
            periodLabelOverride={selectedMeta?.periodLabel ?? null}
        />
        <MindMEAStatsCard
          mood={selectedMeta?.moodP50}
          energy={selectedMeta?.energyP50}
          anxiety={selectedMeta?.anxietyP50}
        />
        <MindMetaRowCard
          score={selectedMeta?.score ?? (typeof scoreNow === 'number' ? scoreNow : null)}
          streak={profile.streakCurrent}
          hp={todayStats?.healingPoints ?? 0}
        />
      </>
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
          // Remap CBT CTA to Mood section on Today
          router.push({
            pathname: '/(tabs)/index' as any,
            params: {
              focus: 'mood',
              source: 'adaptive_suggestion',
              ...(suggestion.cta.params || {})
            }
          });
          break;
          
        case '/(tabs)/mood':
          router.push({
            pathname: '/(tabs)/index' as any,
            params: {
              focus: 'mood',
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

  // Weekly dynamic hero gradient computed at screen level so it can be reused by CTA
  const heroGradient = React.useMemo(() => {
    try {
      const { getVAGradientFromScores } = require('@/utils/colorUtils');
      // Build simple week array from moodJourneyData if available
      const entries = moodJourneyData?.weeklyEntries || [];
      if (!entries.length) return gradient; // fallback to accent gradient
      const week = entries
        .map((e: any) => ({
          date: getUserDateString(e.timestamp),
          mood: Number.isFinite(e.mood_score) && e.mood_score > 0 ? Number(e.mood_score) : null,
          energy: Number.isFinite(e.energy_level) && e.energy_level > 0 ? Number(e.energy_level) : null,
          anxiety: Number.isFinite(e.anxiety_level) && e.anxiety_level > 0 ? Number(e.anxiety_level) : null,
        }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

      // Compute variance aligned with MindScore util
      let mv = heroStats?.moodVariance as number | undefined;
      if (typeof mv !== 'number') {
        try {
          const { weightedScore } = require('@/utils/mindScore');
          const scores: number[] = week
            .map(d => weightedScore(d.mood, d.energy, d.anxiety))
            .filter((v: any) => typeof v === 'number');
          if (scores.length > 1) {
            const mean = scores.reduce((s: number, n: number) => s + n, 0) / scores.length;
            mv = scores.reduce((s: number, n: number) => s + Math.pow(n - mean, 2), 0) / (scores.length - 1);
          } else {
            mv = 0;
          }
        } catch { mv = 0; }
      }

      const mVals = week.map(d => (typeof d.mood === 'number' ? d.mood : NaN)).filter((n: any) => Number.isFinite(n));
      const eVals = week.map(d => (typeof d.energy === 'number' ? d.energy : NaN)).filter((n: any) => Number.isFinite(n));
      const avgMood = mVals.length ? mVals.reduce((s: number, n: number) => s + n, 0) / mVals.length : 55;
      const avgE10 = eVals.length ? eVals.reduce((s: number, n: number) => s + n, 0) / eVals.length : 6;
      const sd = Math.sqrt(Math.max(0, mv || 0));
      const intensity = sd < 6 ? 0.07 : sd < 12 ? 0.09 : 0.12;
      return getVAGradientFromScores(avgMood, avgE10, intensity);
    } catch {
      return gradient;
    }
  }, [moodJourneyData?.weeklyEntries, heroStats?.moodVariance, gradient]);

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


  

  /**
   * 📊 Haftalık Özet Modül Kartları - Tüm modüllerden ilerleme
   */
  // (extracted) WeeklySummaryGrid replaces inline module summary

  // ✅ REMOVED: renderAchievements() - Today sayfası sadelik için kaldırıldı
  // Detaylı başarı görüntüleme modül dashboard'larında mevcut
  // MicroReward/Toast sistemi unlock anında çalışmaya devam ediyor

  return (
    <ScreenLayout edges={['top','left','right']}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <ScrollView
        ref={scrollRef}
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
        
        {/* 🎨 Mood Journey Card */}
        {moodJourneyData && (
          <View style={{ marginTop: 8 }} onLayout={(e) => setMoodSectionY(e.nativeEvent.layout.y)}>
            <MoodJourneyCard
              data={moodJourneyData}
              initialOpenDate={(() => {
                try {
                  const v = Array.isArray(params.openDate) ? params.openDate[0] : (params.openDate as string | undefined);
                  if (!v || typeof v !== 'string') return undefined;
                  // Validate date string format and actual date
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
                  const testDate = new Date(v);
                  if (!isFinite(testDate.getTime())) return undefined;
                  return v;
                } catch (error) {
                  console.warn('Invalid initialOpenDate param:', error);
                  return undefined;
                }
              })()}
              initialRange={(() => {
                try {
                  const r = Array.isArray(params.openRange) ? params.openRange[0] : (params.openRange as string | undefined);
                  const validRanges = ['week', 'month', '6months', 'year'] as const;
                  return validRanges.includes(r as any) ? (r as any) : 'week'; // Fallback to week
                } catch (error) {
                  console.warn('Invalid initialRange param:', error);
                  return 'week';
                }
              })()}
              onSelectedScoreChange={setSelectedDayScore}
              onSelectedMetaChange={setSelectedMeta}
            />
          </View>
        )}
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
          accentColor={accentColor}
          gradientColors={['#34d399', '#059669']}
        />
        {/* Spacer removed to avoid visual gap above bottom tab */}
      </ScrollView>
      </View>

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
