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
import { BottomSheet } from '@/components/ui/BottomSheet';
import moodTracker from '@/services/moodTrackingService';
import CheckinBottomSheet from '@/components/checkin/CheckinBottomSheet';
import BreathworkSuggestionCard from '@/components/ui/BreathworkSuggestionCard';
import { useGamificationStore } from '@/store/gamificationStore';
import * as Haptics from 'expo-haptics';

// Gamification Components
import { StreakCounter } from '@/components/gamification/StreakCounter';
import { AchievementBadge } from '@/components/gamification/AchievementBadge';
import { MicroRewardAnimation } from '@/components/gamification/MicroRewardAnimation';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Stores

// Storage utility & Privacy & Encryption
import { StorageKeys } from '@/utils/storage';
import { sanitizePII } from '@/utils/privacy';
import { secureDataService } from '@/services/encryption/secureDataService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// AI Integration - Sprint 7 via Context
import { useAI, useAIUserData, useAIActions } from '@/contexts/AIContext';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
// Removed CoreAnalysisService - using UnifiedAIPipeline only

// Unified AI Pipeline (ACTIVE - Jan 2025)
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
// import { shouldUseUnifiedPipeline } from '@/utils/gradualRollout'; // DEPRECATED - 100% rollout
import { BreathworkSuggestionService } from '@/features/ai/services/breathworkSuggestionService';
import { unifiedGamificationService, UnifiedMission } from '@/features/ai/services/unifiedGamificationService';

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
  const [achievementsSheetVisible, setAchievementsSheetVisible] = useState(false);
  
  // Breathwork suggestion state
  const [breathworkSuggestion, setBreathworkSuggestion] = useState<{
    show: boolean;
    trigger: string;
    protocol?: string;
    urgency?: string;
    anxietyLevel?: number;
    originalSuggestion?: any; // Store the full BreathworkSuggestion for advanced features
  } | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<Date | null>(null);
  
  // AI Integration via Context
  const { isInitialized: aiInitialized, availableFeatures } = useAI();
  const { hasCompletedOnboarding } = useAIUserData();
  const { generateInsights } = useAIActions();
  
  // Local AI State
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [isInsightsRunning, setIsInsightsRunning] = useState(false);
  const insightsPromiseRef = useRef<Promise<any[]> | null>(null);
  
  // ✅ FIXED: Progressive UI Timer Management - prevent overlapping pipeline runs
  const deepAnalysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Progressive UI State
  const [insightsSource, setInsightsSource] = useState<'cache' | 'heuristic' | 'llm'>('cache');
  const [hasDeepInsights, setHasDeepInsights] = useState(false);
  const [insightsConfidence, setInsightsConfidence] = useState(0);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // Gamification store
  const { 
    profile, 
    lastMicroReward,
    achievements
  } = useGamificationStore();
  const { awardMicroReward } = useGamificationStore.getState();

  // Today's stats
  const [todayStats, setTodayStats] = useState({
    compulsions: 0,
    healingPoints: 0,
    resistanceWins: 0
  });

  // ✅ AI-Generated Daily Missions State
  const [aiMissions, setAiMissions] = useState<UnifiedMission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);



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
        onRefresh();
        // Check for AI-powered breathwork suggestions
        checkBreathworkSuggestion();
      }
    }, [user?.id])
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
   * 🌬️ AI-Powered Breathwork Suggestions (NEW - Week 2)
   * Replaces static time-based checks with intelligent AI-driven recommendations
   */
  const checkBreathworkSuggestion = async () => {
    // Skip if not enabled or user not available
    if (!FEATURE_FLAGS.isEnabled('AI_BREATHWORK_SUGGESTIONS') || !user?.id) {
      return;
    }
    
    // Skip if already showing or snoozed
    if (breathworkSuggestion?.show || (snoozedUntil && new Date() < snoozedUntil)) {
      return;
    }

    try {
      // Prepare context data for AI service
      let moodScore: number | undefined = undefined;
      try {
        const lastMood = await moodTracker.getLastMoodEntry(user.id);
        moodScore = lastMood?.mood_score; // Use correct property name
      } catch (error) {
        console.warn('⚠️ Failed to get last mood entry for breathwork context:', error);
        // Ignore mood tracking errors
      }
      
      const contextData = {
        userId: user.id,
        currentTime: new Date(),
        moodScore,
        recentCompulsions: todayStats.compulsions,
        // ✅ FIXED: Clarify mood-to-anxiety conversion with proper scaling
        // moodScore is 0-100 scale: 0=terrible mood, 100=excellent mood
        // anxietyLevel is 1-10 scale: 1=low anxiety, 10=high anxiety  
        // Formula: high mood = low anxiety, low mood = high anxiety
        anxietyLevel: moodScore ? Math.max(1, Math.min(10, Math.round(11 - moodScore/10))) : undefined,
      };
      
      // ✅ FIXED: Use singleton instead of creating new instance  
      const breathworkService = BreathworkSuggestionService.getInstance();
      const suggestion = await breathworkService.generateSuggestion(contextData);
      
      if (suggestion) {
        // Convert BreathworkSuggestion to UI-compatible format
        const triggerType = suggestion.trigger?.type || 'general';
        const displayTrigger = suggestion.trigger?.reason || triggerType;
        
        console.log('🌬️ AI Breathwork suggestion generated:', displayTrigger);
        
        setBreathworkSuggestion({
          show: true, // If suggestion exists, show it
          trigger: displayTrigger,
          protocol: suggestion.protocol?.name,
          urgency: suggestion.urgency,
          anxietyLevel: contextData.anxietyLevel,
          originalSuggestion: suggestion, // Store full object for advanced features
        });
        
        // Track AI breathwork suggestion
        await trackAIInteraction(AIEventType.BREATHWORK_SUGGESTION_GENERATED, {
          userId: user.id,
          trigger: triggerType,
          urgency: suggestion.urgency,
          protocol: suggestion.protocol?.name || 'unknown',
          anxietyLevel: contextData.anxietyLevel || 0,
        });
      } else {
        console.log('🚫 No breathwork suggestion needed at this time');
      }
    } catch (error) {
      console.warn('⚠️ AI breathwork suggestion failed, falling back to static check:', error);
      
      // Fallback to simplified static logic
      const now = new Date();
      const hour = now.getHours();
      
      // Simple morning/evening fallback
      if ((hour >= 7 && hour < 9) || (hour >= 21 && hour < 23)) {
        setBreathworkSuggestion({
          show: true,
          trigger: hour < 12 ? 'morning' : 'evening',
        });
      }
    }
  };

  /**
   * 🎯 Load AI-Generated Daily Missions
   */
  const loadAIMissions = async () => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_DYNAMIC_MISSIONS')) {
      return;
    }

    try {
      setMissionsLoading(true);
      const missions = await unifiedGamificationService.generateUnifiedMissions(user.id);
      setAiMissions(missions);

      await trackAIInteraction(AIEventType.GAMIFICATION_MISSIONS_GENERATED, {
        userId: user.id,
        missionCount: missions.length,
        aiGenerated: missions.filter(m => m.aiGenerated).length,
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn('⚠️ Failed to load AI missions:', error);
      setAiMissions([]); // Clear on error
    } finally {
      setMissionsLoading(false);
    }
  };

  /**
   * 🚀 Load data using Unified AI Pipeline with Privacy-First Processing
   */
  const loadUnifiedPipelineData = async () => {
    if (!user?.id) return;
    
    try {
      setAiInsightsLoading(true);
      const startTime = Date.now();
      
      console.log('🚀 Using Unified AI Pipeline with Privacy-First Processing');
      
      // Gather and sanitize local data for privacy
      const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
      const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
      const rawCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];
      
      // 🔒 Privacy-First: Sanitize compulsions before AI processing
      const sanitizedCompulsions = rawCompulsions.map((c: any) => ({
        ...c,
        notes: c.notes ? sanitizePII(c.notes) : c.notes,
        trigger: c.trigger ? sanitizePII(c.trigger) : c.trigger,
        // Keep structured data intact, only sanitize text
        timestamp: c.timestamp,
        severity: c.severity,
        resistanceLevel: c.resistanceLevel,
        category: c.category
      }));
      
      // ✅ FIXED: Load and sanitize mood entries for unified pipeline analysis
      const rawMoods = await moodTracker.getMoodEntries(user.id, 7); // Last 7 days
      const sanitizedMoods = rawMoods.map((m: any) => ({
        ...m,
        notes: m.notes ? sanitizePII(m.notes) : m.notes,
        // Keep structured data intact for pattern analysis
        mood_score: m.mood_score,
        energy_level: m.energy_level,
        anxiety_level: m.anxiety_level,
        timestamp: m.timestamp,
        triggers: m.triggers,
        activities: m.activities
      }));
      
      console.log(`📊 Loaded ${sanitizedCompulsions.length} compulsions + ${sanitizedMoods.length} mood entries for AI analysis`);
      
      // ✅ ENCRYPT sensitive AI payload data (not just sanitize)
      const sensitivePayload = {
        compulsions: sanitizedCompulsions,
        moods: sanitizedMoods, // ✅ FIXED: Include mood entries for pattern recognition
        // erpSessions: [], // Removed ERP module
      };
      
      let encryptedPayload;
      try {
        encryptedPayload = await secureDataService.encryptSensitiveData(sensitivePayload);
        
        // ✅ FIXED: Log integrity metadata for auditability (as promised in docs)
        console.log('🔐 Sensitive AI payload encrypted with AES-256');
        console.log(`🔍 Integrity hash: ${encryptedPayload.hash?.substring(0, 8)}...`);
        console.log(`⏰ Encrypted at: ${new Date(encryptedPayload.timestamp || 0).toISOString()}`);
      } catch (error) {
        console.warn('⚠️ Encryption failed, using sanitized data:', error);
        encryptedPayload = sensitivePayload; // fallback to sanitized data
      }
      
      // Call Unified Pipeline with encrypted data
      const result = await unifiedPipeline.process({
        userId: user.id, // User ID is hashed in pipeline for privacy
        content: encryptedPayload,
        type: 'mixed',
        context: {
          source: 'today',
          timestamp: Date.now(),
          privacy: {
            piiSanitized: true,
            encryptionLevel: encryptedPayload.algorithm === 'SHA256_FALLBACK' ? 'fallback_hash' : 
                           encryptedPayload.algorithm ? 'aes256' : 'sanitized',
            encrypted: encryptedPayload.algorithm && encryptedPayload.algorithm !== 'SHA256_FALLBACK'
          }
        }
      });
      
      // Process insights from unified result
      if (result.insights) {
        const formattedInsights = [
          ...result.insights.therapeutic.map(i => ({
            text: i.text,
            category: i.category,
            priority: i.priority
          })),
          ...result.insights.progress.map(p => ({
            text: p.interpretation,
            category: 'progress',
            priority: 'medium'
          }))
        ];
        
        setAiInsights(formattedInsights);
        setInsightsSource(result.metadata.source);
        setInsightsConfidence(0.85);
      }
      
      // Track telemetry
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_COMPLETED, {
        userId: user.id,
        processingTime: Date.now() - startTime,
        cacheHit: result.metadata.source === 'cache'
      });
      
    } catch (error) {
      console.error('Unified Pipeline error:', error);
    } finally {
      setAiInsightsLoading(false);
    }
  };

  /**
   * 🤖 Load AI Insights with Progressive UI (Restored)
   */
  const loadAIInsights = async () => {
    if (!user?.id || !aiInitialized || !availableFeatures.includes('AI_INSIGHTS')) {
      return;
    }
    
    if (!FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE')) {
      // Fall back to single call if Progressive UI disabled
      await loadUnifiedPipelineData();
      return;
    }

    try {
      setAiInsightsLoading(true);
      
      // PHASE 1: Immediate Insights (<500ms)
      // Load from cache or generate quick heuristic insights
      const cacheKey = `ai:${user.id}:${new Date().toISOString().split('T')[0]}:insights`;
      
      try {
        // Try to get cached insights first
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setAiInsights(cachedData.insights || []);
          setInsightsSource('cache');
          setInsightsConfidence(cachedData.confidence || 0.7);
          console.log('✅ Phase 1: Loaded insights from cache');
        } else {
          // Generate immediate heuristic insights
          const quickInsights = await generateQuickInsights();
          setAiInsights(quickInsights);
          setInsightsSource('heuristic');
          setInsightsConfidence(0.6);
          console.log('✅ Phase 1: Generated heuristic insights');
        }
      } catch (error) {
        console.warn('⚠️ Phase 1 failed, continuing to Phase 2:', error);
      }
      
      // PHASE 2: Deep Analysis (Background, 3s delay)
      // ✅ FIXED: Clear existing timer to prevent overlapping runs
      if (deepAnalysisTimerRef.current) {
        clearTimeout(deepAnalysisTimerRef.current);
        console.log('🔄 Cleared existing deep analysis timer');
      }
      
      deepAnalysisTimerRef.current = setTimeout(async () => {
        try {
          console.log('🚀 Phase 2: Starting deep analysis...');
          await loadUnifiedPipelineData();
          setHasDeepInsights(true);
          console.log('✅ Phase 2: Deep insights loaded');
        } catch (error) {
          console.warn('⚠️ Phase 2 deep analysis failed:', error);
        } finally {
          // Clear timer ref when done
          deepAnalysisTimerRef.current = null;
        }
      }, 3000);
      
    } finally {
      setAiInsightsLoading(false);
    }
  };
  
  /**
   * Generate quick heuristic insights for Phase 1
   */
  const generateQuickInsights = async (): Promise<any[]> => {
    const quickInsights = [];
    
    // Basic motivation message
    quickInsights.push({
      text: "Bugün mücadelene devam etmeye hazır mısın? Güçlü olduğunu unutma!",
      category: 'motivation',
      priority: 'medium'
    });
    
    // Time-based insights
    const hour = new Date().getHours();
    if (hour < 12) {
      quickInsights.push({
        text: "Günaydın! Bugünü güçlü bir başlangıçla karşılıyorsun.",
        category: 'daily',
        priority: 'low'
      });
    } else if (hour > 18) {
      quickInsights.push({
        text: "Bugün nasıl geçti? Nefes alma egzersizleri rahatlatabilir.",
        category: 'evening',
        priority: 'medium'
      });
    }
    
    return quickInsights;
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

      // Load today's compulsions
      const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
      const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
      const allCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];
      const today = new Date().toDateString();
      const todayCompulsions = allCompulsions.filter((c: any) => 
        new Date(c.timestamp).toDateString() === today
      );
      
      // Calculate resistance wins
      const resistanceWins = todayCompulsions.filter((c: any) => c.resistanceLevel >= 3).length;
      
      // (Removed) Load today's ERP sessions
      // (Removed) ERP session loading code
      
      // (Removed) ERP session logs
      
      setTodayStats({
        compulsions: todayCompulsions.length,
        // erpSessions: 0, // Removed ERP
        healingPoints: profile.healingPointsToday,
        resistanceWins
      });

      // Load AI Insights if enabled
      await loadAIInsights();
      
      // ✅ Load AI-Generated Daily Missions
      await loadAIMissions();
      
      console.log('📊 Today stats updated:', {
        compulsions: todayCompulsions.length,
        // erpSessions: 0, // Removed ERP
        healingPoints: profile.healingPointsToday,
        resistanceWins
      });
      
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
      trackAIInteraction(AIEventType.ROUTE_FOLLOWED, {
        userId: user?.id,
        routeType: routingResult.type,
        confidence: routingResult.confidence,
        source: 'voice_checkin'
      });
      
      // Auto-navigate based on AI analysis (optional - user can dismiss)
      const shouldAutoNavigate = routingResult.confidence > 0.7;
      
      if (shouldAutoNavigate && routingResult.screen) {
        setTimeout(() => {
          // Give user a moment to see the analysis, then navigate
          router.push({
            pathname: `/(tabs)/${routingResult.screen}` as any,
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

  const renderDailyMissions = () => {
    // ✅ FIXED: Use AI-Generated Daily Missions instead of hard-coded ones
    const missionsToRender = aiMissions.length > 0 ? aiMissions : [];

    return (
    <View style={styles.missionsSection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="auto-fix" size={20} color="#10B981" />
        <Text style={styles.sectionTitle}>
          {aiMissions.length > 0 ? 'AI Kişisel Öneriler' : 'Bugün için öneriler'}
        </Text>
      </View>

        {missionsLoading ? (
          <View style={[styles.missionCard, { justifyContent: 'center', alignItems: 'center', height: 80 }]}>
            <MaterialCommunityIcons name="loading" size={24} color="#10B981" />
            <Text style={[styles.missionProgressText, { marginTop: 8 }]}>Kişiselleştirilmiş öneriler hazırlanıyor...</Text>
          </View>
        ) : missionsToRender.length > 0 ? (
          <View style={styles.missionsList}>
            {missionsToRender.slice(0, 3).map((mission, index) => (
              <Pressable 
                key={mission.id}
                style={[
                  styles.missionCard,
                  mission.currentProgress >= mission.targetValue && styles.missionCardCompleted
                ]}
                onPress={() => {
                  // Navigate based on mission category
                  switch (mission.category) {
                    case 'compulsion':
                      router.push('/(tabs)/tracking');
                      break;
                    case 'mood':
                      setCheckinSheetVisible(true);
                      break;
                    case 'breathwork':
                      router.push('/(tabs)/breathwork');
                      break;
                    case 'consistency':
                      router.push('/(tabs)/tracking');
                      break;
                    case 'challenge':
                      router.push('/(tabs)/cbt');
                      break;
                    default:
                      router.push('/(tabs)/tracking');
                  }
                }}
              >
                <View style={styles.missionIcon}>
                  <MaterialCommunityIcons 
                    name={mission.currentProgress >= mission.targetValue ? "check-circle" : 
                          mission.category === 'compulsion' ? "heart-outline" :
                          mission.category === 'mood' ? "emoticon-happy-outline" :
                          mission.category === 'breathwork' ? "meditation" :
                          mission.category === 'consistency' ? "calendar-check" :
                          mission.category === 'challenge' ? "trophy-outline" :
                          "target"}
                    size={30} 
                    color={mission.currentProgress >= mission.targetValue ? "#10B981" : "#D1D5DB"} 
                  />
                </View>
                <View style={styles.missionContent}>
                  <Text style={styles.missionTitle}>{mission.title}</Text>
                  <Text style={styles.missionDescription} numberOfLines={1}>
                    {mission.personalizedMessage}
                  </Text>
                  <View style={styles.missionProgress}>
                    <View style={styles.missionProgressBar}>
                      <View style={[
                        styles.missionProgressFill, 
                        { width: `${Math.min((mission.currentProgress / mission.targetValue) * 100, 100)}%` }
                      ]} />
                    </View>
                    <Text style={styles.missionProgressText}>
                      {mission.currentProgress}/{mission.targetValue}
                    </Text>
                  </View>
                  {mission.aiGenerated && (
                    <View style={styles.missionTags}>
                      <Text style={[styles.missionTag, { backgroundColor: '#E0F2FE', color: '#0EA5E9' }]}>
                        AI Önerisi
                      </Text>
                      <Text style={[styles.missionTag, { backgroundColor: '#FEF3C7', color: '#F59E0B' }]}>
                        {mission.difficulty.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.missionReward}>
                  <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.missionRewardText}>+{mission.healingPoints}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          // Fallback to static missions if AI missions unavailable
          <View style={styles.missionsList}>
            <Pressable 
              style={styles.missionCard}
              onPress={() => router.push('/(tabs)/tracking')}
            >
              <View style={styles.missionIcon}>
                <MaterialCommunityIcons 
                  name={todayStats.compulsions >= 3 ? "heart" : "heart-outline"} 
                  size={30} 
                  color={todayStats.compulsions >= 3 ? "#10B981" : "#D1D5DB"} 
                />
              </View>
              <View style={styles.missionContent}>
                <Text style={styles.missionTitle}>Bugünkü Yolculuğun</Text>
                <View style={styles.missionProgress}>
                  <View style={styles.missionProgressBar}>
                    <View style={[styles.missionProgressFill, { width: `${Math.min((todayStats.compulsions / 3) * 100, 100)}%` }]} />
                  </View>
                  <Text style={styles.missionProgressText}>{todayStats.compulsions}/3 kayıt</Text>
                </View>
              </View>
              <View style={styles.missionReward}>
                <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                <Text style={styles.missionRewardText}>+50</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  /**
   * 🤖 Render AI Insights Widget
   */
  const renderAIInsights = () => {
    if (!FEATURE_FLAGS.isEnabled('AI_INSIGHTS') || !user?.id) {
      return null;
    }

    return (
      <View style={[styles.aiInsightsSection, { marginTop: 16 }]}> {/* Üstte "Bugün için öneriler" ile boşluk */}
        {/* Başlık kaldırıldı: kartların içinde zaten "İçgörü" etiketi var */}

        {/* AI Onboarding CTA */}
        {!hasCompletedOnboarding && (
          <Pressable 
            style={styles.aiOnboardingCTA}
            onPress={() => router.push({
              pathname: '/(auth)/onboarding',
              params: { fromSettings: 'false', resume: 'true' }
            })}
          >
            <View style={styles.aiOnboardingCTAContent}>
              <MaterialCommunityIcons name="rocket-launch" size={32} color="#3b82f6" />
              <View style={styles.aiOnboardingCTAText}>
                <Text style={styles.aiOnboardingCTATitle}>AI Destekli Değerlendirme</Text>
                <Text style={styles.aiOnboardingCTASubtitle}>
                  Size özel tedavi planı ve içgörüler için AI onboarding'i tamamlayın. Kaldığın yerden devam edebilirsin.
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#3b82f6" />
            </View>
          </Pressable>
        )}

        {/* AI Insights Cards - outlined card */}
        {hasCompletedOnboarding && aiInsights.length > 0 && (
          <View style={styles.aiInsightsContainer}>
            {aiInsights.slice(0, 2).map((insight, index) => {
              const accentColor = insight.type === 'pattern' ? '#3B82F6' : insight.type === 'trend' ? '#F59E0B' : '#10B981';
              const iconName = insight.type === 'pattern' 
                ? 'chart-line' 
                : insight.type === 'trend' 
                  ? 'chart-timeline-variant' 
                  : 'lightbulb-on-outline';
              return (
              <View key={index} style={[styles.aiInsightCardOutlined, { borderLeftWidth: 6, borderLeftColor: accentColor }] }>
                <View style={styles.aiInsightHeader}>
                  <MaterialCommunityIcons 
                    name={iconName as any} 
                    size={20} 
                    color={accentColor} 
                  />
                  <Text style={styles.aiInsightType}>{insight.category || 'İçgörü'}</Text>
                  {/* Progressive UI: Show update badge */}
                  {hasDeepInsights && index === 0 && (
                    <View style={{
                      backgroundColor: '#10B981',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                      marginLeft: 'auto',
                    }}>
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                        Güncellendi
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.aiInsightText}>{insight.message}</Text>
                {insight.confidence && (
                  <View style={styles.aiInsightMeta}>
                    <Text style={styles.aiInsightConfidence}>
                      Güvenilirlik: {Math.round(insight.confidence * 100)}%
                    </Text>
                    {/* Progressive UI: Show source */}
                    {FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE') && (
                      <Text style={[styles.aiInsightConfidence, { marginLeft: 10 }]}>
                        Kaynak: {insightsSource === 'cache' ? 'Önbellek' : 
                                insightsSource === 'heuristic' ? 'Hızlı Analiz' : 'Derin Analiz'}
                      </Text>
                    )}
                  </View>
                )}
              </View>
              );
            })}
          </View>
        )}

        {/* No Insights State */}
        {aiInsights.length === 0 && !aiInsightsLoading && (
          <View style={styles.noInsightsCard}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={32} color="#9ca3af" />
            <Text style={styles.noInsightsText}>
              Henüz kişisel içgörü üretmek için yeterli veri yok. ERP oturumları ve günlük kayıtlar arttıkça öneriler burada görünecek.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderQuickStats = () => (
    <View style={styles.quickStatsSection}>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="calendar-today" size={30} color="#10B981" />
        <Text style={styles.quickStatValue}>{todayStats.compulsions}</Text>
        <Text style={styles.quickStatLabel}>Today</Text>
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="fire" size={30} color="#F59E0B" />
        <Text style={styles.quickStatValue}>{profile.streakCurrent}</Text>
        <Text style={styles.quickStatLabel}>Streak</Text>
      </View>
      <View style={[styles.quickStatCard, styles.quickStatCardDisabled]}>
        <MaterialCommunityIcons name="shield-off" size={30} color="#9CA3AF" />
        <Text style={styles.quickStatValue}>-</Text>
        <Text style={styles.quickStatLabel}>Removed</Text>
      </View>
    </View>
  );

  const renderAchievements = () => {
    // Merge achievements with unlocked status from profile
    const achievementsWithStatus = achievements.map(achievement => ({
      ...achievement,
      unlockedAt: profile.unlockedAchievements.includes(achievement.id) ? new Date() : undefined
    }));

    // Sort: unlocked first, then by rarity
    const sortedAchievements = achievementsWithStatus.sort((a, b) => {
      if (a.unlockedAt && !b.unlockedAt) return -1;
      if (!a.unlockedAt && b.unlockedAt) return 1;
      if (a.rarity === 'Epic' && b.rarity !== 'Epic') return -1;
      if (a.rarity !== 'Epic' && b.rarity === 'Epic') return 1;
      return 0;
    });

    const unlockedCount = profile.unlockedAchievements.length;

    return (
      <View style={styles.achievementsSection}>

        <Pressable 
          onPress={() => setAchievementsSheetVisible(true)} 
          accessibilityRole="button" 
          accessibilityLabel="Rozet ve başarı sayılarım"
          style={({ pressed }) => [styles.achievementsCard, pressed && styles.achievementsCardPressed]}
        >
          <View style={styles.achBtnContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <MaterialCommunityIcons name="trophy" size={18} color="#374151" />
              <Text style={styles.achBtnLabel} numberOfLines={1} ellipsizeMode="tail">Başarılarım</Text>
            </View>
            <View style={styles.achBtnBadge}>
              <Text style={styles.achBtnBadgeText}>{unlockedCount}/{achievements.length}</Text>
            </View>
          </View>
        </Pressable>

        <BottomSheet isVisible={achievementsSheetVisible} onClose={() => setAchievementsSheetVisible(false)}>
          <Text style={styles.sheetTitle}>Başarımlarım ({unlockedCount}/{achievements.length})</Text>
          {/* Özet satırı */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="star-outline" size={18} color="#10B981" />
              <Text style={styles.summaryValue}>{profile.healingPointsTotal}</Text>
              <Text style={styles.summaryLabel}>Healing Points</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="trophy-outline" size={18} color="#F59E0B" />
              <Text style={styles.summaryValue}>{unlockedCount}</Text>
              <Text style={styles.summaryLabel}>Açılan Rozet</Text>
            </View>
          </View>
          {/* Sade tasarım: filtre/sıralama kaldırıldı */}
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            <View style={styles.achievementGrid}>
              {sortedAchievements.map((achievement) => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  isUnlocked={!!achievement.unlockedAt}
                  onPress={() => {
                    setToastMessage(
                      achievement.unlockedAt 
                        ? `🏆 ${achievement.title} - ${achievement.description}` 
                        : `🔒 ${achievement.title} - Henüz açılmadı`
                    );
                    setShowToast(true);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </BottomSheet>
      </View>
    );
  };

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
        
        {/* Breathwork Suggestion Card */}
        {breathworkSuggestion?.show && (
          <BreathworkSuggestionCard
            trigger={breathworkSuggestion.trigger}
            anxietyLevel={breathworkSuggestion.anxietyLevel}
            onAccept={() => {
              // Navigate to breathwork as documented
              router.push({
                pathname: '/(tabs)/breathwork',
                params: {
                  protocol: breathworkSuggestion.anxietyLevel && breathworkSuggestion.anxietyLevel >= 7 ? '4-7-8' : 'box',
                  autoStart: 'true',
                  source: 'today_suggestion',
                }
              });
            }}
            onSnooze={() => {
              // 15 dakika erteleme as documented
              setSnoozedUntil(new Date(Date.now() + 15 * 60 * 1000));
              setBreathworkSuggestion(null);
            }}
            onDismiss={() => {
              // Bu oturum için kapat as documented
              setBreathworkSuggestion(null);
            }}
            // Optional advanced props for enhanced functionality
            userId={user?.id}
            suggestion={breathworkSuggestion.originalSuggestion}
            context={{
              moodScore: breathworkSuggestion.originalSuggestion?.trigger?.contextData?.moodScore,
              recentCompulsions: todayStats.compulsions,
            }}
            onGenerate={(suggestion) => {
              // Update state when new suggestion is generated
              setBreathworkSuggestion({
                show: true,
                trigger: suggestion.trigger.reason || suggestion.trigger.type,
                protocol: suggestion.protocol.name,
                urgency: suggestion.urgency,
                anxietyLevel: suggestion.trigger.contextData.anxietyLevel,
                originalSuggestion: suggestion,
              });
            }}
          />
        )}
        
        {renderQuickMoodEntry()}
        {renderQuickStats()}
        {/* Risk section removed */}
        {renderArtTherapyWidget()}
        {renderDailyMissions()}
        {renderAIInsights()}
        {renderAchievements()}
        
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={showToast && toastMessage.includes('hata') ? 'error' : 'success'}
        visible={showToast}
        onHide={() => setShowToast(false)}
      />
      
      {/* Micro Reward Animation */}
      {lastMicroReward && (
        <MicroRewardAnimation 
          reward={lastMicroReward}
          onComplete={() => {}}
        />
      )}


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
  missionsList: {
    flexDirection: 'column',
    gap: 16,
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  missionCardOutlined: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  missionCardCompleted: {
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  missionIcon: {
    marginRight: 16,
  },
  missionIconCircle: {
    marginRight: 16,
  },
  missionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  missionCircleCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  missionContent: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  missionDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  missionProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  missionProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  missionProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  missionProgressText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    minWidth: 50,
  },
  missionReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  missionRewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    fontFamily: 'Inter-Semibold',
    marginLeft: 4,
  },
  missionTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  missionTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B5CF6',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
  achievementsSection: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  achievementsButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  achievementsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  achievementsCardPressed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#D1FAE5',
  },
  achBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 200,
  },
  achBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  achBtnBadge: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  achBtnBadgeText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
    marginRight: 4,
  },
  bottomSpacing: {
    height: 100,
  },
  
  // AI Insights Styles
  aiInsightsSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  aiOnboardingCTA: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  aiOnboardingCTAContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiOnboardingCTAText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  aiOnboardingCTATitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  aiOnboardingCTASubtitle: {
    fontSize: 14,
    color: '#3b82f6',
    lineHeight: 20,
  },
  aiInsightsContainer: {
    gap: 12,
  },
  aiInsightCardOutlined: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiInsightType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  aiInsightText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  aiInsightMeta: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  aiInsightConfidence: {
    fontSize: 11,
    color: '#6b7280',
  },
  noInsightsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noInsightsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
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
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: -6,
    marginBottom: 12,
  },
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
  
  // Disabled mission card stilleri
  missionCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  
  // Disabled quick stat card stilleri
  quickStatCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
});