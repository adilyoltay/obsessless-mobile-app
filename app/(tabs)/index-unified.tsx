/**
 * Today Screen with Unified AI Pipeline Integration
 * 
 * Bu versiyon, tüm AI servislerini tek pipeline'dan çağırır.
 * 15 servisten 5 servise indirilmiş mimari.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  ScrollView, 
  RefreshControl, 
  StyleSheet,
  Text,
  TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/services/storage';

// Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/gamificationStore';
import { useERPSettingsStore } from '@/store/erpSettingsStore';

// AI - Unified Pipeline
import { unifiedPipeline, type UnifiedPipelineResult } from '@/features/ai/core/UnifiedAIPipeline';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// UI Components
import { BreathworkSuggestionCard } from '@/components/ui/BreathworkSuggestionCard';
import { CheckinBottomSheet } from '@/components/checkin/CheckinBottomSheet';

export default function TodayScreenUnified() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { profile, achievements } = useGamificationStore();
  const erpStore = useERPSettingsStore();
  
  // State
  const [refreshing, setRefreshing] = useState(false);
  const [unifiedResult, setUnifiedResult] = useState<UnifiedPipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{
    source: 'cache' | 'fresh';
    timestamp: number;
    ttl: number;
  } | null>(null);
  
  // Today Stats
  const [todayStats, setTodayStats] = useState({
    compulsions: 0,
    erpSessions: 0,
    healingPoints: 0,
    resistanceWins: 0
  });
  
  // Progressive UI
  const [isDeepAnalysisRunning, setIsDeepAnalysisRunning] = useState(false);
  const [hasDeepAnalysis, setHasDeepAnalysis] = useState(false);
  
  // ============================================================================
  // UNIFIED PIPELINE DATA LOADING
  // ============================================================================
  
  const loadUnifiedData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const startTime = Date.now();
      
      // Load local data first (for input to pipeline)
      const localData = await loadLocalData();
      
      // Call Unified Pipeline (single call for everything!)
      const result = await unifiedPipeline.process({
        userId: user.id,
        content: {
          compulsions: localData.compulsions,
          moods: localData.moods,
          erpSessions: localData.erpSessions,
          voiceCheckins: localData.voiceCheckins
        },
        type: 'mixed',
        context: {
          source: 'today',
          timestamp: Date.now()
        }
      });
      
      // Set results
      setUnifiedResult(result);
      setCacheInfo({
        source: result.metadata.source,
        timestamp: result.metadata.processedAt,
        ttl: result.metadata.cacheTTL
      });
      
      // Track telemetry
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_COMPLETED, {
        userId: user.id,
        processingTime: Date.now() - startTime,
        cacheHit: result.metadata.source === 'cache',
        modules: getEnabledModules(result)
      });
      
      // If cache hit and we have time, run deep analysis in background
      if (result.metadata.source === 'cache' && !hasDeepAnalysis) {
        runDeepAnalysisInBackground();
      }
      
    } catch (error) {
      console.error('Unified Pipeline error:', error);
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_ERROR, {
        userId: user.id,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================================================
  // PROGRESSIVE DEEP ANALYSIS
  // ============================================================================
  
  const runDeepAnalysisInBackground = async () => {
    if (!FEATURE_FLAGS.isEnabled('AI_PROGRESSIVE') || isDeepAnalysisRunning) {
      return;
    }
    
    setIsDeepAnalysisRunning(true);
    
    // Wait 3 seconds before running deep analysis
    setTimeout(async () => {
      try {
        // Force fresh analysis (bypass cache)
        const deepResult = await unifiedPipeline.process({
          userId: user.id,
          content: await loadLocalData(),
          type: 'mixed',
          context: {
            source: 'today',
            timestamp: Date.now(),
            metadata: { forceRefresh: true }
          }
        });
        
        // Update with deep results
        setUnifiedResult(deepResult);
        setHasDeepAnalysis(true);
        
        // Track deep analysis completion
        await trackAIInteraction(AIEventType.PROGRESSIVE_UI_UPDATE, {
          userId: user.id,
          updateType: 'deep_analysis',
          source: 'unified_pipeline'
        });
        
      } catch (error) {
        console.warn('Deep analysis failed:', error);
      } finally {
        setIsDeepAnalysisRunning(false);
      }
    }, 3000);
  };
  
  // ============================================================================
  // LOCAL DATA LOADING
  // ============================================================================
  
  const loadLocalData = async () => {
    if (!user?.id) {
      return {
        compulsions: [],
        moods: [],
        erpSessions: [],
        voiceCheckins: []
      };
    }
    
    const today = new Date().toDateString();
    
    // Load compulsions
    const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
    const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
    const allCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];
    const todayCompulsions = allCompulsions.filter((c: any) => 
      new Date(c.timestamp).toDateString() === today
    );
    
    // Load ERP sessions
    const erpKey = StorageKeys.ERP_SESSIONS(user.id, today);
    const erpData = await AsyncStorage.getItem(erpKey);
    const todayErpSessions = erpData ? JSON.parse(erpData) : [];
    
    // Load moods (last 7 days for pattern analysis)
    const moods = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const moodKey = `mood_entries_${user.id}_${date.toISOString().split('T')[0]}`;
      const moodData = await AsyncStorage.getItem(moodKey);
      if (moodData) {
        moods.push(...JSON.parse(moodData));
      }
    }
    
    // Load voice checkins (last 24 hours)
    const voiceKey = `voice_checkins_${user.id}`;
    const voiceData = await AsyncStorage.getItem(voiceKey);
    const allVoice = voiceData ? JSON.parse(voiceData) : [];
    const recentVoice = allVoice.filter((v: any) => 
      Date.now() - new Date(v.timestamp).getTime() < 24 * 60 * 60 * 1000
    );
    
    // Update stats
    const resistanceWins = todayCompulsions.filter((c: any) => c.resistanceLevel >= 3).length;
    setTodayStats({
      compulsions: todayCompulsions.length,
      erpSessions: todayErpSessions.length,
      healingPoints: profile.healingPointsToday,
      resistanceWins
    });
    
    return {
      compulsions: todayCompulsions,
      moods,
      erpSessions: todayErpSessions,
      voiceCheckins: recentVoice
    };
  };
  
  // ============================================================================
  // CACHE INVALIDATION HANDLERS
  // ============================================================================
  
  const handleCompulsionAdded = () => {
    // Invalidate cache when new compulsion is added
    unifiedPipeline.triggerInvalidation('compulsion_added', user?.id);
    // Reload data
    loadUnifiedData();
  };
  
  const handleERPCompleted = () => {
    // Invalidate cache when ERP session is completed
    unifiedPipeline.triggerInvalidation('erp_completed', user?.id);
    // Reload data
    loadUnifiedData();
  };
  
  const handleManualRefresh = async () => {
    setRefreshing(true);
    
    // Clear all cache
    unifiedPipeline.triggerInvalidation('manual_refresh', user?.id);
    
    // Reload with fresh data
    await loadUnifiedData();
    
    setRefreshing(false);
  };
  
  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  
  useEffect(() => {
    if (user?.id) {
      loadUnifiedData();
    }
  }, [user?.id]);
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  const getEnabledModules = (result: UnifiedPipelineResult): string[] => {
    const modules = [];
    if (result.voice) modules.push('voice');
    if (result.patterns) modules.push('patterns');
    if (result.insights) modules.push('insights');
    if (result.cbt) modules.push('cbt');
    return modules;
  };
  
  const formatCacheTime = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / 1000 / 60);
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    const hours = Math.floor(minutes / 60);
    return `${hours} saat önce`;
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleManualRefresh}
        />
      }
    >
      {/* Cache Info Banner */}
      {cacheInfo && (
        <View style={styles.cacheInfo}>
          <Text style={styles.cacheInfoText}>
            {cacheInfo.source === 'cache' ? '📦' : '🔄'} 
            {' '}{cacheInfo.source === 'cache' ? 'Önbellekten' : 'Yeni analiz'}
            {' • '}{formatCacheTime(cacheInfo.timestamp)}
          </Text>
          {hasDeepAnalysis && (
            <View style={styles.deepBadge}>
              <Text style={styles.deepBadgeText}>Güncellendi</Text>
            </View>
          )}
        </View>
      )}
      
      {/* Today Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayStats.compulsions}</Text>
          <Text style={styles.statLabel}>Kompulsiyon</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayStats.erpSessions}</Text>
          <Text style={styles.statLabel}>ERP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayStats.resistanceWins}</Text>
          <Text style={styles.statLabel}>Direnç</Text>
        </View>
      </View>
      
      {/* AI Insights */}
      {unifiedResult?.insights && (
        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>
            💡 Bugünkü Öneriler
            {isDeepAnalysisRunning && <Text style={styles.loadingText}> (güncelleniyor...)</Text>}
          </Text>
          
          {/* Therapeutic Insights */}
          {unifiedResult.insights.therapeutic?.map((insight, index) => (
            <View key={index} style={[
              styles.insightCard,
              insight.priority === 'high' && styles.insightCardHigh
            ]}>
              <Text style={styles.insightText}>{insight.text}</Text>
              {insight.actionable && (
                <TouchableOpacity style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Uygula</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          {/* Progress Insights */}
          {unifiedResult.insights.progress?.map((progress, index) => (
            <View key={index} style={styles.progressCard}>
              <Text style={styles.progressMetric}>{progress.interpretation}</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, progress.value * 10)}%` }
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}
      
      {/* Pattern Recognition Results */}
      {unifiedResult?.patterns && (
        <View style={styles.patternsContainer}>
          <Text style={styles.sectionTitle}>🔍 Tespit Edilen Desenler</Text>
          
          {/* Temporal Patterns */}
          {unifiedResult.patterns.temporal?.map((pattern, index) => (
            <View key={index} style={styles.patternCard}>
              <Text style={styles.patternType}>⏰ {pattern.timeOfDay}</Text>
              <Text style={styles.patternDesc}>
                {pattern.frequency} kez tekrarlandı • Trend: {pattern.trend}
              </Text>
            </View>
          ))}
          
          {/* Behavioral Patterns */}
          {unifiedResult.patterns.behavioral?.map((pattern, index) => (
            <View key={index} style={styles.patternCard}>
              <Text style={styles.patternType}>🎯 {pattern.trigger}</Text>
              <Text style={styles.patternDesc}>
                Sıklık: {pattern.frequency} • Şiddet: {pattern.severity}/10
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {/* CBT Analysis */}
      {unifiedResult?.cbt && (
        <View style={styles.cbtContainer}>
          <Text style={styles.sectionTitle}>🧠 Bilişsel Analiz</Text>
          
          {unifiedResult.cbt.distortions?.length > 0 && (
            <View style={styles.distortionsCard}>
              <Text style={styles.distortionsTitle}>Tespit Edilen Çarpıtmalar:</Text>
              {unifiedResult.cbt.distortions.map((distortion, index) => (
                <Text key={index} style={styles.distortionItem}>• {distortion}</Text>
              ))}
            </View>
          )}
          
          {unifiedResult.cbt.reframes?.length > 0 && (
            <View style={styles.reframesCard}>
              <Text style={styles.reframesTitle}>Önerilen Yeniden Çerçevelemeler:</Text>
              {unifiedResult.cbt.reframes.map((reframe, index) => (
                <Text key={index} style={styles.reframeItem}>{reframe}</Text>
              ))}
            </View>
          )}
        </View>
      )}
      
      {/* Pipeline Stats (Debug) */}
      {FEATURE_FLAGS.isEnabled('DEBUG_MODE') && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>🔧 Pipeline Debug</Text>
          <Text style={styles.debugText}>Version: {unifiedResult?.metadata.pipelineVersion}</Text>
          <Text style={styles.debugText}>Processing: {unifiedResult?.metadata.processingTime}ms</Text>
          <Text style={styles.debugText}>Source: {unifiedResult?.metadata.source}</Text>
          <Text style={styles.debugText}>Cache TTL: {unifiedResult?.metadata.cacheTTL / 1000 / 60 / 60}h</Text>
          <Text style={styles.debugText}>Modules: {getEnabledModules(unifiedResult || {} as any).join(', ')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  cacheInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  cacheInfoText: {
    fontSize: 12,
    color: '#6B7280'
  },
  deepBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  deepBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600'
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around'
  },
  statCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151'
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12
  },
  loadingText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '400'
  },
  insightsContainer: {
    padding: 16
  },
  insightCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8
  },
  insightCardHigh: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B'
  },
  insightText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20
  },
  actionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600'
  },
  progressCard: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  progressMetric: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2
  },
  progressFill: {
    height: 4,
    backgroundColor: '#10B981',
    borderRadius: 2
  },
  patternsContainer: {
    padding: 16
  },
  patternCard: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  patternType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  patternDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4
  },
  cbtContainer: {
    padding: 16
  },
  distortionsCard: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  distortionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8
  },
  distortionItem: {
    fontSize: 12,
    color: '#92400E',
    marginVertical: 2
  },
  reframesCard: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8
  },
  reframesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 8
  },
  reframeItem: {
    fontSize: 12,
    color: '#065F46',
    marginVertical: 4
  },
  debugContainer: {
    padding: 16,
    backgroundColor: '#F3F4F6',
    margin: 16,
    borderRadius: 8
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  debugText: {
    fontSize: 11,
    color: '#6B7280',
    marginVertical: 2
  }
});
