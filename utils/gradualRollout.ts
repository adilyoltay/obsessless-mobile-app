/**
 * Gradual Rollout Utility
 * 
 * Unified AI Pipeline'ı kademeli olarak kullanıcılara açmak için kullanılır.
 * User ID'ye göre deterministik hash ile rollout yüzdesi belirlenir.
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import crypto from 'crypto';

/**
 * Check if user should use Unified Pipeline
 */
export function shouldUseUnifiedPipeline(userId: string): boolean {
  // Master toggle check
  if (!FEATURE_FLAGS.AI_UNIFIED_PIPELINE) {
    return false;
  }
  
  // Get rollout percentage
  const percentage = FEATURE_FLAGS.AI_UNIFIED_PIPELINE_PERCENTAGE || 0;
  
  // 100% rollout
  if (percentage >= 100) {
    return true;
  }
  
  // 0% rollout
  if (percentage <= 0) {
    return false;
  }
  
  // Deterministic hash based on user ID
  const hash = crypto.createHash('md5').update(userId).digest('hex');
  const hashValue = parseInt(hash.substring(0, 8), 16);
  const userPercentage = (hashValue % 100) + 1;
  
  // User is in rollout percentage
  return userPercentage <= percentage;
}

/**
 * Get current rollout stats
 */
export function getRolloutStats(): {
  enabled: boolean;
  percentage: number;
  modules: {
    voice: boolean;
    patterns: boolean;
    insights: boolean;
    cbt: boolean;
  };
} {
  return {
    enabled: FEATURE_FLAGS.AI_UNIFIED_PIPELINE,
    percentage: FEATURE_FLAGS.AI_UNIFIED_PIPELINE_PERCENTAGE,
    modules: {
      voice: FEATURE_FLAGS.AI_UNIFIED_VOICE,
      patterns: FEATURE_FLAGS.AI_UNIFIED_PATTERNS,
      insights: FEATURE_FLAGS.AI_UNIFIED_INSIGHTS,
      cbt: FEATURE_FLAGS.AI_UNIFIED_CBT
    }
  };
}

/**
 * Update rollout percentage (for admin use)
 */
export function updateRolloutPercentage(newPercentage: number): void {
  if (newPercentage < 0 || newPercentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }
  
  // In real app, this would update a remote config
  FEATURE_FLAGS.AI_UNIFIED_PIPELINE_PERCENTAGE = newPercentage;
  
  console.log(`🚀 Unified Pipeline rollout updated to ${newPercentage}%`);
}
