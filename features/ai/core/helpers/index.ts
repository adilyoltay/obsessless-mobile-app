/**
 * Helper Classes Index
 * 
 * UnifiedAIPipeline için merkezi helper sınıfları.
 * Bu modül, kod tekrarını önler ve merkezi yönetim sağlar.
 * 
 * @since 2025-01 - Monolitik Optimizasyon
 */

export { 
  UnifiedConfidenceCalculator,
  getConfidenceCalculator,
  type ConfidenceParams,
  type ConfidenceResult
} from './UnifiedConfidenceCalculator';

export { 
  BasePatternMatcher,
  getPatternMatcher,
  type Pattern,
  type PatternMatch,
  type PatternType
} from './BasePatternMatcher';

export { 
  PipelineCacheManager,
  getCacheManager,
  type CacheConfig,
  type CacheEntry,
  type CacheStats
} from './PipelineCacheManager';

export { 
  TelemetryWrapper,
  getTelemetryWrapper,
  type TelemetryContext,
  type OperationResult
} from './TelemetryWrapper';

export { 
  ProgressiveEnhancer,
  getProgressiveEnhancer,
  type QuickResult,
  type DeepResult,
  type ProgressiveResult,
  type ProgressiveOptions
} from './ProgressiveEnhancer';

// Re-export singleton instances for convenience
import { getConfidenceCalculator as getConfidence } from './UnifiedConfidenceCalculator';
import { getPatternMatcher as getPatterns } from './BasePatternMatcher';
import { getCacheManager as getCache } from './PipelineCacheManager';
import { getTelemetryWrapper as getTelemetry } from './TelemetryWrapper';
import { getProgressiveEnhancer as getProgressive } from './ProgressiveEnhancer';

export const helpers = {
  confidence: getConfidence,
  patterns: getPatterns,
  cache: getCache,
  telemetry: getTelemetry,
  progressive: getProgressive
} as const;
