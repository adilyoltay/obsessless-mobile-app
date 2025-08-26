/**
 * 🎯 LLM Gating Logic - Deterministic rules for when to use LLM
 * 
 * This module implements smart gating logic to determine when LLM analysis
 * is truly needed vs when heuristics are sufficient.
 * 
 * Decision factors:
 * - Quick class type
 * - Heuristic confidence level
 * - Text complexity/length
 * - Recent similar requests
 * 
 * @module needsLLMAnalysis
 * @since v1.0.0
 */

import { QuickClass } from './CoreAnalysisService';
import Constants from 'expo-constants';

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

/**
 * Gating thresholds from environment
 */
const THRESHOLDS = {
  heuristicMoodBreathwork: parseFloat(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_HEURISTIC_MOOD || '0.65'
  ),
  llmLow: parseFloat(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_LOW || '0.60'
  ),
  llmComplex: parseFloat(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_COMPLEX || '0.80'
  ),
  textLength: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_TEXT_LENGTH_THRESHOLD || '280'
  ),
};

// =============================================================================
// 🎯 GATING PARAMETERS
// =============================================================================

/**
 * Parameters for LLM gating decision
 */
export interface LLMGatingParams {
  quickClass: QuickClass;
  heuristicConfidence: number;
  textLen: number;
  lastSimilarHashAt?: number;
  hasComplexPatterns?: boolean;
  userPreference?: 'simple' | 'balanced' | 'advanced';
  contextImportance?: 'low' | 'medium' | 'high';
}

/**
 * Gating decision result
 */
export interface GatingDecision {
  needsLLM: boolean;
  reason: string;
  confidence: number;
  suggestedTimeout?: number;
}

// =============================================================================
// 🎯 MAIN GATING FUNCTION
// =============================================================================

/**
 * Determine if LLM analysis is needed based on deterministic rules
 * 
 * @param params - Gating parameters
 * @returns boolean - true if LLM should be used
 */
export function needsLLMAnalysis(params: LLMGatingParams): boolean {
  const decision = makeGatingDecision(params);
  
  // Log decision for telemetry
  if (__DEV__) {
    console.log('🔍 LLM Gating Decision:', {
      needsLLM: decision.needsLLM,
      reason: decision.reason,
      params: {
        class: params.quickClass,
        confidence: params.heuristicConfidence,
        textLen: params.textLen,
      },
    });
  }
  
  return decision.needsLLM;
}

/**
 * Make detailed gating decision with reasoning
 * 
 * @param params - Gating parameters
 * @returns GatingDecision - Detailed decision with reasoning
 */
