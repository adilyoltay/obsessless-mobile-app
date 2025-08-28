/**
 * AI Pipeline Fallback - Phase 2
 */

export const process = async (input: any) => {
  // AI pipeline disabled - return comprehensive empty result
  return {
    success: false,
    result: null,
    patterns: [{ temporal: {} }],
    insights: [{ 
      progress: {},
      therapeutic: {},
      id: 'fallback',
      type: 'disabled'
    }],
    analytics: null,
    metadata: { 
      source: 'disabled', 
      processedAt: Date.now(),
      processingTime: 0
    }
  };
};

export const triggerInvalidation = async (type: string, userId: string) => {
  // AI invalidation disabled
  if (__DEV__) {
    console.log(`🚫 AI Invalidation disabled: ${type} for ${userId}`);
  }
};

export const unifiedPipeline = {
  process: async (input: any) => {
    // AI unified pipeline disabled
    return {
      success: false,
      result: null,
      patterns: [{ temporal: {} }],
      insights: [{ 
        progress: {},
        therapeutic: {},
        id: 'fallback',
        type: 'disabled'
      }],
      analytics: null,
      metadata: { 
        source: 'disabled', 
        processedAt: Date.now(),
        processingTime: 0
      }
    };
  }
};
