
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
import { YBOCSAssessmentUI } from '@/features/ai/components/onboarding/YBOCSAssessmentUI';

// Gamification
import { useGamificationStore } from '@/store/gamificationStore';

// Constants
import { COMPULSION_CATEGORIES } from '@/constants/compulsions';

// Storage utility & Privacy & Encryption  
import { StorageKeys } from '@/utils/storage';
import { sanitizePII } from '@/utils/privacy';
import { dataEncryption } from '@/services/dataEncryption';
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

// Y-BOCS AI Assessment Integration
import { ybocsAnalysisService } from '@/features/ai/services/ybocsAnalysisService';
import { turkishOCDCulturalService } from '@/features/ai/services/turkishOcdCulturalService';
import type { YBOCSAnswer } from '@/features/ai/types';
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
  const [showOCDDashboard, setShowOCDDashboard] = useState(false);
  const [showUserCentricDashboard, setShowUserCentricDashboard] = useState(false);
  const [allCompulsions, setAllCompulsions] = useState<CompulsionEntry[]>([]);
  
  // Y-BOCS Assessment State
  const [showYBOCSAssessment, setShowYBOCSAssessment] = useState(false);
  const [isYBOCSLoading, setIsYBOCSLoading] = useState(false);
  const [lastYBOCSScore, setLastYBOCSScore] = useState<number | null>(null);
  const [ybocsHistory, setYBOCSHistory] = useState<any[]>([]);
  
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

  // Voice trigger'dan gelindiyse otomatik aç (pre-filled data ile)
  // veya refresh parametresi gelirse listeyi yenile
  useEffect(() => {
    if (params.prefill === 'true') {
      console.log('📝 Opening tracking form with pre-filled data:', params);
      setShowQuickEntry(true);
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

      // Track AI pattern analysis request
      await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
        userId: user.id,
        source: 'tracking_screen',
        dataType: 'compulsion_patterns'
      });

      // Get compulsion data for analysis
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const allEntriesData = await AsyncStorage.getItem(storageKey);
      const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];

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
          
          let encryptedPayload;
          try {
            encryptedPayload = await dataEncryption.encryptSensitiveData(sensitivePayload);
            
            // Log integrity metadata for auditability
            console.log('🔐 Sensitive OCD payload encrypted with AES-256');
            console.log(`🔍 Integrity hash: ${encryptedPayload.hash?.substring(0, 8)}...`);
            console.log(`⏰ Encrypted at: ${new Date(encryptedPayload.timestamp || 0).toISOString()}`);
          } catch (error) {
            console.warn('⚠️ Encryption failed, using sanitized data:', error);
            encryptedPayload = sensitivePayload; // fallback to sanitized data
          }

          // Generate AI insights with encrypted data
          const pipelineResult = await unifiedPipeline.process({
            userId: user.id, // User ID is hashed in pipeline for privacy
            content: encryptedPayload,
            type: 'data' as const,
            context: {
              source: 'tracking' as const,
              timestamp: Date.now(),
              metadata: {
                dataType: 'compulsion_patterns',
                timeRange: selectedTimeRange,
                privacy: {
                  piiSanitized: true,
                  encryptionLevel: (encryptedPayload as any).algorithm === 'SHA256_FALLBACK' ? 'fallback_hash' : 
                                 (encryptedPayload as any).algorithm ? 'aes256' : 'sanitized',
                  encrypted: (encryptedPayload as any).algorithm && (encryptedPayload as any).algorithm !== 'SHA256_FALLBACK'
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

      // Track successful analysis
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId: user.id,
        insightsCount: insights?.length || 0,
        patternsFound: aiPatterns.length,
        source: 'tracking_screen',
        usedUnifiedPipeline: true
      });

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
        const todayEntries = formattedCompulsions.filter(entry => 
          new Date(entry.timestamp).toDateString() === todayKey
        );
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
      
      // Filter today's entries
      const todayKey = today.toDateString();
      const todayEntries = allEntries.filter(entry => 
        new Date(entry.timestamp).toDateString() === todayKey
      );
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
      
      // Load Y-BOCS history
      await loadYBOCSHistory();
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  /**
   * 📋 Load Y-BOCS Assessment History
   */
  const loadYBOCSHistory = async () => {
    if (!user?.id) return;
    
    try {
      const storageKey = `ybocs_history_${user.id}`;
      const historyData = await AsyncStorage.getItem(storageKey);
      const history = historyData ? JSON.parse(historyData) : [];
      
      setYBOCSHistory(history);
      
      // Set last score for display
      if (history.length > 0) {
        setLastYBOCSScore(history[history.length - 1].totalScore);
      }
    } catch (error) {
      console.error('Error loading Y-BOCS history:', error);
    }
  };

  /**
   * 📋 Handle Y-BOCS Assessment Completion
   */
  const handleYBOCSCompletion = async (answers: YBOCSAnswer[]) => {
    if (!user?.id) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
      return;
    }

    setIsYBOCSLoading(true);

    try {
      // Analyze Y-BOCS responses with AI enhancement and Turkish cultural adaptation
      console.log('📊 Starting Y-BOCS AI analysis with Turkish cultural adaptation...');
      
      // First, analyze with Turkish cultural service
      const culturalAnalysis = await turkishOCDCulturalService.analyzeTurkishCulturalFactors(
        user.id,
        allCompulsions as any, // Type compatibility fix
        { language: 'turkish', culturalBackground: 'turkish' }
      );
      
      // Then run Y-BOCS analysis with cultural context
      const analysis = await ybocsAnalysisService.analyzeYBOCS(answers, {
        culturalContext: 'turkish',
        enhanceWithAI: true,
        personalizeRecommendations: true
      });

      // Save to history
      const newAssessment = {
        id: `ybocs_${Date.now()}`,
        timestamp: new Date().toISOString(),
        answers,
        analysis,
        totalScore: analysis.totalScore,
        severityLevel: analysis.severityLevel,
        dominantSymptoms: analysis.dominantSymptoms || [],
        recommendations: analysis.recommendedInterventions || [],
        culturalAnalysis: culturalAnalysis,
        culturalAdaptations: culturalAnalysis?.interventionRecommendations?.immediate?.culturallyAdapted || []
      };

      const storageKey = `ybocs_history_${user.id}`;
      const existingHistory = await AsyncStorage.getItem(storageKey);
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      history.push(newAssessment);
      
      // Keep only last 10 assessments
      const trimmedHistory = history.slice(-10);
      await AsyncStorage.setItem(storageKey, JSON.stringify(trimmedHistory));

      // Update state
      setYBOCSHistory(trimmedHistory);
      setLastYBOCSScore(analysis.totalScore);
      setShowYBOCSAssessment(false);

      // Track Y-BOCS completion
      await trackAIInteraction(AIEventType.YBOCS_ANALYSIS_COMPLETED, {
        userId: user.id,
        totalScore: analysis.totalScore,
        severityLevel: analysis.severityLevel,
        dominantSymptoms: analysis.dominantSymptoms || [],
        source: 'tracking_screen'
      });

      // Award gamification rewards  
      await awardMicroReward('daily_goal_met'); // Use existing reward type
      await updateStreak();

      // 🔄 CRITICAL: Invalidate AI cache after Y-BOCS completion
      try {
        await unifiedPipeline.triggerInvalidation('ybocs_completed', user.id);
        console.log('✅ Y-BOCS completion cache invalidation triggered');
      } catch (error) {
        console.warn('⚠️ Y-BOCS cache invalidation failed:', error);
      }

      // Show success message
      setToastMessage(`Y-BOCS değerlendirmesi tamamlandı! Skor: ${analysis.totalScore}`);
      setShowToast(true);
      
      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show analysis results
      Alert.alert(
        'Y-BOCS Analizi Tamamlandı',
        `Toplam Skor: ${analysis.totalScore}\nŞiddet Seviyesi: ${analysis.severityLevel}\n\nDetaylar için dashboard'u kontrol edin`,
        [{ text: 'Tamam' }]
      );

    } catch (error) {
      console.error('Y-BOCS analysis error:', error);
      setToastMessage('Y-BOCS analizi sırasında hata oluştu');
      setShowToast(true);
    } finally {
      setIsYBOCSLoading(false);
    }
  };

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
      
      // 🗑️ Invalidate AI cache - new compulsion affects patterns
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

        {/* Y-BOCS Assessment Card */}
        <View style={styles.ybocsCard}>
          <View style={styles.ybocsHeader}>
            <View style={styles.ybocsInfo}>
              <MaterialCommunityIcons name="clipboard-text" size={24} color="#3B82F6" />
              <View style={styles.ybocsTextContainer}>
                <Text style={styles.ybocsTitle}>Y-BOCS Değerlendirmesi</Text>
                <Text style={styles.ybocsSubtitle}>
                  {lastYBOCSScore 
                    ? `Son skor: ${lastYBOCSScore} • ${ybocsHistory.length} değerlendirme`
                    : 'Henüz değerlendirme yapılmamış'
                  }
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.ybocsButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowYBOCSAssessment(true);
              }}
              disabled={isYBOCSLoading}
            >
              {isYBOCSLoading ? (
                <MaterialCommunityIcons name="loading" size={20} color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons 
                  name={lastYBOCSScore ? "refresh" : "play"} 
                  size={20} 
                  color="#FFFFFF" 
                />
              )}
            </Pressable>
          </View>
        </View>

        {/* User-Centric Recovery Dashboard Card */}
        <View style={styles.recoveryDashboardCard}>
          <View style={styles.recoveryDashboardHeader}>
            <View style={styles.recoveryDashboardInfo}>
              <MaterialCommunityIcons name="heart-pulse" size={24} color="#059669" />
              <View style={styles.recoveryDashboardTextContainer}>
                <Text style={styles.recoveryDashboardTitle}>Recovery Dashboard</Text>
                <Text style={styles.recoveryDashboardSubtitle}>
                  Kişisel journey'n ve pattern analiz
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.recoveryDashboardButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowUserCentricDashboard(true);
              }}
            >
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>



        {/* AI Pattern Recognition & Insights */}
        {aiInitialized && availableFeatures.includes('AI_INSIGHTS') && (aiPatterns.length > 0 || aiInsights.length > 0) && (
          <View style={styles.aiSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="brain" size={24} color="#3b82f6" />
              <Text style={styles.sectionHeaderTitle}>AI Analizleri</Text>
              {isLoadingAI && (
                <MaterialCommunityIcons name="loading" size={16} color="#6b7280" />
              )}
            </View>

            {/* AI Patterns */}
            {aiPatterns.length > 0 && (
              <View style={styles.aiPatternsContainer}>
                {aiPatterns.map((pattern, index) => (
                  <View key={index} style={[
                    styles.aiPatternCard,
                    pattern.severity === 'positive' && styles.aiPatternPositive,
                    pattern.severity === 'warning' && styles.aiPatternWarning
                  ]}>
                    <View style={styles.aiPatternHeader}>
                      <MaterialCommunityIcons 
                        name={
                          pattern.type === 'time_pattern' ? 'clock-outline' :
                          pattern.type === 'progress_pattern' ? 'trending-up' :
                          'alert-outline'
                        }
                        size={20} 
                        color={
                          pattern.severity === 'positive' ? '#10b981' :
                          pattern.severity === 'warning' ? '#f59e0b' :
                          '#3b82f6'
                        }
                      />
                      <Text style={styles.aiPatternTitle}>{pattern.title}</Text>
                      <Text style={styles.aiPatternConfidence}>
                        {Math.round(pattern.confidence * 100)}%
                      </Text>
                    </View>
                    <Text style={styles.aiPatternDescription}>{pattern.description}</Text>
                    <Text style={styles.aiPatternSuggestion}>💡 {pattern.suggestion}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* AI Insights */}
            {aiInsights.length > 0 && (
              <View style={styles.aiInsightsContainer}>
                <Text style={styles.aiInsightsTitle}>📊 Kişisel İçgörüler</Text>
                {aiInsights.slice(0, 2).map((insight, index) => (
                  <View key={index} style={styles.aiInsightCard}>
                    <Text style={styles.aiInsightText}>{insight.message || insight.content}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

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
        onPress={() => setShowQuickEntry(true)}
        position="fixed"
      />

      {/* Quick Entry Bottom Sheet */}
      <CompulsionQuickEntry
        visible={showQuickEntry}
        onDismiss={() => setShowQuickEntry(false)}
        onSubmit={handleCompulsionSubmit}
        initialCategory={params.category as string}
        initialText={params.text as string}
        initialResistance={params.resistanceLevel ? Number(params.resistanceLevel) : undefined}
        initialSeverity={params.severity ? Number(params.severity) : undefined}
        initialTrigger={params.trigger as string}

      />

      {/* User-Centric OCD Dashboard Modal */}
      {showUserCentricDashboard && (
        <View style={styles.dashboardOverlay}>
          <View style={styles.dashboardContainer}>
            <View style={styles.dashboardHeader}>
              <Text style={styles.dashboardTitle}>Recovery Dashboard</Text>
              <Pressable 
                onPress={() => setShowUserCentricDashboard(false)}
                style={styles.dashboardCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>
            
            <View style={styles.dashboardContent}>
              <UserCentricOCDDashboard
                compulsions={allCompulsions}
                ybocsHistory={ybocsHistory}
                userId={user?.id || ''}
              />
            </View>
          </View>
        </View>
      )}

      {/* Y-BOCS Assessment Modal */}
      {showYBOCSAssessment && (
        <View style={styles.ybocsModal}>
          <View style={styles.ybocsModalContainer}>
            <View style={styles.ybocsModalHeader}>
              <Text style={styles.ybocsModalTitle}>Y-BOCS Değerlendirmesi</Text>
              <Pressable 
                onPress={() => setShowYBOCSAssessment(false)}
                style={styles.ybocsModalClose}
                disabled={isYBOCSLoading}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>
            
            <View style={styles.ybocsModalContent}>
              <YBOCSAssessmentUI
                onComplete={handleYBOCSCompletion}
                isLoading={isYBOCSLoading}
                userId={user?.id}
              />
            </View>
          </View>
        </View>
      )}

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type="success"
        onHide={() => setShowToast(false)}
      />
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
  aiPatternsContainer: {
    gap: 12,
  },
  aiPatternCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  aiPatternPositive: {
    borderLeftColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  aiPatternWarning: {
    borderLeftColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  aiPatternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiPatternTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  aiPatternConfidence: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  aiPatternDescription: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  aiPatternSuggestion: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  aiInsightsContainer: {
    marginTop: 16,
  },
  aiInsightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  aiInsightCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  aiInsightText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  
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
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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

  // Y-BOCS Assessment Styles
  ybocsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  ybocsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ybocsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ybocsTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  ybocsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  ybocsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  ybocsButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 36,
  },
  
  // Y-BOCS Modal Styles
  ybocsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1001,
    justifyContent: 'flex-start',
    paddingTop: 50,
  },
  ybocsModalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 20,
  },
  ybocsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  ybocsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  ybocsModalClose: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  ybocsModalContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Recovery Dashboard Styles
  recoveryDashboardCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  recoveryDashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recoveryDashboardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recoveryDashboardTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  recoveryDashboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  recoveryDashboardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  recoveryDashboardButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 36,
  },
  
  // Dashboard Content
  dashboardContent: {
    flex: 1,
  },
});

