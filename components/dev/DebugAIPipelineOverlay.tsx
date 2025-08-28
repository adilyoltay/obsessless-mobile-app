/**
 * 🔧 Debug AI Pipeline Overlay - Development Only
 * 
 * UnifiedAIPipeline, Voice Analysis ve Insights akışını gerçek zamanlı görmek için
 * geliştirme modunda çalışan overlay bileşeni.
 * 
 * Features:
 * - Floating AI button → debug panel toggle
 * - Son 30 telemetry event'ini listele  
 * - Pipeline süreleri, cache hit/miss, LLM kullanımı gibi metrikleri göster
 * - PII içermez, sadece geliştirme modunda çalışır
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
// import Clipboard from '@react-native-clipboard/clipboard'; // Temporarily disabled
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  addTelemetryDebugListener, 
  removeTelemetryDebugListener,
  TelemetryEvent,
  AIEventType 
} from '@/features/ai-fallbacks/telemetry';

// Debug için önemli event türleri
const TRACKED_EVENT_TYPES = new Set([
  AIEventType.UNIFIED_PIPELINE_STARTED,
  AIEventType.UNIFIED_PIPELINE_COMPLETED,
  AIEventType.UNIFIED_PIPELINE_ERROR,
  AIEventType.UNIFIED_PIPELINE_CACHE_HIT,
  AIEventType.VOICE_ANALYSIS_STARTED,
  AIEventType.VOICE_ANALYSIS_COMPLETED,
  AIEventType.VOICE_ANALYSIS_FAILED,
  AIEventType.PATTERN_RECOGNITION_STARTED,
  AIEventType.PATTERN_RECOGNITION_COMPLETED,
  AIEventType.PATTERN_RECOGNITION_FAILED,
  AIEventType.INSIGHTS_GENERATED,
  AIEventType.INSIGHTS_DELIVERED,
  AIEventType.CACHE_HIT,
  AIEventType.CACHE_MISS,
  AIEventType.TOKEN_BUDGET_EXCEEDED,
  AIEventType.TOKEN_USAGE_RECORDED,
  AIEventType.LLM_GATING_DECISION,
  AIEventType.SIMILARITY_DEDUP_HIT,
  AIEventType.PROGRESSIVE_UI_UPDATE,
  // 🔧 STEP 5C: Add cache invalidation tracking
  'cache_invalidation', // Fixed: matching telemetry case
  'stale_cache_cleanup', // For stale cache operations
]);

interface DebugEvent extends TelemetryEvent {
  id: string;
}

// 📊 STEP 1: Metric Collection Buckets (Ring Buffers)
interface MetricBuckets {
  // Performance metrics
  processingTimes: {
    cacheHit: number[];
    freshHeuristic: number[];
    freshLLM: number[];
  };
  // Quality metrics  
  insights: {
    fresh: number[];
    cache: number[];
  };
  // Intelligence metrics
  gating: {
    allow: number;
    block: number;
    confidence: number[];
  };
  // System integrity
  dedup: {
    hits: number;
    total: number;
  };
  token: {
    budgetUsed: number[];
    budgetExceeded: number;
  };
  errors: {
    count: number;
    types: string[];
  };
  // Cache invalidation
  invalidation: {
    compulsion: number;
    mood: number;
    cbt: number;
  };
}

// Ring buffer helper - max 200 elements
const addToRingBuffer = (buffer: number[], value: number, maxSize = 200): number[] => {
  const newBuffer = [value, ...buffer];
  return newBuffer.slice(0, maxSize);
};

// 🧮 STEP 2: Calculation Engine - Percentiles
const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(percentile * (sorted.length - 1));
  return sorted[index] || 0;
};

// Performance thresholds from docs/AI_SYSTEM_TEST_METRICS.md
const PERFORMANCE_THRESHOLDS = {
  cacheHit: { p95: 150 },        // ms
  freshHeuristic: { p95: 600 },  // ms  
  freshLLM: { p95: 2000 },       // ms
  insightsMinimum: 0,             // count > 0
} as const;

// 📊 STEP 2: Calculate Current Metrics
interface CalculatedMetrics {
  performance: {
    cacheHitP95: number;
    freshHeuristicP95: number;
    freshLLMP95: number;
    cacheHitP50: number;
    freshHeuristicP50: number;
    freshLLMP50: number;
  };
  quality: {
    freshInsightsAvg: number;
    cacheInsightsAvg: number;
    freshInsightsMin: number;
    cacheInsightsMin: number;
  };
  intelligence: {
    gatingAllowCount: number;
    gatingBlockCount: number;
    gatingConfidenceAvg: number;
    gatingPolicyAdherence: number; // % of blocks with confidence ≥ 0.8
  };
  integrity: {
    dedupEffectiveness: number; // hits/total ratio
    tokenBudgetUsage: number[];
    errorRate: number;
    invalidationTriggers: {
      compulsion: number;
      mood: number;
      cbt: number;
    };
  };
  status: {
    cacheHitStatus: 'pass' | 'warn' | 'fail';
    freshHeuristicStatus: 'pass' | 'warn' | 'fail';
    freshLLMStatus: 'pass' | 'warn' | 'fail';
    insightsStatus: 'pass' | 'warn' | 'fail';
  };
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function DebugAIPipelineOverlay() {
  // Production'da hiç render etme
  if (!__DEV__ || !FEATURE_FLAGS.isEnabled('DEBUG_MODE')) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [panelAnimation] = useState(new Animated.Value(0));
  const [activeTab, setActiveTab] = useState<'events' | 'summary'>('events');
  
  // 📊 STEP 1: Metric Buckets State
  const [metrics, setMetrics] = useState<MetricBuckets>({
    processingTimes: {
      cacheHit: [],
      freshHeuristic: [],
      freshLLM: [],
    },
    insights: {
      fresh: [],
      cache: [],
    },
    gating: {
      allow: 0,
      block: 0,
      confidence: [],
    },
    dedup: {
      hits: 0,
      total: 0,
    },
    token: {
      budgetUsed: [],
      budgetExceeded: 0,
    },
    errors: {
      count: 0,
      types: [],
    },
    invalidation: {
      compulsion: 0,
      mood: 0,
      cbt: 0,
    },
  });

  // 🧮 STEP 2: Calculate Current Metrics
  const calculateCurrentMetrics = (): CalculatedMetrics => {
    // Performance calculations
    const cacheHitP95 = calculatePercentile(metrics.processingTimes.cacheHit, 0.95);
    const cacheHitP50 = calculatePercentile(metrics.processingTimes.cacheHit, 0.50);
    const freshHeuristicP95 = calculatePercentile(metrics.processingTimes.freshHeuristic, 0.95);
    const freshHeuristicP50 = calculatePercentile(metrics.processingTimes.freshHeuristic, 0.50);
    const freshLLMP95 = calculatePercentile(metrics.processingTimes.freshLLM, 0.95);
    const freshLLMP50 = calculatePercentile(metrics.processingTimes.freshLLM, 0.50);

    // Quality calculations
    const freshInsightsAvg = metrics.insights.fresh.length > 0 
      ? metrics.insights.fresh.reduce((sum, val) => sum + val, 0) / metrics.insights.fresh.length 
      : 0;
    const cacheInsightsAvg = metrics.insights.cache.length > 0
      ? metrics.insights.cache.reduce((sum, val) => sum + val, 0) / metrics.insights.cache.length
      : 0;
    const freshInsightsMin = metrics.insights.fresh.length > 0 
      ? Math.min(...metrics.insights.fresh) 
      : 0;
    const cacheInsightsMin = metrics.insights.cache.length > 0
      ? Math.min(...metrics.insights.cache)
      : 0;

    // Intelligence calculations
    const gatingConfidenceAvg = metrics.gating.confidence.length > 0
      ? metrics.gating.confidence.reduce((sum, val) => sum + val, 0) / metrics.gating.confidence.length
      : 0;
    const highConfidenceBlocks = metrics.gating.confidence.filter(c => c >= 0.8).length;
    const gatingPolicyAdherence = metrics.gating.confidence.length > 0
      ? (highConfidenceBlocks / metrics.gating.confidence.length) * 100
      : 0;

    // Integrity calculations  
    const dedupEffectiveness = metrics.dedup.total > 0
      ? (metrics.dedup.hits / metrics.dedup.total) * 100
      : 0;

    // Status determinations
    const cacheHitStatus: 'pass' | 'warn' | 'fail' = 
      cacheHitP95 === 0 ? 'warn' :
      cacheHitP95 <= PERFORMANCE_THRESHOLDS.cacheHit.p95 ? 'pass' : 'fail';
    
    const freshHeuristicStatus: 'pass' | 'warn' | 'fail' = 
      freshHeuristicP95 === 0 ? 'warn' :
      freshHeuristicP95 <= PERFORMANCE_THRESHOLDS.freshHeuristic.p95 ? 'pass' : 'fail';
    
    const freshLLMStatus: 'pass' | 'warn' | 'fail' = 
      freshLLMP95 === 0 ? 'warn' :
      freshLLMP95 <= PERFORMANCE_THRESHOLDS.freshLLM.p95 ? 'pass' : 'fail';

    const insightsStatus: 'pass' | 'warn' | 'fail' = 
      freshInsightsMin > PERFORMANCE_THRESHOLDS.insightsMinimum && 
      cacheInsightsMin > PERFORMANCE_THRESHOLDS.insightsMinimum ? 'pass' : 'fail';

    return {
      performance: {
        cacheHitP95,
        freshHeuristicP95,
        freshLLMP95,
        cacheHitP50,
        freshHeuristicP50,
        freshLLMP50,
      },
      quality: {
        freshInsightsAvg,
        cacheInsightsAvg,
        freshInsightsMin,
        cacheInsightsMin,
      },
      intelligence: {
        gatingAllowCount: metrics.gating.allow,
        gatingBlockCount: metrics.gating.block,
        gatingConfidenceAvg,
        gatingPolicyAdherence,
      },
      integrity: {
        dedupEffectiveness,
        tokenBudgetUsage: metrics.token.budgetUsed,
        errorRate: metrics.errors.count,
        invalidationTriggers: {
          compulsion: metrics.invalidation.compulsion,
          mood: metrics.invalidation.mood,
          cbt: metrics.invalidation.cbt,
        },
      },
      status: {
        cacheHitStatus,
        freshHeuristicStatus,
        freshLLMStatus,
        insightsStatus,
      },
    };
  };

  // 📊 STEP 1: Enhanced Event Classification & Metric Collection
  const classifyAndCollectMetrics = (event: TelemetryEvent) => {
    setMetrics(prevMetrics => {
      const newMetrics = { ...prevMetrics };
      const metadata = event.metadata || {};

      // 🚀 PERFORMANCE: Processing Times
      if (event.eventType === AIEventType.UNIFIED_PIPELINE_COMPLETED) {
        const processingTime = metadata.processingTime || 0;
        const cacheHit = metadata.cacheHit;
        const usedLLM = metadata.usedLLM;

        if (cacheHit) {
          newMetrics.processingTimes.cacheHit = addToRingBuffer(
            newMetrics.processingTimes.cacheHit, 
            processingTime
          );
        } else if (usedLLM) {
          newMetrics.processingTimes.freshLLM = addToRingBuffer(
            newMetrics.processingTimes.freshLLM, 
            processingTime
          );
        } else {
          newMetrics.processingTimes.freshHeuristic = addToRingBuffer(
            newMetrics.processingTimes.freshHeuristic, 
            processingTime
          );
        }
      }

      // 🤖 ADDITIONAL LLM DETECTION: Direct voice analysis events with usedLLM flag
      if (metadata.usedLLM === true && metadata.processingTime) {
        const processingTime = metadata.processingTime;
        newMetrics.processingTimes.freshLLM = addToRingBuffer(
          newMetrics.processingTimes.freshLLM, 
          processingTime
        );
      }

      // 🎯 HEURISTIC LLM DETECTION: Long processing times indicate LLM usage
      if (event.eventType === AIEventType.UNIFIED_PIPELINE_COMPLETED && 
          metadata.cacheHit === false && 
          metadata.processingTime > 1000 && 
          metadata.usedLLM !== true) { // Not already captured above
        const processingTime = metadata.processingTime;
        
        // Move from heuristic to LLM bucket if processing time suggests LLM
        const heuristicIndex = newMetrics.processingTimes.freshHeuristic.findIndex(time => time === processingTime);
        if (heuristicIndex === -1) { // Not already in heuristic bucket
          newMetrics.processingTimes.freshLLM = addToRingBuffer(
            newMetrics.processingTimes.freshLLM, 
            processingTime
          );
        }
      }

      // 📊 QUALITY: Insights Count
      if (event.eventType === AIEventType.INSIGHTS_DELIVERED) {
        const insightsCount = metadata.insightsCount || 0;
        const source = metadata.from || metadata.source || 'unknown';

        if (source === 'cache') {
          newMetrics.insights.cache = addToRingBuffer(
            newMetrics.insights.cache, 
            insightsCount
          );
        } else {
          newMetrics.insights.fresh = addToRingBuffer(
            newMetrics.insights.fresh, 
            insightsCount
          );
        }
      }

      // 🧠 INTELLIGENCE: LLM Gating
      if (event.eventType === AIEventType.LLM_GATING_DECISION) {
        const decision = metadata.decision;
        const confidence = metadata.heuristicConfidence || 0;

        if (decision === 'allow') {
          newMetrics.gating.allow++;
        } else if (decision === 'block') {
          newMetrics.gating.block++;
        }
        
        newMetrics.gating.confidence = addToRingBuffer(
          newMetrics.gating.confidence, 
          confidence
        );
      }

      // 🔄 DEDUP: Similarity Detection
      if (event.eventType === AIEventType.SIMILARITY_DEDUP_HIT) {
        newMetrics.dedup.hits++;
        newMetrics.dedup.total++;
      }

      // 💰 TOKEN: Budget Management
      if (event.eventType === AIEventType.TOKEN_BUDGET_EXCEEDED) {
        newMetrics.token.budgetExceeded++;
      }
      
      if (event.eventType === AIEventType.TOKEN_USAGE_RECORDED) {
        const tokenCount = metadata.tokenCount || 0;
        newMetrics.token.budgetUsed = addToRingBuffer(
          newMetrics.token.budgetUsed, 
          tokenCount
        );
      }

      // ❌ ERRORS: System Failures
      if (event.eventType.includes('ERROR') || event.eventType.includes('FAILED')) {
        newMetrics.errors.count++;
        const errorType = event.eventType;
        if (!newMetrics.errors.types.includes(errorType)) {
          newMetrics.errors.types = [...newMetrics.errors.types, errorType].slice(0, 10);
        }
      }

      // 🔄 INVALIDATION: Cache Management
      if (event.eventType === 'cache_invalidation') {
        const hook = metadata.hook || '';
        if (hook === 'compulsion_added') newMetrics.invalidation.compulsion++;
        if (hook === 'mood_added') newMetrics.invalidation.mood++;
        if (hook === 'cbt_added') newMetrics.invalidation.cbt++;
      }

      return newMetrics;
    });
  };

  // Telemetry listener setup
  useEffect(() => {
    const listener = (event: TelemetryEvent) => {
      // Sadece ilgilendiğimiz event türlerini track et
      if (!TRACKED_EVENT_TYPES.has(event.eventType)) {
        return;
      }

      // 📊 STEP 1: Classify and collect metrics
      classifyAndCollectMetrics(event);

      const debugEvent: DebugEvent = {
        ...event,
        id: `${event.eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      };

      setEvents(prevEvents => {
        // Son 30 event'i tut
        const newEvents = [debugEvent, ...prevEvents].slice(0, 30);
        return newEvents;
      });
    };

    addTelemetryDebugListener(listener);

    return () => {
      removeTelemetryDebugListener(listener);
    };
  }, []);

  // Panel animation
  useEffect(() => {
    Animated.timing(panelAnimation, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, panelAnimation]);

  const togglePanel = () => {
    setIsOpen(prev => !prev);
  };

  const clearEvents = () => {
    setEvents([]);
    // 📊 STEP 1: Clear metrics as well
    setMetrics({
      processingTimes: {
        cacheHit: [],
        freshHeuristic: [],
        freshLLM: [],
      },
      insights: {
        fresh: [],
        cache: [],
      },
      gating: {
        allow: 0,
        block: 0,
        confidence: [],
      },
      dedup: {
        hits: 0,
        total: 0,
      },
      token: {
        budgetUsed: [],
        budgetExceeded: 0,
      },
      errors: {
        count: 0,
        types: [],
      },
      invalidation: {
        compulsion: 0,
        mood: 0,
        cbt: 0,
      },
    });
  };

  const copyLogsToClipboard = () => {
    try {
      // Log'ları formatla
      const logData = {
        timestamp: new Date().toISOString(),
        totalEvents: events.length,
        events: events.map(event => ({
          timestamp: (event as any).timestamp,
          type: (event as any).type,
          metadata: (event as any).metadata,
          duration: (event as any).duration ? `${(event as any).duration}ms` : undefined
        }))
      };

      const formattedLogs = JSON.stringify(logData, null, 2);
      
      // Clipboard.setString(formattedLogs); // Temporarily disabled - native module issue
      console.log('📋 Debug Logs (clipboard temporarily disabled):', formattedLogs);
      
      Alert.alert(
        '📋 Loglar Console\'a Yazdırıldı',
        `${events.length} AI event console log'a yazdırıldı. Metro terminal'da görebilirsiniz.`,
        [{ text: 'Tamam', style: 'default' }]
      );
    } catch (error) {
      console.error('❌ Log output error:', error);
      Alert.alert(
        '❌ Hata',
        'Loglar yazdırılırken bir hata oluştu.',
        [{ text: 'Tamam', style: 'default' }]
      );
    }
  };

  // 📤 STEP 4: Export Metrics Snapshot
  const exportMetricsSnapshot = () => {
    try {
      const currentMetrics = calculateCurrentMetrics();
      
      // Format according to docs/AI_SYSTEM_TEST_METRICS.md
      const snapshot = {
        timestamp: new Date().toISOString(),
        testSession: `AI_METRICS_SNAPSHOT_${Date.now()}`,
        
        // Performance Metrics
        'metrics.performance': {
          cacheHitP95: currentMetrics.performance.cacheHitP95,
          cacheHitP50: currentMetrics.performance.cacheHitP50,
          freshHeuristicP95: currentMetrics.performance.freshHeuristicP95,
          freshHeuristicP50: currentMetrics.performance.freshHeuristicP50,
          freshLLMP95: currentMetrics.performance.freshLLMP95,
          freshLLMP50: currentMetrics.performance.freshLLMP50,
        },
        
        // Quality Metrics
        'metrics.quality': {
          freshInsightsAvg: currentMetrics.quality.freshInsightsAvg,
          cacheInsightsAvg: currentMetrics.quality.cacheInsightsAvg,
          freshInsightsMin: currentMetrics.quality.freshInsightsMin,
          cacheInsightsMin: currentMetrics.quality.cacheInsightsMin,
        },
        
        // Intelligence Metrics  
        'metrics.intelligence': {
          gatingAllowCount: currentMetrics.intelligence.gatingAllowCount,
          gatingBlockCount: currentMetrics.intelligence.gatingBlockCount,
          gatingConfidenceAvg: currentMetrics.intelligence.gatingConfidenceAvg,
          gatingPolicyAdherence: currentMetrics.intelligence.gatingPolicyAdherence,
        },
        
        // System Integrity Metrics
        'metrics.integrity': {
          invalidations: {
            compulsion: currentMetrics.integrity.invalidationTriggers.compulsion,
            mood: currentMetrics.integrity.invalidationTriggers.mood,
            cbt: currentMetrics.integrity.invalidationTriggers.cbt,
          },
          dedupHits: currentMetrics.integrity.dedupEffectiveness,
          errorCount: currentMetrics.integrity.errorRate,
          tokenBudgetUsage: currentMetrics.integrity.tokenBudgetUsage.length,
        },
        
        // Status Assessment
        'metrics.status': {
          cacheHitStatus: currentMetrics.status.cacheHitStatus,
          freshHeuristicStatus: currentMetrics.status.freshHeuristicStatus,  
          freshLLMStatus: currentMetrics.status.freshLLMStatus,
          insightsStatus: currentMetrics.status.insightsStatus,
          overallStatus: [
            currentMetrics.status.cacheHitStatus,
            currentMetrics.status.freshHeuristicStatus,
            currentMetrics.status.freshLLMStatus,
            currentMetrics.status.insightsStatus
          ].includes('fail') ? 'FAIL' : 
          [
            currentMetrics.status.cacheHitStatus,
            currentMetrics.status.freshHeuristicStatus,
            currentMetrics.status.freshLLMStatus,
            currentMetrics.status.insightsStatus
          ].includes('warn') ? 'WARN' : 'PASS'
        },
        
        // Sample Counts
        sampleCounts: {
          cacheHit: metrics.processingTimes.cacheHit.length,
          freshHeuristic: metrics.processingTimes.freshHeuristic.length,
          freshLLM: metrics.processingTimes.freshLLM.length,
          freshInsights: metrics.insights.fresh.length,
          cacheInsights: metrics.insights.cache.length,
          gatingDecisions: metrics.gating.confidence.length,
          totalEvents: events.length,
        },
        
        // Compliance Check
        complianceCheck: {
          performanceThresholds: {
            cacheHitP95_Target: PERFORMANCE_THRESHOLDS.cacheHit.p95,
            cacheHitP95_Actual: currentMetrics.performance.cacheHitP95,
            cacheHitP95_Pass: currentMetrics.status.cacheHitStatus === 'pass',
            
            freshHeuristicP95_Target: PERFORMANCE_THRESHOLDS.freshHeuristic.p95,
            freshHeuristicP95_Actual: currentMetrics.performance.freshHeuristicP95,
            freshHeuristicP95_Pass: currentMetrics.status.freshHeuristicStatus === 'pass',
            
            freshLLMP95_Target: PERFORMANCE_THRESHOLDS.freshLLM.p95,
            freshLLMP95_Actual: currentMetrics.performance.freshLLMP95,
            freshLLMP95_Pass: currentMetrics.status.freshLLMStatus === 'pass',
            
            insightsMinimum_Target: PERFORMANCE_THRESHOLDS.insightsMinimum,
            insightsMinimum_Pass: currentMetrics.status.insightsStatus === 'pass',
          }
        }
      };

      const formattedSnapshot = JSON.stringify(snapshot, null, 2);
      console.log('📊 AI_METRICS_SNAPSHOT:', formattedSnapshot);
      
      Alert.alert(
        '📊 Metrics Snapshot Exported',
        `AI metrics snapshot console'a yazdırıldı.\n\nOverall Status: ${snapshot['metrics.status'].overallStatus}\n\nMetro terminal'da 'AI_METRICS_SNAPSHOT' araması yapın.`,
        [{ text: 'Tamam', style: 'default' }]
      );
    } catch (error) {
      console.error('❌ Metrics export error:', error);
      Alert.alert(
        '❌ Export Hatası',
        'Metrics export edilirken bir hata oluştu.',
        [{ text: 'Tamam', style: 'default' }]
      );
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('tr-TR', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return timestamp.slice(-8);
    }
  };

  const getEventColor = (eventType: AIEventType) => {
    if (eventType.includes('ERROR') || eventType.includes('FAILED')) return '#FF6B6B';
    if (eventType.includes('COMPLETED') || eventType.includes('HIT')) return '#51CF66';
    if (eventType.includes('STARTED')) return '#339AF0';
    if (eventType.includes('CACHE')) return '#FF922B';
    if (eventType.includes('TOKEN')) return '#9775FA';
    return '#868E96';
  };

  const getKeyMetadata = (metadata: Record<string, any>) => {
    const keys = [];
    if ('processingTime' in metadata) keys.push(`${metadata.processingTime}ms`);
    if ('cacheHit' in metadata) keys.push(metadata.cacheHit ? 'CACHE-HIT' : 'CACHE-MISS');
    if ('usedLLM' in metadata) keys.push(metadata.usedLLM ? 'LLM' : 'HEURISTIC');
    if ('inputType' in metadata) keys.push(metadata.inputType?.toUpperCase());
    if ('decision' in metadata) keys.push(metadata.decision?.toUpperCase());
    if ('tokenCount' in metadata) keys.push(`${metadata.tokenCount}t`);
    return keys.slice(0, 3); // Max 3 key info
  };

  // 🎨 STEP 3: Status Icon Helper
  const getStatusIcon = (status: 'pass' | 'warn' | 'fail'): string => {
    switch (status) {
      case 'pass': return '✅';
      case 'warn': return '⚠️';
      case 'fail': return '❌';
    }
  };

  // 🎨 STEP 3: Status Color Helper
  const getStatusColor = (status: 'pass' | 'warn' | 'fail'): string => {
    switch (status) {
      case 'pass': return '#51CF66';
      case 'warn': return '#FF922B';
      case 'fail': return '#FF6B6B';
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Floating AI Button */}
      <Pressable
        style={[styles.floatingButton, isOpen && styles.floatingButtonActive]}
        onPress={togglePanel}
        accessible={true}
        accessibilityLabel="AI Debug Panel Toggle"
      >
        <Text style={styles.floatingButtonText}>AI</Text>
        <Text style={styles.eventCount}>{events.length}</Text>
      </Pressable>

      {/* Debug Panel */}
      {isOpen && (
        <Animated.View 
          style={[
            styles.panel,
            {
              opacity: panelAnimation,
              transform: [{
                translateX: panelAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenWidth * 0.5, 0]
                })
              }]
            }
          ]}
          pointerEvents={isOpen ? 'auto' : 'none'}
        >
        {/* Panel Header */}
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>🔧 AI Pipeline Debug</Text>
          <View style={styles.headerButtons}>
            {/* 📤 STEP 4: Export Button */}
            <Pressable 
              style={[styles.headerButton, { backgroundColor: '#51CF66' }]} 
              onPress={exportMetricsSnapshot}
              accessible={true}
              accessibilityLabel="Metrics snapshot export et"
            >
              <Text style={styles.headerButtonText}>📊</Text>
            </Pressable>
            <Pressable 
              style={[styles.headerButton, { backgroundColor: '#4DABF7' }]} 
              onPress={copyLogsToClipboard}
              accessible={true}
              accessibilityLabel="Logları console yazdır"
            >
              <Text style={styles.headerButtonText}>📋</Text>
            </Pressable>
            <Pressable 
              style={[styles.headerButton, { backgroundColor: '#FF6B35' }]} 
              onPress={clearEvents}
              accessible={true}
              accessibilityLabel="Eventleri temizle"
            >
              <Text style={styles.headerButtonText}>🗑️</Text>
            </Pressable>
            <Pressable 
              style={[styles.headerButton, { backgroundColor: '#868E96' }]} 
              onPress={togglePanel}
              accessible={true}
              accessibilityLabel="Paneli kapat"
            >
              <Text style={styles.headerButtonText}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* 🎨 STEP 3: Tab Navigation */}
        <View style={styles.tabContainer}>
          <Pressable 
            style={[
              styles.tab, 
              activeTab === 'events' && styles.activeTab
            ]}
            onPress={() => setActiveTab('events')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'events' && styles.activeTabText
            ]}>
              Events ({events.length})
            </Text>
          </Pressable>
          <Pressable 
            style={[
              styles.tab, 
              activeTab === 'summary' && styles.activeTab
            ]}
            onPress={() => setActiveTab('summary')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'summary' && styles.activeTabText
            ]}>
              📊 Summary
            </Text>
          </Pressable>
        </View>

        {/* Content Area - Conditional Rendering */}
        {activeTab === 'events' ? (
          /* Events List */
          <ScrollView style={styles.eventsList} showsVerticalScrollIndicator={false}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Henüz AI event'i yok.{'\n'}
                  Voice check-in, CBT analizi veya{'\n'}
                  insights yenileme deneyin.
                </Text>
              </View>
            ) : (
              events.map((event) => {
                const keyMetadata = getKeyMetadata(event.metadata);
                return (
                  <View key={event.id} style={styles.eventItem}>
                    <View style={styles.eventHeader}>
                      <View 
                        style={[
                          styles.eventDot, 
                          { backgroundColor: getEventColor(event.eventType) }
                        ]} 
                      />
                      <Text style={styles.eventTime}>
                        {formatTimestamp(event.timestamp)}
                      </Text>
                      <Text 
                        style={[
                          styles.eventType,
                          { color: getEventColor(event.eventType) }
                        ]}
                        numberOfLines={1}
                      >
                        {event.eventType.replace('UNIFIED_PIPELINE_', 'UP_')
                                      .replace('VOICE_ANALYSIS_', 'VA_')
                                      .replace('PATTERN_RECOGNITION_', 'PR_')}
                      </Text>
                    </View>
                    {keyMetadata.length > 0 && (
                      <View style={styles.eventMetadata}>
                        {keyMetadata.map((meta, idx) => (
                          <Text key={idx} style={styles.metadataTag}>
                            {meta}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        ) : (
          /* 🎨 STEP 3: Summary Panel */
          <ScrollView style={styles.summaryPanel} showsVerticalScrollIndicator={false}>
            {(() => {
              const currentMetrics = calculateCurrentMetrics();
              return (
                <View style={styles.summaryContent}>
                  {/* Performance Section */}
                  <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>🚀 Performance</Text>
                    
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Cache Hit P95</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.performance.cacheHitP95}ms
                      </Text>
                      <Text style={styles.metricTarget}>
                        &lt;150ms
                      </Text>
                      <Text style={[styles.statusIcon, { color: getStatusColor(currentMetrics.status.cacheHitStatus) }]}>
                        {getStatusIcon(currentMetrics.status.cacheHitStatus)}
                      </Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Fresh (no LLM) P95</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.performance.freshHeuristicP95}ms
                      </Text>
                      <Text style={styles.metricTarget}>
                        &lt;600ms
                      </Text>
                      <Text style={[styles.statusIcon, { color: getStatusColor(currentMetrics.status.freshHeuristicStatus) }]}>
                        {getStatusIcon(currentMetrics.status.freshHeuristicStatus)}
                      </Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>LLM P95</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.performance.freshLLMP95}ms
                      </Text>
                      <Text style={styles.metricTarget}>
                        &lt;2000ms
                      </Text>
                      <Text style={[styles.statusIcon, { color: getStatusColor(currentMetrics.status.freshLLMStatus) }]}>
                        {getStatusIcon(currentMetrics.status.freshLLMStatus)}
                      </Text>
                    </View>
                  </View>

                  {/* Quality Section */}
                  <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>📊 Quality</Text>
                    
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Fresh Insights Avg</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.quality.freshInsightsAvg.toFixed(1)}
                      </Text>
                      <Text style={styles.metricTarget}>
                        &gt;0
                      </Text>
                      <Text style={[styles.statusIcon, { color: getStatusColor(currentMetrics.status.insightsStatus) }]}>
                        {getStatusIcon(currentMetrics.status.insightsStatus)}
                      </Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Cache Insights Avg</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.quality.cacheInsightsAvg.toFixed(1)}
                      </Text>
                      <Text style={styles.metricTarget}>
                        &gt;0
                      </Text>
                      <Text style={[styles.statusIcon, { color: getStatusColor(currentMetrics.status.insightsStatus) }]}>
                        {getStatusIcon(currentMetrics.status.insightsStatus)}
                      </Text>
                    </View>
                  </View>

                  {/* Intelligence Section */}
                  <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>🧠 Intelligence</Text>
                    
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Gating Allow</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.intelligence.gatingAllowCount}
                      </Text>
                      <Text style={styles.metricTarget}>
                        ≥1
                      </Text>
                      <Text style={[styles.statusIcon, { color: currentMetrics.intelligence.gatingAllowCount >= 1 ? '#51CF66' : '#FF922B' }]}>
                        {currentMetrics.intelligence.gatingAllowCount >= 1 ? '✅' : '⚠️'}
                      </Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Gating Block</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.intelligence.gatingBlockCount}
                      </Text>
                      <Text style={styles.metricTarget}>
                        ≥1
                      </Text>
                      <Text style={[styles.statusIcon, { color: currentMetrics.intelligence.gatingBlockCount >= 1 ? '#51CF66' : '#FF922B' }]}>
                        {currentMetrics.intelligence.gatingBlockCount >= 1 ? '✅' : '⚠️'}
                      </Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Policy Adherence</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.intelligence.gatingPolicyAdherence.toFixed(1)}%
                      </Text>
                      <Text style={styles.metricTarget}>
                        ≥80%
                      </Text>
                      <Text style={[styles.statusIcon, { color: currentMetrics.intelligence.gatingPolicyAdherence >= 80 ? '#51CF66' : '#FF6B6B' }]}>
                        {currentMetrics.intelligence.gatingPolicyAdherence >= 80 ? '✅' : '❌'}
                      </Text>
                    </View>
                  </View>

                  {/* System Integrity Section */}
                  <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>🔧 System Integrity</Text>
                    
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Dedup Effectiveness</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.integrity.dedupEffectiveness.toFixed(1)}%
                      </Text>
                      <Text style={styles.metricTarget}>
                        -
                      </Text>
                      <Text style={styles.statusIcon}>
                        📊
                      </Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Error Count</Text>
                      <Text style={styles.metricValue}>
                        {currentMetrics.integrity.errorRate}
                      </Text>
                      <Text style={styles.metricTarget}>
                        =0
                      </Text>
                      <Text style={[styles.statusIcon, { color: currentMetrics.integrity.errorRate === 0 ? '#51CF66' : '#FF6B6B' }]}>
                        {currentMetrics.integrity.errorRate === 0 ? '✅' : '❌'}
                      </Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Cache Invalidations</Text>
                      <Text style={styles.metricValue}>
                        C:{currentMetrics.integrity.invalidationTriggers.compulsion} | 
                        M:{currentMetrics.integrity.invalidationTriggers.mood} | 
                        CBT:{currentMetrics.integrity.invalidationTriggers.cbt}
                      </Text>
                      <Text style={styles.metricTarget}>
                        -
                      </Text>
                      <Text style={styles.statusIcon}>
                        🔄
                      </Text>
                    </View>
                  </View>

                  {/* Sample Counts */}
                  <View style={[styles.summarySection, styles.sampleCounts]}>
                    <Text style={styles.sectionTitle}>📈 Sample Counts</Text>
                    <Text style={styles.sampleText}>
                      Cache Hit: {metrics.processingTimes.cacheHit.length} samples{'\n'}
                      Fresh Heuristic: {metrics.processingTimes.freshHeuristic.length} samples{'\n'}
                      Fresh LLM: {metrics.processingTimes.freshLLM.length} samples{'\n'}
                      Fresh Insights: {metrics.insights.fresh.length} samples{'\n'}
                      Cache Insights: {metrics.insights.cache.length} samples
                    </Text>
                  </View>
                </View>
              );
            })()}
          </ScrollView>
        )}

          {/* Panel Footer */}
          <View style={styles.panelFooter}>
            <Text style={styles.footerText}>
              🚀 Events: {events.length}/30 | DEV Only
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#339AF0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 10000,
  },
  floatingButtonActive: {
    backgroundColor: '#1C7ED6',
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF6B6B',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    textAlign: 'center',
  },
  panel: {
    position: 'absolute',
    top: 80,
    right: 0,
    width: screenWidth * 0.9,
    height: screenHeight * 0.75,
    backgroundColor: '#1A1B1E',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    elevation: 15,
    zIndex: 10001,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2E33',
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#6C7B7F',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  eventItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2E33',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventTime: {
    color: '#6C7B7F',
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 60,
  },
  eventType: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    fontFamily: 'monospace',
  },
  eventMetadata: {
    flexDirection: 'row',
    marginTop: 4,
    marginLeft: 16,
    flexWrap: 'wrap',
    gap: 4,
  },
  metadataTag: {
    backgroundColor: '#2C2E33',
    color: '#868E96',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontFamily: 'monospace',
  },
  panelFooter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2C2E33',
  },
  footerText: {
    color: '#6C7B7F',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  // 🎨 STEP 3: Summary Panel Styles
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2E33',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#339AF0',
  },
  tabText: {
    color: '#6C7B7F',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#339AF0',
  },
  summaryPanel: {
    flex: 1,
    paddingHorizontal: 16,
  },
  summaryContent: {
    paddingVertical: 16,
  },
  summarySection: {
    marginBottom: 20,
    backgroundColor: '#25262B',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2E33',
  },
  metricLabel: {
    color: '#C1C2C5',
    fontSize: 11,
    flex: 2,
    fontFamily: 'monospace',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  metricTarget: {
    color: '#6C7B7F',
    fontSize: 10,
    flex: 1,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  statusIcon: {
    fontSize: 14,
    textAlign: 'center',
    minWidth: 24,
  },
  sampleCounts: {
    backgroundColor: '#1E1F23',
  },
  sampleText: {
    color: '#6C7B7F',
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});
