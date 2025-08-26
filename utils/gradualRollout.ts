/**
 * Gradual Rollout Utility
 * 
 * Unified AI Pipeline'ı kademeli olarak kullanıcılara açmak için kullanılır.
 * User ID'ye göre deterministik hash ile rollout yüzdesi belirlenir.
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';

/**
 * Simple deterministic hash function for React Native
 * Replaces crypto module which is not available in React Native
 */
function simpleHash(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}

/**
 * Check if user should use Unified Pipeline
 */
export function shouldUseUnifiedPipeline(userId: string): boolean {
  // Single flag decides; numeric percentage removed
  return !!FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE');
}

/**
 * Get current rollout stats
 */
export function getRolloutStats(): {
  enabled: boolean;
  modules: {
    voice: boolean;
    patterns: boolean;
    insights: boolean;
  };
} {
  return {
    enabled: FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE'),
    modules: {
      voice: FEATURE_FLAGS.isEnabled('AI_UNIFIED_VOICE'),
      patterns: FEATURE_FLAGS.isEnabled('AI_UNIFIED_PATTERNS'),
      insights: FEATURE_FLAGS.isEnabled('AI_UNIFIED_INSIGHTS')
    }
  };
}

/**
 * Update rollout percentage (for admin use)
 */
export function updateRolloutPercentage(_newPercentage: number): void {
  // Deprecated: rollout percentage removed. Keep function for compatibility.
  console.log('🚀 Unified Pipeline rollout uses boolean flag only');
}
