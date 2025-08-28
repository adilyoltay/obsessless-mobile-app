/**
 * 📊 Insight Registry - Unified AI/Heuristic Output Standardization
 * 
 * Standardizes all AI insights, patterns, analytics, and suggestions under a single
 * registry with consistent provenance and quality metadata.
 * 
 * Privacy-first: Only derived metrics, no PII in registry items.
 */

import type { UnifiedPipelineResult } from '../core/UnifiedAIPipeline';

// Core Types
export type InsightKind = 'insight' | 'pattern' | 'analytics' | 'suggestion';
export type InsightCategory = 'mood' | 'cbt' | 'ocd' | 'breathwork' | 'timeline';
export type InsightModule = 'today' | 'mood' | 'cbt' | 'tracking';
export type ProvenanceSource = 'unified' | 'cache' | 'heuristic' | 'llm';
export type QualityLevel = 'low' | 'medium' | 'high';

export interface InsightRegistryItem {
  id: string;
  kind: InsightKind;
  category: InsightCategory;
  module: InsightModule;
  provenance: {
    source: ProvenanceSource;
    version?: string;
    generatedAt: number;
    ttlMs?: number;
    trigger?: string;
  };
  quality: {
    confidence?: number;
    sampleSize?: number;
    dataQuality?: number;
    freshnessMs?: number;
    stability?: number;
  };
  privacy: {
    piiSanitized: boolean;
    auditHash?: string;
  };
  payload: {
    title?: string;
    summary?: string;
    metrics?: Record<string, any>;
    actions?: Array<{ label: string; screen: string; params?: any }>;
  };
}

/**
 * 📊 Estimate quality level from insight metadata
 */
export function estimateQualityLevel(quality: InsightRegistryItem['quality']): QualityLevel {
  const { confidence = 0, sampleSize = 0, dataQuality = 0, freshnessMs = Infinity } = quality;
  
  // High quality: high confidence + good sample + fresh data
  if (confidence >= 0.8 && sampleSize >= 7 && freshnessMs < 30 * 60 * 1000) { // < 30min
    return 'high';
  }
  
  // Medium quality: decent confidence + some data
  if (confidence >= 0.6 && sampleSize >= 3 && dataQuality >= 0.6) {
    return 'medium';
  }
  
  // Low quality: everything else
  return 'low';
}

/**
 * 🔄 Map UnifiedPipelineResult metadata source to ProvenanceSource
 */
export function mapMetadataSourceToProvenance(metadataSource: string): ProvenanceSource {
  switch (metadataSource) {
    case 'cache':
      return 'cache';
    case 'fresh':
      // If fresh but with heuristics, map to heuristic; with LLM, map to llm
      // For now, assume fresh = unified (deep analysis)
      return 'unified';
    default:
      // Fallback for unknown sources
      return 'heuristic';
  }
}

/**
 * 🎯 Determine category from module context
 */
function inferCategoryFromModule(module: InsightModule, context?: any): InsightCategory {
  switch (module) {
    case 'mood':
      return 'mood';
    case 'cbt':
      return 'cbt';
    case 'tracking':
      return 'ocd';
    case 'today':
      // For today, infer from content or default to timeline
      return context?.category || 'timeline';
    default:
      return 'timeline';
  }
}

/**
 * 🗺️ Map UnifiedPipelineResult to standardized registry items
 */
