import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

// Components
import ScreenLayout from '@/components/layout/ScreenLayout';
import FAB from '@/components/ui/FAB';
import CBTQuickEntry from '@/components/forms/CBTQuickEntry';
import { Toast } from '@/components/ui/Toast';

// Hooks & Context
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { StorageKeys } from '@/utils/storage';
import supabaseService from '@/services/supabase';
import { useGamificationStore } from '@/store/gamificationStore';
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import UserCentricCBTDashboard from '@/components/ui/UserCentricCBTDashboard';
import DebugAIPipelineOverlay from '@/components/dev/DebugAIPipelineOverlay';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

interface ThoughtRecord {
  id: string;
  thought: string;
  distortions: string[];
  evidence_for?: string;
  evidence_against?: string;
  reframe: string;
  created_at: string;
  mood_before: number;
  mood_after: number;
  trigger?: string;
  notes?: string;
}

export default function CBTScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { awardMicroReward, updateStreak } = useGamificationStore();
  
  // States
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showProgressDashboard, setShowProgressDashboard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [thoughtRecords, setThoughtRecords] = useState<ThoughtRecord[]>([]);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // ✅ FIXED: Enhanced AI-driven stats
  const [stats, setStats] = useState({
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    avgMoodImprovement: 0,
    mostCommonDistortion: '',
    totalRecords: 0,
    successRate: 0,
    // AI-driven insights
    aiInsights: {
      distortionTrends: [] as Array<{distortion: string; trend: 'improving' | 'declining' | 'stable'; change: number}>,
      techniqueEffectiveness: [] as Array<{technique: string; effectiveness: number; confidence: number}>,
      progressAnalysis: '' as string,
      recommendations: [] as string[],
      riskLevel: 'low' as 'low' | 'medium' | 'high',
      nextFocus: '' as string
    }
  });

  // Voice trigger'dan gelindiyse otomatik aç (only once)
  useEffect(() => {
    if (((params.trigger === 'voice' && params.text) || params.prefill === 'true') && !showQuickEntry) {
      console.log('📝 Opening CBT form with pre-filled data:', params);
      setShowQuickEntry(true);
    }
  }, [params.prefill, params.trigger]); // Only trigger when specific params change

  // Load data on mount and focus
  useEffect(() => {
    if (user?.id) {
      loadAllData();
    }
  }, [user?.id, selectedTimeRange]);

  // Memoize voice analysis data to prevent infinite re-renders
  const voiceAnalysisData = useMemo(() => {
    if (params.confidence && params.prefill === 'true') {
      return {
        confidence: parseFloat(params.confidence as string) || 0.5,
        analysisSource: (params.analysisSource as 'gemini' | 'heuristic') || 'heuristic',
        autoThought: params.text as string,
        suggestedDistortions: params.distortions ? 
          JSON.parse(params.distortions as string).map((d: string, idx: number) => ({
            id: d.toLowerCase().replace(/\s+/g, '_'),
            label: d,
            confidence: parseFloat(params.confidence as string) || 0.7
          })) : undefined
      };
    }
    return undefined;
  }, [params.confidence, params.prefill, params.analysisSource, params.text, params.distortions]);

  // Memoize callbacks to prevent re-renders
  const handleDismiss = useCallback(() => {
    setShowQuickEntry(false);
  }, []);

  // Removed handleRecordSavedCallback due to hoisting issue - using direct handleRecordSaved

  // Refresh on screen focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        console.log('🔄 CBT screen focused, refreshing data...');
        loadAllData();
      }
    }, [user?.id])
  );

  useEffect(() => {
    setDisplayLimit(5);
  }, [selectedTimeRange]);

  const loadAllData = async () => {
    if (!user?.id) return;
    
    try {
      console.log('📊 Loading CBT data for user:', user.id);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      // Load from Supabase first
      let records: ThoughtRecord[] = [];
      try {
        const dateRange = selectedTimeRange === 'today' 
          ? { start: today, end: new Date() }
          : selectedTimeRange === 'week'
          ? { start: weekAgo, end: new Date() }
          : { start: monthAgo, end: new Date() };
          
        records = await supabaseService.getCBTRecords(user.id, dateRange);
        console.log('✅ Loaded from Supabase:', records.length, 'records');
      } catch (error) {
        console.warn('⚠️ Supabase load failed, using local storage:', error);
      }
      
      // Fallback to local storage if Supabase fails or returns empty
      if (records.length === 0) {
        const key = StorageKeys.THOUGHT_RECORDS?.(user.id) || `thought_records_${user.id}`;
        const localData = await AsyncStorage.getItem(key);
        if (localData) {
          const allRecords = JSON.parse(localData);
          
          // Filter by selected time range
          records = allRecords.filter((r: ThoughtRecord) => {
            const recordDate = new Date(r.created_at);
            if (selectedTimeRange === 'today') {
              return recordDate >= today;
            } else if (selectedTimeRange === 'week') {
              return recordDate >= weekAgo;
            } else {
              return recordDate >= monthAgo;
            }
          });
          console.log('📱 Loaded from local storage:', records.length, 'records');
        }
      }
      
      // Sort by date (newest first)
      records.sort((a, b) => 
        new Date(b.created_at).getTime() - 
        new Date(a.created_at).getTime()
      );
      
      setThoughtRecords(records);
      await calculateStats(records);
      
    } catch (error) {
      console.error('❌ Error loading CBT data:', error);
    }
  };

  // ✅ FIXED: AI-powered analytics instead of basic counters
  const calculateStats = async (records: ThoughtRecord[]) => {
    if (records.length === 0) {
      setStats({
        todayCount: 0,
        weekCount: 0,
        monthCount: 0,
        avgMoodImprovement: 0,
        mostCommonDistortion: '',
        totalRecords: 0,
        successRate: 0,
        aiInsights: {
          distortionTrends: [],
          techniqueEffectiveness: [],
          progressAnalysis: 'Henüz yeterli veri yok. Düşünce kayıtları oluşturmaya başlayın.',
          recommendations: ['Düşünce kayıtları tutmaya başlayın', 'Çarpıtmaları fark etmeyi öğrenin'],
          riskLevel: 'low',
          nextFocus: 'Temel CBT becerilerini geliştirin'
        }
      });
      return;
    }

    console.log('📊 Calculating AI-driven CBT stats for', records.length, 'records');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Basic counters (kept for compatibility)
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let totalMoodImprovement = 0;
    let successfulRecords = 0;
    
    // Track distortions
    const distortionCounts: Record<string, number> = {};
    
    records.forEach(record => {
      const recordDate = new Date(record.created_at);
      
      if (recordDate >= today) todayCount++;
      if (recordDate >= weekAgo) weekCount++;
      if (recordDate >= monthAgo) monthCount++;
      
      // Calculate mood improvement
      const improvement = record.mood_after - record.mood_before;
      totalMoodImprovement += improvement;
      if (improvement > 0) successfulRecords++;
      
      // Count distortions
      record.distortions?.forEach(distortion => {
        distortionCounts[distortion] = (distortionCounts[distortion] || 0) + 1;
      });
    });
    
    // Find most common distortion
    const mostCommon = Object.entries(distortionCounts)
      .sort(([,a], [,b]) => b - a)[0];

    // ✅ NEW: AI-driven analytics
    let aiInsights = {
      distortionTrends: [] as any[],
      techniqueEffectiveness: [] as any[],
      progressAnalysis: '',
      recommendations: [] as string[],
      riskLevel: 'low' as 'low' | 'medium' | 'high',
      nextFocus: ''
    };

    // Generate AI analytics if we have enough data
    if (records.length >= 3 && user?.id) {
      try {
        console.log('🧠 Generating AI-driven CBT progress analytics...');
        
        // Track AI analytics request
        await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
          userId: user.id,
          source: 'cbt_screen',
          dataType: 'progress_analytics',
          recordCount: records.length
        });

        // Prepare data for AI analysis
        const analysisData = records.map(record => ({
          timestamp: record.created_at,
          distortions: record.distortions,
          moodBefore: record.mood_before,
          moodAfter: record.mood_after,
          moodImprovement: record.mood_after - record.mood_before,
          thought: record.thought?.substring(0, 100), // Truncate for privacy
          reframe: record.reframe?.substring(0, 100),
          evidenceFor: record.evidence_for?.length || 0,
          evidenceAgainst: record.evidence_against?.length || 0,
          trigger: record.trigger
        }));

        // Use UnifiedAIPipeline for comprehensive progress analysis
        const pipelineResult = await unifiedPipeline.process({
          userId: user.id,
          content: {
            thoughtRecords: analysisData,
            timeframe: selectedTimeRange,
            analysisRequest: 'comprehensive_cbt_progress_analytics'
          },
          type: 'data' as const,
          context: {
            source: 'cbt' as const,
            timestamp: Date.now(),
            metadata: {
              analysisType: 'progress_analytics',
              sessionId: `cbt_analytics_${Date.now()}`,
              recordCount: records.length,
              timeRange: selectedTimeRange
            }
          }
        });

        console.log('🎯 AI Progress Analytics Result:', pipelineResult);

        // Extract AI insights from pipeline result
        if (pipelineResult.insights?.therapeutic) {
          const therapeuticInsights = pipelineResult.insights.therapeutic;
          
          aiInsights = {
            distortionTrends: analyzeDistortionTrends(records, distortionCounts),
            techniqueEffectiveness: analyzeTechniqueEffectiveness(records),
            progressAnalysis: therapeuticInsights[0]?.text || generateProgressAnalysis(records, totalMoodImprovement),
            recommendations: therapeuticInsights.filter(i => i.actionable).map(i => i.text).slice(0, 3),
            riskLevel: calculateRiskLevel(records),
            nextFocus: therapeuticInsights.find(i => i.priority === 'high')?.text || 'CBT becerilerinizi geliştirmeye devam edin'
          };
        } else {
          // Fallback to enhanced heuristic analysis
          aiInsights = generateHeuristicInsights(records, distortionCounts, totalMoodImprovement);
        }

        // Track successful AI analytics
        await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
          userId: user.id,
          source: 'cbt_screen',
          insightsCount: aiInsights.recommendations.length,
          riskLevel: aiInsights.riskLevel
        });

      } catch (error) {
        console.error('❌ AI progress analytics failed, using heuristic fallback:', error);
        aiInsights = generateHeuristicInsights(records, distortionCounts, totalMoodImprovement);
      }
    }
    
    setStats({
      todayCount,
      weekCount,
      monthCount,
      avgMoodImprovement: records.length > 0 
        ? Math.round((totalMoodImprovement / records.length) * 10) / 10 
        : 0,
      mostCommonDistortion: mostCommon ? mostCommon[0] : '',
      totalRecords: records.length,
      successRate: records.length > 0 
        ? Math.round((successfulRecords / records.length) * 100) 
        : 0,
      aiInsights
    });
  };

  // ✅ NEW: Generate User-Centric Journey Data from AI Analytics
  const generateUserJourneyData = (records: ThoughtRecord[], aiInsights: any) => {
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate days on journey
    const firstRecord = records.length > 0 ? new Date(records[records.length - 1].created_at) : today;
    const daysOnJourney = Math.max(1, Math.ceil((today.getTime() - firstRecord.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Recent mood data for timeline
    const recentRecords = records.slice(0, 7).reverse();
    const recentMood = recentRecords.map((record, index) => {
      const date = new Date(record.created_at);
      const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      return {
        day: dayNames[date.getDay()],
        mood: record.mood_after,
        highlight: record.mood_after - record.mood_before >= 3 ? 'Harika gün!' : undefined
      };
    });
    
    // Calculate emotional growth level
    const avgImprovement = records.length > 0 
      ? records.reduce((sum, r) => sum + (r.mood_after - r.mood_before), 0) / records.length 
      : 0;
    
    let emotionalGrowth: 'başlangıç' | 'gelişiyor' | 'güçlü' | 'uzman' = 'başlangıç';
    if (avgImprovement >= 3) emotionalGrowth = 'uzman';
    else if (avgImprovement >= 2) emotionalGrowth = 'güçlü';
    else if (avgImprovement >= 1) emotionalGrowth = 'gelişiyor';
    
    // Find biggest win
    const bestRecord = records.reduce((best, current) => 
      (current.mood_after - current.mood_before) > (best.mood_after - best.mood_before) ? current : best, 
      records[0] || { mood_before: 5, mood_after: 5, thought: 'Yolculuğun henüz başlangıcında' }
    );
    
    // ✅ FIXED: Calm biggest win message (Master Prompt: Sakinlik)
    const biggestWin = bestRecord 
      ? `"${bestRecord.thought?.substring(0, 80)}..." düşüncesinde ${bestRecord.mood_after - bestRecord.mood_before} puanlık bir iyileşme sağladın`
      : 'CBT yolculuğun başladı - bu anlamlı bir adım';
    
    // ✅ DYNAMIC: Generate personalized encouragement based on actual progress
    const generatePersonalizedEncouragement = () => {
      if (records.length === 0) {
        return 'CBT yolculuğuna hoş geldin. İlk adımı attın, bu cesaret ister.';
      }
      
      const recentProgress = records.slice(0, 5);
      const avgMoodImprovement = recentProgress.length > 0 
        ? recentProgress.reduce((sum, r) => sum + (r.mood_after - r.mood_before), 0) / recentProgress.length 
        : 0;
      
      if (avgMoodImprovement >= 3) {
        return `Son kayıtlarda ortalama ${avgMoodImprovement.toFixed(1)} puanlık iyileşme. CBT becerilerinin etkisini görüyorsun.`;
      } else if (avgMoodImprovement >= 1) {
        return `${records.length} kayıtla istikrarlı bir ilerleme var. Ortalama ${avgMoodImprovement.toFixed(1)} puanlık iyileşme sağlıyorsun.`;
      } else if (records.length >= 10) {
        return `${records.length} kayıt tamamladın! Bu tutarlılık, zorlu dönemlerden güç çıkarabildiğini gösteriyor.`;
      } else {
        return `${records.length}. kaydın bu. Her kayıt, düşüncelerini daha iyi anlaman için atılmış değerli bir adım.`;
      }
    };
    
    const currentEncouragement = generatePersonalizedEncouragement();
    
    return {
      progressStory: {
        daysOnJourney,
        thoughtsProcessed: records.length,
        emotionalGrowth,
        currentStreak: (() => {
          // ✅ DYNAMIC: Calculate actual CBT streak based on consecutive days with thought records
          if (records.length === 0) return 0;
          
          let streak = 0;
          const today = new Date();
          
          // Check each day backwards from today
          for (let i = 0; i < 30; i++) { // Check last 30 days max
            const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            
            // Check if there's a thought record for this day
            const hasRecordThisDay = records.some(record => {
              const recordDate = new Date(record.created_at);
              return recordDate >= dayStart && recordDate < dayEnd;
            });
            
            if (hasRecordThisDay) {
              streak++;
            } else {
              // If no record for a day, streak breaks
              break;
            }
          }
          
          return streak;
        })(),
        biggestWin
      },
      personalInsights: {
        strongestSkill: aiInsights.distortionTrends.length > 0 
          ? `${aiInsights.distortionTrends[0]?.distortion} çarpıtmasını fark etme` 
          : 'Düşüncelerini analiz etme',
        growthArea: 'Reframe tekniklerini geliştirme',
        nextMilestone: records.length < 10 
          ? '10 düşünce kaydı tamamlama' 
          : 'İleri seviye CBT tekniklerini öğrenme',
        encouragement: currentEncouragement,
        actionableStep: records.length < 5 
          ? 'İstersen bugün bir düşünceni daha kaydedebilirsin. Alıştırma yapmak becerileri geliştirmeye yardımcı olur.'
          : 'Geçmiş kayıtlarına göz atarsan hangi çarpıtmaların azaldığını fark edebilirsin. İlerleme alanlarını görmek motivasyon verebilir.'
      },
      emotionalWellbeing: {
        beforeCBT: 4, // Mock data - could be from onboarding
        currentLevel: Math.min(10, Math.max(1, Math.round(
          records.length > 0 
            ? records.slice(0, 5).reduce((sum, r) => sum + r.mood_after, 0) / Math.min(5, records.length)
            : 5
        ))),
        weeklyTrend: (avgImprovement > 1 ? 'yükseliyor' : avgImprovement > 0 ? 'stabil' : 'düşüyor') as 'yükseliyor' | 'stabil' | 'düşüyor',
        recentMood: recentMood.length > 0 ? recentMood : [
          { day: 'Bugün', mood: 6, highlight: 'Başlangıç!' }
        ]
      },
      achievements: (() => {
        const achievements = [];
        
        // ✅ DYNAMIC: Generate achievements based on actual user progress
        if (records.length > 0) {
          achievements.push({
            title: 'CBT Yolculuğu Başladı',
            description: `${new Date(firstRecord).toLocaleDateString('tr-TR')} tarihinde ilk adımını attın`,
            date: firstRecord,
            celebration: '🌟',
            impact: 'Mental sağlık yolculuğunda cesaret gösterdin'
          });
        }
        
        // Progressive achievements based on real data
        if (records.length >= 3) {
          achievements.push({
            title: 'Düşünce Farkındalığı',
            description: `${records.length} düşünce kaydı ile pattern'lerin görünmeye başladı`,
            date: today,
            celebration: '🧠',
            impact: 'Düşüncelerini gözlemleme becerilerin gelişiyor'
          });
        }
        
        if (records.length >= 10) {
          achievements.push({
            title: 'CBT Tutarlılığı',
            description: `${records.length} kayıt ile istikrarlı bir uygulama sergiledın`,
            date: today,
            celebration: '💪',
            impact: 'CBT konusunda disiplinli bir yaklaşım geliştirdin'
          });
        }
        
        // Mood improvement based on actual data
        if (avgImprovement >= 1.5 && records.length >= 5) {
          achievements.push({
            title: 'Duygusal İyileşme Sağlandı',
            description: `Son kayıtlarda ortalama ${avgImprovement.toFixed(1)} puanlık iyileşme`,
            date: today,
            celebration: '☀️',
            impact: 'CBT tekniklerinin etkisini hissediyorsun'
          });
        }
        
        // High mood improvement achievement 
        const highImprovementRecords = records.filter(r => (r.mood_after - r.mood_before) >= 3).length;
        if (highImprovementRecords >= 3) {
          achievements.push({
            title: 'Etkili Çözüm Bulma',
            description: `${highImprovementRecords} kayıtta 3+ puanlık mood iyileşmesi sağladın`,
            date: today,
            celebration: '🎯',
            impact: 'CBT tekniklerini etkili bir şekilde uyguluyorsun'
          });
        }
        
        return achievements;
      })(),
      recommendations: [
        {
          title: 'Düşünce Gözlemi',
          description: 'İstersen günlük yaşamında olumsuz bir düşünceni fark edip kaydedebilirsin',
          difficulty: 'kolay' as const,
          timeToComplete: '5-10 dakika',
          benefits: 'Çarpıtmaları fark etme becerilerin gelişir'
        },
        {
          title: 'Perspektif Geliştirme',
          description: 'Düşüncen hakkında hem destekleyici hem karşıt görüşleri inceleyebilirsin',
          difficulty: 'orta' as const,
          timeToComplete: '10-15 dakika',
          benefits: 'Daha geniş bir perspektif kazanabilirsin'
        },
        {
          title: 'Alternatif Düşünce Geliştirme',
          description: 'Farklı bakış açıları geliştirebilir, alternatif yorumlar keşfedebilirsin',
          difficulty: 'ileri' as const,
          timeToComplete: '15-20 dakika',
          benefits: 'Düşünme esnekliğin artar'
        }
      ]
    };
  };

  // ✅ NEW: AI Analytics Helper Functions
  const analyzeDistortionTrends = (records: ThoughtRecord[], distortionCounts: Record<string, number>) => {
    const trends = [];
    const sortedDistortions = Object.entries(distortionCounts).sort(([,a], [,b]) => b - a);
    
    for (const [distortion, count] of sortedDistortions.slice(0, 5)) {
      // Calculate trend over time (simple approach)
      const distortionRecords = records.filter(r => r.distortions?.includes(distortion));
      const recentCount = distortionRecords.filter(r => {
        const recordDate = new Date(r.created_at);
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        return recordDate >= threeDaysAgo;
      }).length;
      
      const olderCount = distortionRecords.length - recentCount;
      const trendDirection = recentCount > olderCount ? 'declining' : 
                           recentCount < olderCount ? 'improving' : 'stable';
      
      trends.push({
        distortion,
        trend: trendDirection,
        change: recentCount - olderCount,
        frequency: count
      });
    }
    
    return trends;
  };

  const analyzeTechniqueEffectiveness = (records: ThoughtRecord[]) => {
    const techniques = [
      { name: 'Evidence Analysis', effectiveness: 0, count: 0 },
      { name: 'Reframing', effectiveness: 0, count: 0 },
      { name: 'Thought Challenging', effectiveness: 0, count: 0 }
    ];
    
    records.forEach(record => {
      const moodImprovement = record.mood_after - record.mood_before;
      
      // Evidence analysis technique
      if (record.evidence_for && record.evidence_against) {
        techniques[0].effectiveness += moodImprovement;
        techniques[0].count++;
      }
      
      // Reframing technique
      if (record.reframe && record.reframe.length > 20) {
        techniques[1].effectiveness += moodImprovement;
        techniques[1].count++;
      }
      
      // Thought challenging (has distortions identified)
      if (record.distortions && record.distortions.length > 0) {
        techniques[2].effectiveness += moodImprovement;
        techniques[2].count++;
      }
    });
    
    return techniques.map(tech => ({
      technique: tech.name,
      effectiveness: tech.count > 0 ? Math.round((tech.effectiveness / tech.count) * 10) / 10 : 0,
      confidence: Math.min(tech.count / 5, 1) // Confidence increases with more data
    })).filter(tech => tech.confidence > 0);
  };

  const generateProgressAnalysis = (records: ThoughtRecord[], totalMoodImprovement: number) => {
    const avgImprovement = records.length > 0 ? totalMoodImprovement / records.length : 0;
    
    if (avgImprovement >= 2.5) {
      return 'Harika ilerleme kaydediyorsunuz! CBT tekniklerini etkili şekilde kullanıyorsunuz.';
    } else if (avgImprovement >= 1.5) {
      return 'İyi bir ilerleme gösteriyorsunuz. Düşünce kayıtlarınız mood\'unuzu iyileştirmeye yardımcı oluyor.';
    } else if (avgImprovement >= 0.5) {
      return 'Düzenli kayıt tutmaya devam edin. Küçük iyileşmeler uzun vadede büyük fark yaratır.';
    } else {
      return 'CBT tekniklerini daha etkili kullanmak için rehberlik almayı düşünebilirsiniz.';
    }
  };

  const calculateRiskLevel = (records: ThoughtRecord[]): 'low' | 'medium' | 'high' => {
    const recentRecords = records.slice(0, 5); // Last 5 records
    
    if (recentRecords.length === 0) return 'low';
    
    const avgMoodBefore = recentRecords.reduce((sum, r) => sum + r.mood_before, 0) / recentRecords.length;
    const avgImprovement = recentRecords.reduce((sum, r) => sum + (r.mood_after - r.mood_before), 0) / recentRecords.length;
    
    if (avgMoodBefore <= 3 || avgImprovement <= 0) return 'high';
    if (avgMoodBefore <= 5 || avgImprovement <= 1) return 'medium';
    return 'low';
  };

  const generateHeuristicInsights = (records: ThoughtRecord[], distortionCounts: Record<string, number>, totalMoodImprovement: number) => {
    const avgImprovement = records.length > 0 ? totalMoodImprovement / records.length : 0;
    const topDistortion = Object.entries(distortionCounts).sort(([,a], [,b]) => b - a)[0];
    
    const recommendations = [];
    
    if (avgImprovement < 1) {
      recommendations.push('Kanıt analizi aşamasına daha çok zaman ayırın');
    }
    
    if (topDistortion && topDistortion[1] > records.length * 0.5) {
      recommendations.push(`${topDistortion[0]} çarpıtmasına odaklanın - en sık karşılaştığınız pattern`);
    }
    
    recommendations.push('Düşünce kaydı tutmaya devam edin - tutarlılık iyileşmenin anahtarı');
    
    return {
      distortionTrends: analyzeDistortionTrends(records, distortionCounts),
      techniqueEffectiveness: analyzeTechniqueEffectiveness(records),
      progressAnalysis: generateProgressAnalysis(records, totalMoodImprovement),
      recommendations: recommendations.slice(0, 3),
      riskLevel: calculateRiskLevel(records),
      nextFocus: recommendations[0] || 'CBT becerilerinizi geliştirmeye devam edin'
    };
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  };

  const handleFABPress = () => {
    console.log('🔴 FAB button pressed!');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQuickEntry(true);
    console.log('🔴 showQuickEntry set to true');
  };

  const handleRecordSaved = async () => {
    await loadAllData();
    
    // ✅ YENİ: Streak güncelle
    try {
      await useGamificationStore.getState().updateStreak();
      console.log('✅ Streak updated after CBT record');
    } catch (error) {
      console.error('⚠️ Streak update failed:', error);
    }
    
    // ✅ YENİ: CBT micro reward
    try {
      await useGamificationStore.getState().awardMicroReward('cbt_completed');
      console.log('✅ CBT completed micro reward awarded');
    } catch (error) {
      console.error('⚠️ CBT micro reward failed:', error);
    }
    
    setToastMessage('Düşünce kaydı başarıyla eklendi 🎯');
    setShowToast(true);
  };

  const deleteRecord = async (recordId: string) => {
    Alert.alert(
      'Kaydı Sil',
      'Bu düşünce kaydını silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from Supabase
              await supabaseService.deleteCBTRecord(recordId);
              
              // Also delete from local storage
              if (user?.id) {
                const key = StorageKeys.THOUGHT_RECORDS?.(user.id) || `thought_records_${user.id}`;
                const localData = await AsyncStorage.getItem(key);
                if (localData) {
                  const records = JSON.parse(localData);
                  const filtered = records.filter((r: ThoughtRecord) => r.id !== recordId);
                  await AsyncStorage.setItem(key, JSON.stringify(filtered));
                }
              }
              
              await loadAllData();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              setToastMessage('Kayıt silindi');
              setShowToast(true);
            } catch (error) {
              console.error('Error deleting record:', error);
              Alert.alert('Hata', 'Kayıt silinirken bir hata oluştu');
            }
          }
        }
      ]
    );
  };

  const getTimeRangeStats = () => {
    switch (selectedTimeRange) {
      case 'today':
        return {
          count: stats.todayCount,
          improvement: stats.avgMoodImprovement,
          label: 'Bugün'
        };
      case 'week':
        return {
          count: stats.weekCount,
          improvement: stats.avgMoodImprovement,
          label: 'Bu Hafta'
        };
      case 'month':
        return {
          count: stats.monthCount,
          improvement: stats.avgMoodImprovement,
          label: 'Bu Ay'
        };
    }
  };

  const timeRangeStats = getTimeRangeStats();
  const filteredRecords = thoughtRecords.slice(0, displayLimit);

  return (
    <ScreenLayout>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>CBT Düşünce Kaydı</Text>
          <Pressable
            style={styles.headerRight}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              console.log('📊 Opening CBT Progress Dashboard');
              setShowProgressDashboard(true);
            }}
          >
            <MaterialCommunityIcons name="chart-line" size={24} color="#3B82F6" />
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Date Display */}
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('tr-TR', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>

        {/* Summary Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <View>
              <Text style={styles.statsTitle}>
                Özet
              </Text>
            </View>
            {stats.successRate > 70 && (
              <View style={styles.successBadge}>
                <Text style={styles.successText}>🎯 %{stats.successRate}</Text>
              </View>
            )}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeRangeStats.count}</Text>
              <Text style={styles.statLabel}>Kayıt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: timeRangeStats.improvement > 0 ? '#10B981' : '#6B7280' }]}>
                {timeRangeStats.improvement > 0 ? '+' : ''}{timeRangeStats.improvement}
              </Text>
              <Text style={styles.statLabel}>Mood Değişimi</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.successRate}%</Text>
              <Text style={styles.statLabel}>Başarı Oranı</Text>
            </View>
          </View>

          {stats.mostCommonDistortion && (
            <View style={styles.insightContainer}>
              <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#F59E0B" />
              <Text style={styles.insightText}>
                En sık karşılaşılan çarpıtma: {stats.mostCommonDistortion}
              </Text>
            </View>
          )}
        </View>

        {/* Records List */}
        <View style={styles.listSection}>

          {filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="head-heart-outline" size={48} color="#E5E7EB" />
              <Text style={styles.emptyText}>Henüz kayıt yok</Text>
              <Text style={styles.emptySubtext}>
                Olumsuz düşüncelerinizi kaydedin ve yeniden çerçeveleyin
              </Text>
            </View>
          ) : (
            <View style={styles.recordsContainer}>
              {filteredRecords.map((record) => {
                const moodImprovement = record.mood_after - record.mood_before;
                const improvementColor = moodImprovement > 0 ? '#10B981' : 
                                        moodImprovement === 0 ? '#6B7280' : '#EF4444';

                return (
                  <View key={record.id} style={styles.recordCard}>
                    <View style={styles.recordContent}>
                      <View style={styles.recordHeader}>
                        <Text style={styles.recordTime}>
                          {new Date(record.created_at).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                        <View style={styles.moodChange}>
                          <Text style={styles.moodValue}>{record.mood_before}</Text>
                          <MaterialCommunityIcons name="arrow-right" size={14} color="#6B7280" />
                          <Text style={[styles.moodValue, { color: improvementColor }]}>
                            {record.mood_after}
                          </Text>
                          {moodImprovement !== 0 && (
                            <Text style={[styles.moodDiff, { color: improvementColor }]}>
                              ({moodImprovement > 0 ? '+' : ''}{moodImprovement})
                            </Text>
                          )}
                        </View>
                      </View>
                      
                      <Text style={styles.thoughtText} numberOfLines={2}>
                        {record.thought}
                      </Text>
                      
                      {record.distortions?.length > 0 && (
                        <View style={styles.distortionTags}>
                          {record.distortions.slice(0, 3).map((distortion, index) => (
                            <View key={index} style={styles.distortionTag}>
                              <Text style={styles.distortionTagText}>
                                {distortion.length > 15 ? distortion.substring(0, 15) + '...' : distortion}
                              </Text>
                            </View>
                          ))}
                          {record.distortions.length > 3 && (
                            <View style={styles.distortionTag}>
                              <Text style={styles.distortionTagText}>+{record.distortions.length - 3}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      
                      <View style={styles.reframePreview}>
                        <MaterialCommunityIcons name="lightbulb-outline" size={14} color="#3B82F6" />
                        <Text style={styles.reframeText} numberOfLines={1}>
                          {record.reframe}
                        </Text>
                      </View>
                    </View>
                    
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        deleteRecord(record.id);
                      }}
                      style={styles.deleteIcon}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color="#6B7280" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Show More Button */}
          {thoughtRecords.length > displayLimit && (
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
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        onPress={handleFABPress}
        position="fixed"
      />

      {/* CBT Quick Entry Modal */}
      <CBTQuickEntry
        visible={showQuickEntry}
        onDismiss={handleDismiss}
        onSubmit={handleRecordSaved}
        initialThought={params.text as string}
        initialTrigger={params.trigger as string}
        voiceAnalysisData={voiceAnalysisData}
      />

      {/* Toast */}
      <Toast
        message={toastMessage}
        type="success"
        visible={showToast}
        onHide={() => setShowToast(false)}
      />

      {/* ✅ NEW: User-Centric CBT Progress Dashboard */}
      <UserCentricCBTDashboard
        visible={showProgressDashboard}
        onClose={() => setShowProgressDashboard(false)}
        userJourney={generateUserJourneyData(thoughtRecords, stats.aiInsights)}
        onStartAction={(actionId) => {
          console.log('🎯 User started action:', actionId);
          // Handle specific actions (e.g., start a new thought record, practice a technique)
          if (actionId === 'next_step') {
            setShowProgressDashboard(false);
            setShowQuickEntry(true);
          }
        }}
      />

      {/* Debug AI Pipeline Overlay - Development Only */}
      {__DEV__ && FEATURE_FLAGS.isEnabled('DEBUG_MODE') && <DebugAIPipelineOverlay />}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
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
    color: '#3B82F6',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#3B82F6',
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: 'Inter',
  },
  // Stats Card
  statsCard: {
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
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  statsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  successBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    fontFamily: 'Inter',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  insightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  insightText: {
    fontSize: 13,
    color: '#92400E',
    fontFamily: 'Inter',
    flex: 1,
  },
  // List Section
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
  // Record Cards
  recordsContainer: {
    gap: 12,
  },
  recordCard: {
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
  recordContent: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  moodChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moodValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  moodDiff: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginLeft: 2,
  },
  thoughtText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  distortionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  distortionTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  distortionTagText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  reframePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  reframeText: {
    fontSize: 12,
    color: '#3B82F6',
    fontFamily: 'Inter',
    flex: 1,
  },
  deleteIcon: {
    padding: 8,
    marginLeft: 8,
  },
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
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
});