export function makeGatingDecision(params: LLMGatingParams): GatingDecision {
  // Rule 1: Simple MOOD and BREATHWORK with high confidence don't need LLM
  if (['MOOD', 'BREATHWORK'].includes(params.quickClass)) {
    if (params.heuristicConfidence >= THRESHOLDS.heuristicMoodBreathwork) {
      return {
        needsLLM: false,
        reason: 'high_confidence_simple_class',
        confidence: params.heuristicConfidence,
      };
    }
  }
  
  // Rule 2: Long complex text with low confidence needs LLM
  if (params.textLen > THRESHOLDS.textLength && 
      params.heuristicConfidence < THRESHOLDS.llmComplex) {
    return {
      needsLLM: true,
      reason: 'complex_text_low_confidence',
      confidence: params.heuristicConfidence,
      suggestedTimeout: 5000, // 5 seconds for complex analysis
    };
  }
  
  // Rule 3: Very low confidence always needs LLM
  if (params.heuristicConfidence < THRESHOLDS.llmLow) {
    return {
      needsLLM: true,
      reason: 'very_low_confidence',
      confidence: params.heuristicConfidence,
      suggestedTimeout: 3000,
    };
  }
  
  // Rule 4: Recent similar request doesn't need LLM (deduplication)
  if (params.lastSimilarHashAt) {
    const hoursSinceLastSimilar = (Date.now() - params.lastSimilarHashAt) / (1000 * 60 * 60);
    if (hoursSinceLastSimilar < 1) {
      return {
        needsLLM: false,
        reason: 'recent_similar_request',
        confidence: params.heuristicConfidence,
      };
    }
  }
  
  // Rule 5: CBT, OCD, Terapi with medium confidence need LLM
  if (['CBT', 'OCD', 'Terapi'].includes(params.quickClass)) {
    if (params.heuristicConfidence < THRESHOLDS.llmComplex) {
      return {
        needsLLM: true,
        reason: 'therapeutic_class_medium_confidence',
        confidence: params.heuristicConfidence,
        suggestedTimeout: 4000,
      };
    }
  }
  
  // Rule 6: User preference override
  if (params.userPreference === 'simple') {
    return {
      needsLLM: false,
      reason: 'user_prefers_simple',
      confidence: params.heuristicConfidence,
    };
  }
  
  if (params.userPreference === 'advanced' && params.heuristicConfidence < 0.9) {
    return {
      needsLLM: true,
      reason: 'user_prefers_advanced',
      confidence: params.heuristicConfidence,
      suggestedTimeout: 5000,
    };
  }
  
  // Rule 7: High context importance override
  if (params.contextImportance === 'high' && params.heuristicConfidence < 0.85) {
    return {
      needsLLM: true,
      reason: 'high_context_importance',
      confidence: params.heuristicConfidence,
      suggestedTimeout: 5000,
    };
  }
  
  // Rule 8: Complex patterns detected
  if (params.hasComplexPatterns) {
    return {
      needsLLM: true,
      reason: 'complex_patterns_detected',
      confidence: params.heuristicConfidence,
      suggestedTimeout: 4000,
    };
  }
  
  // Default: Don't use LLM if we have reasonable confidence
  return {
    needsLLM: false,
    reason: 'default_sufficient_confidence',
    confidence: params.heuristicConfidence,
  };
}

// =============================================================================
// 🔧 HELPER FUNCTIONS
// =============================================================================

/**
 * Check if text contains complex patterns that warrant LLM analysis
 * 
 * @param text - Text to analyze
 * @returns boolean - true if complex patterns detected
 */
export function hasComplexPatterns(text: string): boolean {
  const patterns = [
    // Multiple cognitive distortions
    /(?:asla|her zaman|kesin|imkansız).*(?:asla|her zaman|kesin|imkansız)/i,
    
    // Contradictions
    /(?:ama|fakat|ancak|yine de).*(?:ama|fakat|ancak|yine de)/i,
    
    // Multiple symptoms
    /(?:takıntı|kontrol|temizlik).*(?:takıntı|kontrol|temizlik)/i,
    
    // Emotional complexity
    /(?:üzgün|kızgın|endişeli).*(?:mutlu|rahat|huzurlu)/i,
    
    // Question patterns
    /\?.*\?/,
  ];
  
  return patterns.some(pattern => pattern.test(text));
}

/**
 * Calculate text complexity score
 * 
 * @param text - Text to analyze
 * @returns number - Complexity score (0-1)
 */
export function calculateTextComplexity(text: string): number {
  let score = 0;
  
  // Length factor
  if (text.length > 100) score += 0.2;
  if (text.length > 200) score += 0.2;
  if (text.length > 400) score += 0.2;
  
  // Sentence count
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 3) score += 0.2;
  
  // Complex patterns
  if (hasComplexPatterns(text)) score += 0.2;
  
  return Math.min(score, 1);
}

/**
 * Determine if request is time-sensitive
 * 
 * @param quickClass - Classification
 * @param keywords - Keywords in text
 * @returns boolean - true if time-sensitive
 */
export function isTimeSensitive(quickClass: QuickClass, keywords: string[]): boolean {
  const urgentKeywords = ['acil', 'hemen', 'şimdi', 'yardım', 'panik'];
  const hasUrgentKeyword = keywords.some(k => urgentKeywords.includes(k.toLowerCase()));
  
  const urgentClasses: QuickClass[] = ['BREATHWORK'];
  const isUrgentClass = urgentClasses.includes(quickClass);
  
  return hasUrgentKeyword || isUrgentClass;
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

export default needsLLMAnalysis;
// Types are declared above; avoid re-export conflicts
