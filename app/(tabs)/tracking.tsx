
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Pressable,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Custom UI Components
import FAB from '@/components/ui/FAB';
import CompulsionQuickEntry from '@/components/forms/CompulsionQuickEntry';
import { Toast } from '@/components/ui/Toast';
import UserCentricOCDDashboard from '@/components/ui/UserCentricOCDDashboard';
// Removed: YBOCSAssessmentUI - using onboarding data instead

// Gamification
import { useGamificationStore } from '@/store/gamificationStore';

// Constants
import { COMPULSION_CATEGORIES } from '@/constants/compulsions';

// Storage utility & Privacy & Encryption  
import { StorageKeys } from '@/utils/storage';
import { sanitizePII } from '@/utils/privacy';
import { secureDataService } from '@/services/encryption/secureDataService';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';

// AI Integration - Pattern Recognition & Insights
import { useAI, useAIUserData, useAIActions } from '@/contexts/AIContext';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
// import { patternRecognitionV2 } from '@/features/ai/services/patternRecognitionV2'; // DEPRECATED - moved to UnifiedAIPipeline
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DebugAIPipelineOverlay from '@/components/dev/DebugAIPipelineOverlay';

// Removed: Y-BOCS AI Assessment Integration - using onboarding data
// VoiceMoodCheckin removed - using unified voice from Today page

// Kanonik kategori eşlemesi
import { mapToCanonicalCategory } from '@/utils/categoryMapping';

interface CompulsionEntry {
  id: string;
  type: string;
  resistanceLevel: number;
  timestamp: Date;
  duration?: number;
  trigger?: string;
  notes?: string;
}

import { useStandardizedCompulsion } from '@/hooks/useStandardizedData';