export function mapUnifiedResultToRegistryItems(
  result: UnifiedPipelineResult,
  module: InsightModule,
  context?: { trigger?: string; baseCategory?: InsightCategory }
): InsightRegistryItem[] {
  const items: InsightRegistryItem[] = [];
  const baseId = `${module}_${Date.now()}`;
  
  // Extract common metadata
  const provenance: InsightRegistryItem['provenance'] = {
    source: mapMetadataSourceToProvenance(result.metadata.source),
    version: result.metadata.pipelineVersion,
    generatedAt: result.metadata.processedAt,
    ttlMs: result.metadata.cacheTTL,
    trigger: context?.trigger,
  };
  
  const privacy: InsightRegistryItem['privacy'] = {
    piiSanitized: true, // We already sanitize PII
    auditHash: result.metadata.source === 'cache' ? `cache_${result.metadata.processedAt}` : undefined,
  };
  
  const freshnessMs = Date.now() - result.metadata.processedAt;
  const category = context?.baseCategory || inferCategoryFromModule(module);
  
  // 1. Map therapeutic insights → kind='insight'
  if (result.insights?.therapeutic) {
    result.insights.therapeutic.forEach((insight, index) => {
      const confidence = (insight as any).confidence || 0.7;
      const quality: InsightRegistryItem['quality'] = {
        confidence,
        sampleSize: (insight as any).dataPoints || 0,
        dataQuality: confidence, // Use confidence as proxy for data quality
        freshnessMs,
        stability: insight.priority === 'high' ? 0.9 : 0.7, // High priority = more stable
      };
      
      items.push({
        id: `${baseId}_insight_${index}`,
        kind: 'insight',
        category,
        module,
        provenance,
        quality,
        privacy,
        payload: {
          title: 'Therapeutic Insight',
          summary: insight.text,
          metrics: {
            priority: insight.priority,
            category: insight.category,
          },
          actions: [], // No specific actions for generic insights
        },
      });
    });
  }
  
  // 2. Map progress insights → kind='analytics'
  if (result.insights?.progress) {
    result.insights.progress.forEach((progress, index) => {
      const confidence = 0.8; // Progress metrics typically high confidence
      const quality: InsightRegistryItem['quality'] = {
        confidence,
        sampleSize: (progress as any).dataPoints || 1,
        dataQuality: 0.8,
        freshnessMs,
        stability: 0.8,
      };
      
      items.push({
        id: `${baseId}_analytics_${index}`,
        kind: 'analytics',
        category,
        module,
        provenance,
        quality,
        privacy,
        payload: {
          title: `${progress.metric} Analytics`,
          summary: progress.interpretation,
          metrics: {
            metric: progress.metric,
            value: progress.value,
            change: progress.change,
            changeDirection: (progress as any).changeDirection,
          },
          actions: [], // Analytics don't have direct actions
        },
      });
    });
  }
  
  // 3. Map patterns → kind='pattern'
  if (result.patterns && Array.isArray(result.patterns)) {
    result.patterns.forEach((pattern, index) => {
      const confidence = pattern.confidence || 0.7;
      const sampleSize = pattern.dashboardMetrics?.sampleSize || 
                        pattern.data?.sampleSize || 
                        pattern.dataPoints || 0;
      
      const quality: InsightRegistryItem['quality'] = {
        confidence,
        sampleSize,
        dataQuality: pattern.dashboardMetrics?.dataQuality || confidence,
        freshnessMs,
        stability: pattern.severity === 'high' ? 0.9 : 0.7,
      };
      
      items.push({
        id: `${baseId}_pattern_${index}`,
        kind: 'pattern',
        category,
        module,
        provenance,
        quality,
        privacy,
        payload: {
          title: pattern.title || 'Behavior Pattern',
          summary: pattern.description || pattern.pattern || '',
          metrics: {
            type: pattern.type,
            severity: pattern.severity,
            temporal: pattern.temporal,
            dashboardMetrics: pattern.dashboardMetrics,
          },
          actions: pattern.suggestion ? [
            { label: 'Apply Suggestion', screen: `/(tabs)/${module}`, params: { suggestion: pattern.suggestion } }
          ] : [],
        },
      });
    });
  }
  
  // 4. Map analytics blocks → kind='analytics' (enhanced)
  if (result.analytics) {
    Object.entries(result.analytics).forEach(([analyticsKey, analyticsData]: [string, any]) => {
      if (!analyticsData || typeof analyticsData !== 'object') return;
      
      const confidence = analyticsData.confidence || 0.8;
      const sampleSize = analyticsData.sampleSize || 0;
      
      const quality: InsightRegistryItem['quality'] = {
        confidence,
        sampleSize,
        dataQuality: analyticsData.dataQuality || confidence,
        freshnessMs,
        stability: sampleSize >= 10 ? 0.9 : 0.7,
      };
      
      items.push({
        id: `${baseId}_analytics_${analyticsKey}`,
        kind: 'analytics',
        category: analyticsKey as InsightCategory, // mood, cbt, etc.
        module,
        provenance,
        quality,
        privacy,
        payload: {
          title: `${analyticsKey.toUpperCase()} Analytics`,
          summary: `Clinical-grade ${analyticsKey} analysis`,
          metrics: {
            volatility: analyticsData.volatility,
            weeklyDelta: analyticsData.weeklyDelta,
            baselines: analyticsData.baselines,
            correlations: analyticsData.correlations,
            profile: analyticsData.profile,
            bestTimes: analyticsData.bestTimes,
          },
          actions: [
            { label: `View ${analyticsKey} Details`, screen: `/(tabs)/${analyticsKey === 'ocd' ? 'tracking' : analyticsKey}` }
          ],
        },
      });
    });
  }
  
  return items;
}

/**
 * 🔍 Extract quality metadata for UI display
 */
export function extractUIQualityMeta(
  items: InsightRegistryItem[],
  preferredKind?: InsightKind
): {
  source: ProvenanceSource;
  qualityLevel: QualityLevel;
  sampleSize: number;
  freshnessMs: number;
} | null {
  if (!items.length) return null;
  
  // Prefer specific kind if specified, otherwise use first item
  const targetItem = preferredKind 
    ? items.find(item => item.kind === preferredKind) || items[0]
    : items[0];
  
  // Aggregate quality from all items for better representative quality
  const totalSampleSize = items.reduce((sum, item) => sum + (item.quality.sampleSize || 0), 0);
  const avgConfidence = items.reduce((sum, item) => sum + (item.quality.confidence || 0), 0) / items.length;
  const minFreshnessMs = Math.min(...items.map(item => item.quality.freshnessMs || Infinity));
  
  const aggregatedQuality: InsightRegistryItem['quality'] = {
    confidence: avgConfidence,
    sampleSize: totalSampleSize,
    dataQuality: avgConfidence, // Use confidence as proxy
    freshnessMs: minFreshnessMs === Infinity ? 0 : minFreshnessMs,
  };
  
  return {
    source: targetItem.provenance.source,
    qualityLevel: estimateQualityLevel(aggregatedQuality),
    sampleSize: totalSampleSize,
    freshnessMs: minFreshnessMs === Infinity ? 0 : minFreshnessMs,
  };
}
