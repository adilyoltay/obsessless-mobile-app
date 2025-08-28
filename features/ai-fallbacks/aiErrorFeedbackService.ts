/**
 * AI Error Feedback Service Fallback - Phase 2
 */

export const AIErrorType = {
  INSIGHTS_GENERATION_FAILED: 'INSIGHTS_GENERATION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  LLM_SERVICE_UNAVAILABLE: 'LLM_SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// Additional types for compatibility
export interface AIErrorContext {
  userId?: string;
  feature?: string;
  heuristicFallback?: boolean;
  fallbackTriggered?: boolean;
}

export const aiErrorFeedbackService = {
  reportError: async (...args: any[]) => {
    // AI error feedback service disabled
    console.warn('AI Error Feedback disabled:', args);
  },
  
  handleAIError: async (...args: any[]) => {
    // AI error handling disabled
    console.warn('AI Error Handling disabled:', args);
  }
};