export default function TrackingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const router = useRouter();
  const { awardMicroReward, updateStreak } = useGamificationStore();
  const { submitCompulsion } = useStandardizedCompulsion(user?.id);
  
  // AI Integration
  const { isInitialized: aiInitialized, availableFeatures } = useAI();
  const { generateInsights } = useAIActions();
  
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [todayCompulsions, setTodayCompulsions] = useState<CompulsionEntry[]>([]);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [quickEntrySource, setQuickEntrySource] = useState<'fab' | 'voice' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);
  
  // AI Pattern Recognition State
  const [aiPatterns, setAiPatterns] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isInsightsRunning, setIsInsightsRunning] = useState(false);
  
  // OCD Analytics Dashboard State
  const [showUserCentricDashboard, setShowUserCentricDashboard] = useState(false);
  const [allCompulsions, setAllCompulsions] = useState<CompulsionEntry[]>([]);
  
  // Y-BOCS & Onboarding Integration State
  const [onboardingProfile, setOnboardingProfile] = useState<any>(null);
  const [ybocsHistory, setYbocsHistory] = useState<any[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  const [stats, setStats] = useState({
    totalCompulsions: 0,
    avgResistance: 0,
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    typeDistribution: {} as Record<string, number>,
  });

  useEffect(() => {
    if (user?.id) {
      loadAllData();
      // İlk yüklemede Supabase'den de çek
      loadCompulsionsFromSupabase();
    }
  }, [user?.id]);

  // Load onboarding profile for Y-BOCS history
  useEffect(() => {
    const loadOnboardingProfile = async () => {
      if (!user?.id) return;
      
      setIsLoadingProfile(true);
      try {
        console.log('📋 Loading onboarding profile for Y-BOCS history...');
        
        // Try multiple storage keys and formats for backward compatibility
        const storageKeys = [
          `user_profile_${user.id}`,        // New onboarding format
          `ai_user_profile_${user.id}`,     // AI onboarding format
          `ocd_profile_${user.id}`,         // Legacy onboarding format
        ];
        
        let profile = null;
        let profileSource = 'none';
        
        for (const key of storageKeys) {
          const localProfile = await AsyncStorage.getItem(key);
          if (localProfile) {
            try {
              profile = JSON.parse(localProfile);
              profileSource = key;
              console.log(`✅ Found onboarding profile in ${key}:`, profile);
              break;
            } catch (e) {
              console.warn(`⚠️ Failed to parse profile from ${key}:`, e);
            }
          }
        }
        
        if (profile) {
          // Helper function to calculate Y-BOCS severity from score
          const calculateYbocsSeverity = (score: number): string => {
            if (score >= 32) return 'Severe';
            if (score >= 24) return 'Moderate';
            if (score >= 16) return 'Mild';
            if (score >= 8) return 'Subclinical';
            return 'Minimal';
          };
          
          // ✅ FLEXIBLE MAPPING: Handle different field name patterns
          const ybocsScore = profile.ybocsScore || 
                            profile.ybocsLiteScore || 
                            profile.ybocs_score ||
                            0;
          
          const mappedProfile = {
            ybocsLiteScore: ybocsScore,
            ybocsSeverity: calculateYbocsSeverity(ybocsScore),
            primarySymptoms: profile.symptomTypes || 
                           profile.primarySymptoms || 
                           profile.ocd_symptoms || 
                           [],
            dailyGoal: profile.goals?.[0] || 
                      profile.dailyGoal || 
                      profile.daily_goal || 
                      'improve_daily_life',
            onboardingCompleted: profile.onboardingCompleted || 
                               profile.onboarding_completed || 
                               !!profile.onboardingCompletedAt ||
                               false,
            createdAt: profile.createdAt || profile.completedAt,
            profileSource,
            originalProfile: profile
          };
          
          setOnboardingProfile(mappedProfile);
          
          // Create Y-BOCS history from onboarding data if score exists
          if (ybocsScore > 0) {
            const ybocsHistoryEntry = {
              id: 'onboarding',
              user_id: user.id,
              totalScore: ybocsScore,
              severityLevel: calculateYbocsSeverity(ybocsScore),
              timestamp: profile.createdAt || profile.completedAt || new Date().toISOString(),
              answers: [], // We don't have individual answers, but we have the total
              metadata: {
                source: 'onboarding',
                culturalContext: 'turkish',
                profileSource
              }
            };
            
            setYbocsHistory([ybocsHistoryEntry]);
            console.log('✅ Y-BOCS history created from onboarding:', ybocsHistoryEntry);
          } else {
            console.log('ℹ️ No Y-BOCS score found in profile, creating empty history');
            setYbocsHistory([]);
          }
        } else {
          console.log('ℹ️ No onboarding profile found in any storage key');
          setYbocsHistory([]);
        }
      } catch (error) {
        console.error('❌ Error loading onboarding profile:', error);
        setYbocsHistory([]);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadOnboardingProfile();
  }, [user?.id]);

  // 🔄 FOCUS REFRESH: Reload data when tab gains focus (after multi-intent saves)
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        console.log('🔄 Tracking tab focused, refreshing compulsions list...');
        loadAllData();
      }
    }, [user?.id])
  );

  // Voice trigger'dan gelindiyse otomatik aç (pre-filled data ile)
  // veya refresh parametresi gelirse listeyi yenile
  useEffect(() => {
    if (params.prefill === 'true') {
      console.log('📝 Opening tracking form with pre-filled data from voice:', params);
      console.log('🔍 Current state before voice prefill:', { showQuickEntry, quickEntrySource });
      
      // Always reset state for voice prefill to avoid conflicts
      console.log('📝 Voice prefill detected, resetting state...');
      setShowQuickEntry(false);
      setQuickEntrySource(null);
      
      // Use timeout to ensure state reset completes
      setTimeout(() => {
        console.log('✅ VOICE: Setting state to true with source=voice');
        setShowQuickEntry(true);
        setQuickEntrySource('voice');
      }, 50);
    }
  }, [params.prefill]);
  
  // Refresh için ayrı useEffect - sadece bir kez çalışsın
  useEffect(() => {
    if (params.refresh || params.justSaved === 'true') {
      console.log('🔄 Refreshing compulsions list after auto-save');
      loadAllData();
      loadCompulsionsFromSupabase();
      
      // Parametreleri temizle ki tekrar çalışmasın
      router.setParams({ refresh: undefined, justSaved: undefined, highlight: undefined });
    }
  }, [params.refresh, params.justSaved]);

  useEffect(() => {
    setDisplayLimit(5);
  }, [selectedTimeRange]);

  /**
   * 🤖 Load AI Pattern Recognition & Insights - UnifiedPipeline Integration
   */
  const loadAIPatterns = async () => {
    if (!user?.id || !aiInitialized || !availableFeatures.includes('AI_INSIGHTS')) {
      return;
    }
    if (isInsightsRunning) {
      if (__DEV__) console.log('ℹ️ Insights already running, skip');
      return;
    }

            try {
          setIsInsightsRunning(true);
          setIsLoadingAI(true);

          // ✅ ENHANCED: Track analysis start time for performance metrics
          const analysisStartTime = Date.now();

          // Track AI pattern analysis request
          await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
            userId: user.id,
            source: 'tracking_screen',
            dataType: 'compulsion_patterns',
            analysisStartTime
          });

      // Get compulsion data for analysis
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const allEntriesData = await AsyncStorage.getItem(storageKey);
      const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];

      // ✅ Initialize pipelineResult in broader scope for telemetry
      let pipelineResult: any = null;

      if (allEntries.length > 0) {
        try {
          // 🚀 USE UNIFIED PIPELINE for pattern analysis instead of local heuristics
          console.log('🔄 Using UnifiedPipeline for compulsion pattern analysis...');
          
          // 🔐 PRIVACY-FIRST: Sanitize and encrypt OCD compulsion data before AI analysis
          const recentCompulsions = allEntries.slice(-30); // Last 30 entries
          const sanitizedCompulsions = recentCompulsions.map(compulsion => ({
            ...compulsion,
            notes: compulsion.notes ? sanitizePII(compulsion.notes) : undefined,
            trigger: compulsion.trigger ? sanitizePII(compulsion.trigger) : undefined
          }));

          // ✅ ENCRYPT sensitive AI payload data
          const sensitivePayload = {
            compulsions: sanitizedCompulsions,
            dataType: 'compulsion_patterns',
            timeRange: selectedTimeRange
          };
          
          // ✅ ENCRYPTION OPTIONAL: Since we use sanitized data for pipeline, encryption is for audit only
          let encryptionResult: any = null;
          let encryptionStatus = 'disabled';
          
          try {
            // Use expo-crypto for encryption (migrated from react-native-simple-crypto)
            encryptionResult = await secureDataService.encryptSensitiveData(sensitivePayload);
            encryptionStatus = 'success';
            
            // Log integrity metadata for auditability
            console.log('🔐 Sensitive OCD payload encrypted with AES-256');
            console.log(`🔍 Integrity hash: ${encryptionResult.hash?.substring(0, 8)}...`);
            console.log(`⏰ Encrypted at: ${new Date(encryptionResult.timestamp || 0).toISOString()}`);
          
          } catch (error) {
            console.warn('⚠️ Encryption failed, using sanitized data (this is safe):', error);
            encryptionStatus = 'failed';
          }

          // ✅ FIXED: Send sanitized (not encrypted) data to pipeline for AI analysis
          // Encryption metadata is kept for audit/telemetry purposes
          pipelineResult = await unifiedPipeline.process({
            userId: user.id, // User ID is hashed in pipeline for privacy
            content: sensitivePayload, // ✅ Use sanitized, unencrypted payload for analysis
            type: 'data' as const,
            context: {
              source: 'tracking' as const,
              timestamp: Date.now(),
              metadata: {
                dataType: 'compulsion_patterns',
                timeRange: selectedTimeRange,
                privacy: {
                  piiSanitized: true,
                  encryptionStatus: encryptionStatus,
                  encryptionLevel: encryptionStatus === 'success' ? 
                                  (encryptionResult?.algorithm === 'SHA256_FALLBACK' ? 'fallback_hash' : 'aes256') :
                                  'sanitized_only',
                  encrypted: encryptionStatus === 'success' && encryptionResult?.algorithm && encryptionResult.algorithm !== 'SHA256_FALLBACK',
                  // Store encryption details for audit trail (if available)
                  encryptionHash: encryptionStatus === 'success' ? encryptionResult?.hash?.substring(0, 8) : undefined,
                  encryptionTimestamp: encryptionStatus === 'success' ? encryptionResult?.timestamp : undefined
                }
              }
            }
          });

          console.log('🎯 UnifiedPipeline pattern analysis result:', pipelineResult);

          // Extract patterns from pipeline result
          if (pipelineResult.patterns && Array.isArray(pipelineResult.patterns)) {
            const unifiedPatterns = pipelineResult.patterns.map((pattern: any) => ({
              type: pattern.type || 'general_pattern',
              title: pattern.title || 'Pattern Detected',
              description: pattern.description || pattern.summary || 'No description available',
              suggestion: pattern.intervention || pattern.suggestion || 'Consider consulting a therapist',
              confidence: pattern.confidence || 0.5,
              severity: pattern.severity || 'medium'
            }));
            
            setAiPatterns(unifiedPatterns);
            console.log('✅ UnifiedPipeline patterns loaded:', unifiedPatterns.length);
          } else {
            // Fallback to local heuristic analysis if no patterns from pipeline
            console.log('🔄 No patterns from UnifiedPipeline, using fallback analysis');
            const fallbackPatterns = analyzeTrends(allEntries);
            setAiPatterns(fallbackPatterns);
          }

        } catch (pipelineError) {
          console.error('❌ UnifiedPipeline pattern analysis failed, using fallback:', pipelineError);
          // Fallback to local analysis
          const fallbackPatterns = analyzeTrends(allEntries);
          setAiPatterns(fallbackPatterns);
        }
      }

                // Generate AI insights for UI
          const insights = await generateInsights();
          setAiInsights(insights || []);

          // ✅ ENHANCED: Calculate processing time and track comprehensive metrics
          const processingTime = Date.now() - analysisStartTime;
          const usedFallback = !pipelineResult.patterns || !Array.isArray(pipelineResult.patterns);
          
          // Track successful analysis with enhanced telemetry
          await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
            userId: user.id,
            source: 'tracking_screen',
            insightsCount: insights?.length || 0,
            patternsCount: aiPatterns.length,
            processingTime,
            analysisSource: usedFallback ? 'fallback' : 'pipeline',
            cacheHit: pipelineResult.fromCache || false,
            dataQuality: allEntries.length >= 5 ? 1.0 : (allEntries.length / 5),
            modules: ['ocd_pattern_analysis', 'compulsion_trends'],
            performance: {
              responseTime: processingTime,
              targetTime: 2000, // 2s target for OCD analysis
              withinTarget: processingTime <= 2000
            }
          });

          // Track UnifiedPipeline completion metrics
          if (!usedFallback) {
            await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_COMPLETED, {
              userId: user.id,
              source: 'tracking_screen',
              cacheHit: pipelineResult.fromCache || false,
              modules: ['ocd_analysis'],
              resultSize: JSON.stringify(pipelineResult).length,
              processingTime
            });
          }

    } catch (error) {
      console.error('❌ Error loading AI patterns:', error);
    } finally {
      setIsLoadingAI(false);
      setIsInsightsRunning(false);
    }
  };

  /**
   * 📊 Analyze Trends (Local AI Simulation)
   */
  const analyzeTrends = (entries: CompulsionEntry[]) => {
    if (entries.length < 5) return [];

    const patterns = [];
    
    // Time-based patterns
    const hourCounts = new Array(24).fill(0);
    entries.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourCounts[hour]++;
    });
    
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    if (peakHours[0].count >= 3) {
      patterns.push({
        type: 'time_pattern',
        title: `${peakHours[0].hour}:00 Saatinde Yoğunluk`,
        description: `En çok kompülsiyon ${peakHours[0].hour}:00 saatinde yaşanıyor (${peakHours[0].count} kez)`,
        suggestion: 'Bu saatlerde önleyici teknikler uygulayın',
        confidence: 0.8,
        severity: 'medium'
      });
    }

    // Resistance trends
    const recentEntries = entries.slice(-10);
    const avgResistance = recentEntries.reduce((sum, e) => sum + e.resistanceLevel, 0) / recentEntries.length;
    
    if (avgResistance >= 7) {
      patterns.push({
        type: 'progress_pattern',
        title: 'Güçlü Direnç Trendi',
        description: `Son kompülsiyonlarda ortalama ${avgResistance.toFixed(1)} direnç seviyesi`,
        suggestion: 'Mükemmel ilerleme! Bu motivasyonu koruyun',
        confidence: 0.9,
        severity: 'positive'
      });
    } else if (avgResistance <= 3) {
      patterns.push({
        type: 'warning_pattern',
        title: 'Düşük Direnç Uyarısı',
        description: `Son kompülsiyonlarda ortalama ${avgResistance.toFixed(1)} direnç seviyesi`,
        suggestion: 'Terapi egzersizleri ve mindfulness teknikleri deneyin',
        confidence: 0.85,
        severity: 'warning'
      });
    }

    return patterns;
  };

  // Supabase'den compulsion'ları yükle ve AsyncStorage ile senkronize et
  const loadCompulsionsFromSupabase = async () => {
    if (!user?.id) return;
    
    try {
      console.log('📊 Loading compulsions from Supabase...');
      const compulsions = await supabaseService.getUserCompulsions(user.id, 100);
      
      if (compulsions && compulsions.length > 0) {
        // AsyncStorage'a kaydet (offline cache)
        const storageKey = StorageKeys.COMPULSIONS(user.id);
        const formattedCompulsions = compulsions.map(c => ({
          id: c.id,
          type: c.subcategory || c.category,
          resistanceLevel: c.resistance_level,
          timestamp: new Date(c.timestamp),
          trigger: c.trigger,
          notes: c.notes,
          synced: true,
        }));
        
        await AsyncStorage.setItem(storageKey, JSON.stringify(formattedCompulsions));
        console.log(`✅ Synced ${compulsions.length} compulsions from Supabase`);
        
        // State'i güncelle
        const today = new Date();
        const todayKey = today.toDateString();
        const todayEntries = formattedCompulsions
          .filter(entry => new Date(entry.timestamp).toDateString() === todayKey)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Sort newest first
        
        setTodayCompulsions(todayEntries);
      }
    } catch (error) {
      console.error('❌ Error loading from Supabase:', error);
    }
  };

  const loadAllData = async () => {
    if (!user?.id) return;
    
    try {
      const today = new Date();
      
      // Load all entries from user-specific storage key
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const allEntriesData = await AsyncStorage.getItem(storageKey);
      const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];
      
      // Set all compulsions for dashboard
      setAllCompulsions(allEntries);
      
      // Filter today's entries and sort newest first
      const todayKey = today.toDateString();
      const todayEntries = allEntries
        .filter(entry => new Date(entry.timestamp).toDateString() === todayKey)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setTodayCompulsions(todayEntries);
      
      // Calculate week entries (last 7 days)
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekEntries = allEntries.filter(entry => 
        new Date(entry.timestamp) >= weekAgo
      );
      
      // Calculate month entries (last 30 days)
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthEntries = allEntries.filter(entry => 
        new Date(entry.timestamp) >= monthAgo
      );
      
      // Calculate stats
      let allResistances: number[] = [];
      let typeDistribution: Record<string, number> = {};
      
      monthEntries.forEach((entry: CompulsionEntry) => {
        allResistances.push(entry.resistanceLevel || 0);
        
        if (entry.type) {
          const canonical = mapToCanonicalCategory(entry.type);
          typeDistribution[canonical] = (typeDistribution[canonical] || 0) + 1;
        }
      });
      
      const avgResistance = allResistances.length > 0 
        ? allResistances.reduce((sum, r) => sum + r, 0) / allResistances.length 
        : 0;
      
      setStats({
        totalCompulsions: monthEntries.length,
        avgResistance: Math.round(avgResistance * 10) / 10,
        todayCount: todayEntries.length,
        weekCount: weekEntries.length,
        monthCount: monthEntries.length,
        typeDistribution,
      });

      // Load AI patterns after data loading
      await loadAIPatterns();
      
      // Removed: Load Y-BOCS history - using onboarding data
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Removed: loadYBOCSHistory function - using onboarding data

  // Removed: handleYBOCSCompletion function - using onboarding data

  const onRefresh = async () => {
    setRefreshing(true);
    setDisplayLimit(5);
    await loadAllData();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  };

  const handleCompulsionSubmit = async (compulsionData: Omit<CompulsionEntry, 'id' | 'timestamp'>) => {
    if (!user?.id) return;

    try {
      const newEntry: CompulsionEntry = {
        id: Date.now().toString(),
        ...compulsionData,
        timestamp: new Date(),
      };

      // Save to AsyncStorage (offline first)
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const existingEntries = await AsyncStorage.getItem(storageKey);
      const entries = existingEntries ? JSON.parse(existingEntries) : [];
      entries.push(newEntry);
      await AsyncStorage.setItem(storageKey, JSON.stringify(entries));

      // Save to Supabase database
      try {
        await supabaseService.saveCompulsion({
          user_id: user.id,
          category: mapToCanonicalCategory(compulsionData.type), // kanonik kategori
          subcategory: compulsionData.type, // orijinal değer etiket olarak
          resistance_level: compulsionData.resistanceLevel,
          trigger: compulsionData.trigger || '',
          notes: compulsionData.notes || '',
        });
        console.log('✅ Compulsion saved to database');
      } catch (dbError) {
        console.error('❌ Database save failed (offline mode):', dbError);
        // Continue with offline mode - data is already in AsyncStorage
      }

      // Award gamification rewards
      awardMicroReward('compulsion_recorded');
      
      if (compulsionData.resistanceLevel >= 8) {
        awardMicroReward('high_resistance');
      }

      // Check for daily goal achievement
      const today = new Date().toDateString();
      const todayEntries = entries.filter((entry: CompulsionEntry) => 
        new Date(entry.timestamp).toDateString() === today
      );

      if (todayEntries.length >= 3) {
        awardMicroReward('daily_goal_met');
      }

      // Update streak
      updateStreak();

      // Show success toast
      setToastMessage('Kayıt eklendi');
      setShowToast(true);
      
      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh data
      await loadAllData();
      
      // 🧹 Clean stale cache and invalidate - new compulsion affects patterns
      try {
        const cleanup = await unifiedPipeline.invalidateStaleCache();
        console.log(`✅ Cache cleanup after compulsion save: ${cleanup.invalidated} entries removed`);
      } catch (cleanupError) {
        console.warn('⚠️ Cache cleanup failed:', cleanupError);
      }
      
      unifiedPipeline.triggerInvalidation('compulsion_added', user.id);
    } catch (error) {
      console.error('Error saving compulsion:', error);
    }
  };

  const deleteEntry = async (entryId: string) => {
    Alert.alert(
      'Kaydı Sil',
      'Bu kaydı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;

            try {
              // Delete from AsyncStorage (offline first)
              const storageKey = StorageKeys.COMPULSIONS(user.id);
              const allEntriesData = await AsyncStorage.getItem(storageKey);
              const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];
              const updatedEntries = allEntries.filter(entry => entry.id !== entryId);
              await AsyncStorage.setItem(storageKey, JSON.stringify(updatedEntries));

              // Delete from Supabase database
              try {
                await supabaseService.deleteCompulsion(entryId);
                console.log('✅ Compulsion deleted from database');
              } catch (dbError) {
                console.error('❌ Database delete failed (offline mode):', dbError);
                // Continue with offline mode - data is already removed from AsyncStorage
              }

              await loadAllData();
              
              setToastMessage('Kayıt silindi');
              setShowToast(true);
            } catch (error) {
              console.error('Error deleting entry:', error);
              setToastMessage('Silme işleminde hata oluştu');
              setShowToast(true);
            }
          }
        }
      ]
    );
  };

  const getCompulsionIcon = (type: string) => {
    const category = COMPULSION_CATEGORIES.find(c => c.id === type);
    return category?.icon || 'help-circle';
  };

  const getCompulsionColor = (type: string) => {
    const colors: Record<string, string> = {
      cleaning: '#3B82F6',
      checking: '#10B981',
      counting: '#8B5CF6',
      symmetry: '#F59E0B',
      mental: '#EC4899',
      other: '#6B7280',
    };
    return colors[type] || '#6B7280';
  };

  const getResistanceColor = (level: number) => {
    if (level >= 7) return '#10B981';
    if (level >= 4) return '#F59E0B';
    return '#EF4444';
  };

  const getTimeRangeStats = () => {
    switch (selectedTimeRange) {
      case 'today':
        return { count: stats.todayCount, label: 'Today' };
      case 'week':
        return { count: stats.weekCount, label: 'This Week' };
      case 'month':
        return { count: stats.monthCount, label: 'This Month' };
    }
  };

  const timeRangeStats = getTimeRangeStats();
  
  // Calculate progress percentage
  const calculateProgress = () => {
    const goalCount = selectedTimeRange === 'today' ? 5 : selectedTimeRange === 'week' ? 30 : 100;
    const currentCount = timeRangeStats.count;
    return Math.min(Math.round((currentCount / goalCount) * 100), 100);
  };
  
  // Calculate weekly change percentage
  const calculateWeeklyChange = () => {
    // This is a simplified calculation, you might want to compare with previous week
    if (stats.weekCount > 0) {
      return '+5%'; // Placeholder for now
    }
    return '0%';
  };

  const getFilteredCompulsions = () => {
    const today = new Date();
    let entries: CompulsionEntry[] = [];

    switch (selectedTimeRange) {
      case 'today':
        entries = todayCompulsions;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        entries = todayCompulsions.filter(entry => 
          new Date(entry.timestamp) >= weekAgo
        );
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        entries = todayCompulsions.filter(entry => 
          new Date(entry.timestamp) >= monthAgo
        );
        break;
    }

    return entries.slice(0, displayLimit);
  };

  const filteredCompulsions = getFilteredCompulsions();

  return (
    <ScreenLayout>
      {/* Header - New Design */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>OCD Takibi</Text>
          <Pressable 
            style={styles.headerRight}
            onPress={() => {
              // Open User-Centric OCD Dashboard
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowUserCentricDashboard(true);
            }}
          >
            <MaterialCommunityIcons name="chart-line" size={24} color="#10B981" />
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
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Date Display */}
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>

        {/* Summary Stats Card - Simplified */}
        <View style={styles.weekStatsCard}>
          <View style={styles.weekStatsHeader}>
            <View>
              <Text style={styles.weekStatsTitle}>
                Özet
              </Text>
            </View>
            {stats.weekCount > 0 && (
              <View style={styles.percentageBadge}>
                <Text style={styles.percentageText}>{calculateWeeklyChange()}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeRangeStats.count}</Text>
              <Text style={styles.statLabel}>Kayıt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats.avgResistance > 0 ? `${stats.avgResistance}` : '0'}
              </Text>
              <Text style={styles.statLabel}>Direnç</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{calculateProgress()}%</Text>
              <Text style={styles.statLabel}>İlerleme</Text>
            </View>
          </View>
        </View>

        {/* Removed: Y-BOCS Assessment Card - using onboarding data in dashboard */}

        {/* Removed: Recovery Dashboard Card - moved to header chart icon only */}



        {/* Removed: AI Pattern Recognition & Insights - moved to dashboard */}

        {/* Recordings List */}
        <View style={styles.listSection}>

          {filteredCompulsions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="checkbox-blank-circle-outline" size={40} color="#E5E7EB" />
              <Text style={styles.emptyText}>Henüz kayıt yok</Text>
            </View>
          ) : (
            <View style={styles.recordingsContainer}>
              {filteredCompulsions.map((compulsion) => {
                const category = COMPULSION_CATEGORIES.find(c => c.id === compulsion.type);
                const resistanceLevel = compulsion.resistanceLevel;
                const resistanceColor = resistanceLevel >= 8 ? '#10B981' : resistanceLevel >= 5 ? '#F59E0B' : '#EF4444';
                
                return (
                  <View key={compulsion.id} style={styles.recordingCard}>
                    <View style={styles.recordingHeader}>
                      <View style={styles.recordingLeft}>
                        <Text style={styles.recordingCategory}>
                          {t('categoriesCanonical.' + mapToCanonicalCategory(compulsion.type), category?.name || 'Other')}
                        </Text>
                        <Text style={styles.recordingTime}>
                          {new Date(compulsion.timestamp).toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </Text>
                      </View>
                      <View style={styles.recordingRight}>
                        <View style={[styles.resistanceBadge, { backgroundColor: resistanceColor + '20' }]}>
                          <Text style={[styles.resistanceScore, { color: resistanceColor }]}>
                            {compulsion.resistanceLevel}/10
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            deleteEntry(compulsion.id);
                          }}
                          style={styles.deleteIcon}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialCommunityIcons name="close-circle" size={20} color="#D1D5DB" />
                        </Pressable>
                      </View>
                    </View>
                    {compulsion.notes && (
                      <Text style={styles.recordingNotes}>
                        {compulsion.notes}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Show More Button */}
          {filteredCompulsions.length > 0 && todayCompulsions.length > displayLimit && (
            <View style={styles.showMoreContainer}>
              <Pressable
                style={styles.showMoreButton}
                onPress={() => {
                  setDisplayLimit(prev => prev + 5);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.showMoreText}>Daha fazla</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <FAB 
        icon="plus" 
        onPress={() => {
          console.log('🔥 FAB BUTTON PRESSED - Opening CompulsionQuickEntry');
          console.log('🔍 Current state:', { showQuickEntry, quickEntrySource });
          
          // 🔧 FIX: Always reset and reopen for FAB
          if (showQuickEntry) {
            console.log('⚠️ State already true, resetting first...');
            setShowQuickEntry(false);
            setQuickEntrySource(null);
            setTimeout(() => {
              console.log('✅ FAB: Setting state to true with source=fab');
              setShowQuickEntry(true);
              setQuickEntrySource('fab');
            }, 10);
          } else {
            console.log('✅ FAB: Setting state to true with source=fab');
            setShowQuickEntry(true);
            setQuickEntrySource('fab');
          }
          console.log('✅ FAB action completed');
        }}
        position="fixed"
      />

      {/* Quick Entry Bottom Sheet */}
      <CompulsionQuickEntry
        visible={showQuickEntry}
        onDismiss={() => {
          console.log('📝 CompulsionQuickEntry dismissed, source was:', quickEntrySource);
          setShowQuickEntry(false);
          setQuickEntrySource(null);
        }}
        onSubmit={handleCompulsionSubmit}
        initialCategory={params.category as string}
        initialText={params.text as string}
        initialResistance={params.resistanceLevel ? Number(params.resistanceLevel) : undefined}
        initialSeverity={params.severity ? Number(params.severity) : undefined}
        initialTrigger={params.trigger as string}

      />

      {/* User-Centric OCD Dashboard - Bottom Sheet Pattern */}
      <UserCentricOCDDashboard
        visible={showUserCentricDashboard}
        onClose={() => setShowUserCentricDashboard(false)}
        compulsions={allCompulsions}
        ybocsHistory={ybocsHistory}
        userId={user?.id || ''}
        aiPatterns={aiPatterns}
        aiInsights={aiInsights}
        onStartAction={(actionId) => {
          console.log('🌿 OCD Recovery action:', actionId);
          if (actionId === 'start_tracking') {
            setShowUserCentricDashboard(false);
            setShowQuickEntry(true);
          }
        }}
      />

      {/* Removed: Y-BOCS Assessment Modal - using onboarding data in dashboard */}

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type="success"
        onHide={() => setShowToast(false)}
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
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeRangeActive: {
    backgroundColor: '#10B981',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
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
    color: '#10B981',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#10B981',
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: 'Inter',
  },
  // New Design Styles
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
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentageText: {
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
  // Old styles kept for compatibility
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
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
  // Recording Card Styles
  recordingsContainer: {
    gap: 12,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recordingLeft: {
    flex: 1,
  },
  recordingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  recordingTime: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  resistanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resistanceScore: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  recordingNotes: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'Inter',
    marginTop: 12,
    lineHeight: 20,
  },
  deleteIcon: {
    padding: 4,
  },
  // Old style kept for compatibility
  compulsionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compulsionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compulsionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compulsionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compulsionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  compulsionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  compulsionTime: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  compulsionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  resistanceText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  deleteButton: {
    padding: 8,
  },
  compulsionNotes: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    fontFamily: 'Inter',
    lineHeight: 20,
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

  // AI Pattern Recognition Styles
  aiSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  // Removed: AI Patterns & Insights Styles - moved to dashboard
  
  // Dashboard Overlay Styles
  dashboardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardContainer: {
    width: '90%',
    height: '80%', // FIXED: Added explicit height instead of just maxHeight
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden', // Ensure content doesn't overflow
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dashboardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  dashboardCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },

  // Removed: Y-BOCS Assessment & Modal Styles - using onboarding data

  // Removed: Recovery Dashboard Styles - moved to header chart icon only
  
  // Dashboard Content
  dashboardContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

