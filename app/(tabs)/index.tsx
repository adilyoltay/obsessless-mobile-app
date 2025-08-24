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
import BreathworkSuggestionCard from '@/components/ui/BreathworkSuggestionCard';
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
import { BreathworkSuggestionService } from '@/features/ai/services/breathworkSuggestionService';
import { unifiedGamificationService, UnifiedMission } from '@/features/ai/services/unifiedGamificationService';

// 🎯 JITAI/Adaptive Interventions (NEW - Minimal Trigger Hook)
import { useAdaptiveSuggestion, AdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';
import AdaptiveSuggestionCard from '@/components/ui/AdaptiveSuggestionCard';
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

  // ✅ AI-Generated Daily Missions State
  const [aiMissions, setAiMissions] = useState<UnifiedMission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  
  // 🎯 Adaptive Interventions State (JITAI)
  const [adaptiveSuggestion, setAdaptiveSuggestion] = useState<AdaptiveSuggestion | null>(null);
  const adaptiveRef = useRef<boolean>(false); // Prevent duplicate triggers
  const { generateSuggestion, snoozeSuggestion, trackSuggestionClick, trackSuggestionDismissal, loading: adaptiveLoading } = useAdaptiveSuggestion();



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
        
        // 🎯 Reset adaptive suggestion ref for potential re-trigger
        adaptiveRef.current = false;
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
   * 🚀 Load AI Insights with ALL modules data
   */
  const loadAIInsightsWithAllModules = async (allModuleData: {
    compulsions: any[];
    cbtRecords: any[];
    moodEntries: any[];
    breathworkSessions: any[];
  }) => {
    if (!user?.id) return;
    
    // Check AI_UNIFIED_PIPELINE flag - fallback to phase-1 heuristics if disabled
    if (!FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE')) {
      console.log('⚠️ AI_UNIFIED_PIPELINE disabled - falling back to phase-1 insights');
      await generateQuickInsights(); // Fallback to phase-1 heuristic path
      return;
    }
    
    try {
      setAiInsightsLoading(true);
      const startTime = Date.now();
      
      console.log('🚀 Using Unified AI Pipeline with ALL MODULE DATA');
      
      // 🔒 Privacy-First: Sanitize all module data
      const sanitizedData = {
        compulsions: allModuleData.compulsions.map((c: any) => ({
          ...c,
          notes: c.notes ? sanitizePII(c.notes) : c.notes,
          trigger: c.trigger ? sanitizePII(c.trigger) : c.trigger,
          timestamp: c.timestamp,
          severity: c.severity,
          resistanceLevel: c.resistanceLevel,
          category: c.category
        })),
        cbtRecords: allModuleData.cbtRecords.map((r: any) => ({
          ...r,
          situation: r.situation ? sanitizePII(r.situation) : r.situation,
          automatic_thought: r.automatic_thought ? sanitizePII(r.automatic_thought) : r.automatic_thought,
          notes: r.notes ? sanitizePII(r.notes) : r.notes,
          timestamp: r.timestamp,
          mood_before: r.mood_before,
          mood_after: r.mood_after
        })),
        moods: allModuleData.moodEntries.map((m: any) => ({
          ...m,
          notes: m.notes ? sanitizePII(m.notes) : m.notes,
          mood_score: m.mood_score,
          energy_level: m.energy_level,
          anxiety_level: m.anxiety_level,
          timestamp: m.timestamp,
          triggers: m.triggers,
          activities: m.activities
        })),
        breathworkSessions: allModuleData.breathworkSessions.map((s: any) => ({
          ...s,
          notes: s.notes ? sanitizePII(s.notes) : s.notes,
          protocol: s.protocol,
          duration: s.duration,
          timestamp: s.timestamp
        }))
      };
      
      console.log(`📊 FULL MODULE DATA: ${sanitizedData.compulsions.length} compulsions + ${sanitizedData.cbtRecords.length} CBT + ${sanitizedData.moods.length} mood + ${sanitizedData.breathworkSessions.length} breathwork`);
      
      // ✅ ENCRYPT sensitive payload
      let encryptedPayload;
      try {
        encryptedPayload = await secureDataService.encryptSensitiveData(sanitizedData);
        console.log('🔐 ALL MODULE DATA encrypted with AES-256');
      } catch (error) {
        console.warn('⚠️ Encryption failed, using sanitized data:', error);
        encryptedPayload = sanitizedData;
      }
      
      // Call Unified Pipeline with ALL module data
      const result = await unifiedPipeline.process({
        userId: user.id,
        content: sanitizedData,
        type: 'mixed',
        context: {
          source: 'today',
          timestamp: Date.now(),
          includeAllModules: true,
          privacy: {
            piiSanitized: true,
            encryptionLevel: 'sanitized_plaintext',
            dataEncrypted: encryptedPayload
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
        
        // ✅ TELEMETRY: INSIGHTS_DELIVERED event zenginleştirme
        await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
          userId: user.id,
          insightsCount: formattedInsights.length,
          from: result.metadata.source === 'cache' ? 'cache' : 'pipeline',
          therapeuticInsights: result.insights.therapeutic?.length || 0,
          progressInsights: result.insights.progress?.length || 0,
          confidence: 0.85,
          moduleSource: 'all_modules_integrated',
          timestamp: Date.now()
        });
      }
      
      // Track telemetry - Zenginleştirilmiş
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_COMPLETED, {
        userId: user.id,
        processingTime: Date.now() - startTime,
        cacheHit: result.metadata.source === 'cache',
        moduleCount: 4, // compulsions + cbt + mood + breathwork
        dataPoints: sanitizedData.compulsions.length + sanitizedData.cbtRecords.length + sanitizedData.moods.length + sanitizedData.breathworkSessions.length,
        insightsCount: result.insights ? 
          (result.insights.therapeutic?.length || 0) + (result.insights.progress?.length || 0) : 0,
        source: 'all_modules_integrated',
        moduleBreakdown: {
          compulsions: sanitizedData.compulsions.length,
          cbt: sanitizedData.cbtRecords.length,
          mood: sanitizedData.moods.length,
          breathwork: sanitizedData.breathworkSessions.length
        }
      });
      
    } catch (error) {
      console.error('Unified Pipeline (ALL MODULES) error:', error);
    } finally {
      setAiInsightsLoading(false);
    }
  };

  /**
   * 🚀 Load data using Unified AI Pipeline with Privacy-First Processing (LEGACY)
   */
  const loadUnifiedPipelineData = async () => {
    if (!user?.id) return;
    
    // Check AI_UNIFIED_PIPELINE flag - fallback to phase-1 heuristics if disabled  
    if (!FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE')) {
      console.log('⚠️ AI_UNIFIED_PIPELINE disabled - falling back to phase-1 insights');
      await generateQuickInsights(); // Fallback to phase-1 heuristic path
      return;
    }
    
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
      
      // Call Unified Pipeline with sanitized (not encrypted) data for analysis
      // Encryption is only used for storage/telemetry, not for AI processing
      const result = await unifiedPipeline.process({
        userId: user.id, // User ID is hashed in pipeline for privacy
        content: sensitivePayload, // ✅ FIX: Use sanitized but unencrypted data for AI analysis
        type: 'mixed',
        context: {
          source: 'today',
          timestamp: Date.now(),
          privacy: {
            piiSanitized: true,
            encryptionLevel: 'sanitized_plaintext', // For AI processing
            dataEncrypted: encryptedPayload // Store encrypted version for telemetry/audit
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
      // ✅ FIXED: Use same cache key format as AIContext for consistency
      const cacheKey = `ai_cached_insights_${safeStorageKey(user.id)}`;
      
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
          console.log('🚀 Phase 2: Starting deep analysis with ALL MODULE DATA...');
          
          // ✅ FIXED: Use comprehensive module data in Phase-2
          // Gather all module data for deep analysis
          const today = new Date().toDateString();
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          // Collect all module data (same as onRefresh logic)
          const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
          const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
          const allCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];

          const thoughtRecordsKey = StorageKeys.THOUGHT_RECORDS(user.id);
          const cbtData = await AsyncStorage.getItem(thoughtRecordsKey);
          const allCBTRecords = cbtData ? JSON.parse(cbtData) : [];

          const moodEntries = await moodTracker.getMoodEntries(user.id, 7);

          const breathworkKey = StorageKeys.BREATH_SESSIONS(user.id);
          const breathworkData = await AsyncStorage.getItem(breathworkKey);
          const allBreathworkSessions = breathworkData ? JSON.parse(breathworkData) : [];

          // Use comprehensive analysis with all module data
          await loadAIInsightsWithAllModules({
            compulsions: allCompulsions,
            cbtRecords: allCBTRecords,
            moodEntries,
            breathworkSessions: allBreathworkSessions
          });
          
          setHasDeepInsights(true);
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
              } else {
                console.log('🚫 No adaptive suggestion at this time');
              }
            } catch (error) {
              console.warn('⚠️ Adaptive suggestion generation failed:', error);
            }
          }
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
        const cbtDays = weekCBT.map(c => new Date(c.timestamp).toDateString());
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
      const todayCompulsions = allCompulsions.filter((c: any) => 
        new Date(c.timestamp).toDateString() === today
      );
      const weeklyCompulsions = allCompulsions.filter((c: any) => 
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
      const resistanceWins = todayCompulsions.filter((c: any) => c.resistanceLevel >= 3).length;
      
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

      // Load AI Insights with Progressive UI (Phase-1: cache/heuristic → Phase-2: deep)
      // ✅ FIXED: Use Progressive UI instead of direct deep analysis
      if (FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE')) {
        await loadAIInsights();
      } else {
        // Fallback to direct deep analysis if Progressive UI disabled
        await loadAIInsightsWithAllModules({
          compulsions: allCompulsions,
          cbtRecords: allCBTRecords,
          moodEntries,
          breathworkSessions: allBreathworkSessions
        });
      }
      
      // ✅ Load AI-Generated Daily Missions
      await loadAIMissions();
      
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
          <StreakCounter 
            current={profile.streakCurrent}
            best={profile.streakBest}
            level={profile.streakLevel}
          />
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
          router.push({
            pathname: '/(tabs)/cbt' as any,
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
          router.push({
            pathname: '/(tabs)/tracking' as any,
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
                    {/* ✅ POLISH: Enhanced source + module indicator */}
                    {FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE') && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.aiInsightConfidence, { marginLeft: 10 }]}>
                          Kaynak: {insightsSource === 'cache' ? 'Önbellek' : 
                                  insightsSource === 'heuristic' ? 'Hızlı Analiz' : 
                                  'Derin Analiz'}
                        </Text>
                        {/* ✅ POLISH: 4 modül indicator */}
                        {insightsSource !== 'cache' && insightsSource !== 'heuristic' && (
                          <Text style={[styles.aiInsightConfidence, { marginLeft: 8, fontWeight: '600', color: '#10B981' }]}>
                            • 4 Modül
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
              );
            })}
          </View>
        )}

        {/* ✅ POLISH: Gentle empty insights message (non-prescriptive) */}
        {aiInsights.length === 0 && !aiInsightsLoading && (
          <View style={styles.noInsightsCard}>
            <MaterialCommunityIcons name="lightbulb-outline" size={28} color="#a1a1aa" />
            <Text style={styles.noInsightsText}>
              Daha fazla kayıtla daha iyi öneriler sunabiliriz 💙
            </Text>
            <Text style={[styles.noInsightsText, { fontSize: 12, marginTop: 4, opacity: 0.7 }]}>
              Günlük aktiviteleriniz artıkça kişisel içgörüler burada görünecek
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
        {/* OCD Tracking Özet */}
        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/(tabs)/tracking')}
        >
          <View style={styles.moduleHeader}>
            <MaterialCommunityIcons name="heart-pulse" size={18} color="#10B981" />
            <Text style={styles.moduleTitle}>OCD</Text>
            </View>
          <Text style={styles.moduleCount}>{todayStats.weeklyProgress.compulsions}</Text>
          <Text style={styles.moduleSubtext}>
            {todayStats.weeklyProgress.compulsions > 0 
              ? `${todayStats.resistanceWins}/${todayStats.compulsions} direnç` 
              : 'Kayıt bekliyor'}
          </Text>
          <View style={styles.moduleFooter}>
            <Text style={styles.moduleAction}>Detaylar →</Text>
            </View>
        </Pressable>
        
        {/* CBT Özet */}
        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/(tabs)/cbt')}
        >
          <View style={styles.moduleHeader}>
            <MaterialCommunityIcons name="brain" size={18} color="#3B82F6" />
            <Text style={styles.moduleTitle}>CBT</Text>
          </View>
          <Text style={styles.moduleCount}>{todayStats.weeklyProgress.cbt}</Text>
          <Text style={styles.moduleSubtext}>
            {todayStats.weeklyProgress.cbt > 0 
              ? `Mood +${todayStats.cbtMoodDelta > 0 ? todayStats.cbtMoodDelta : 0}` 
              : 'Henüz kayıt yok'}
          </Text>
          <View style={styles.moduleFooter}>
            <Text style={styles.moduleAction}>Devam Et →</Text>
          </View>
        </Pressable>

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
          />
        )}
        
        {/* Breathwork Suggestion Card - Only show if Adaptive suggestion is not present (priority rule) */}
        {!adaptiveSuggestion?.show && breathworkSuggestion?.show && (
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
        {renderModuleSummary()} {/* ✅ YENİ: Haftalık Özet Kartları */}
        {/* Risk section removed */}
        {renderArtTherapyWidget()}
        {renderDailyMissions()}
        {renderAIInsights()}
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
  // ✅ REMOVED: Achievement stilleri - Today'den başarı listesi kaldırıldı
  // Başarı gösterimi modül dashboard'larında mevcut
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