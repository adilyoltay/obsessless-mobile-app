/**
 * Static Fallback Service - Phase 2
 */

export const staticFallbackService = {
  getQuickMoodSuggestion: async () => {
    // AI static fallback disabled - return null
    return null;
  },
  
  getFallbackInsight: async () => {
    // AI static fallback disabled - return null  
    return null;
  },
  
  generateErrorFallbackInsights: (errorType: string) => {
    // AI static fallback insights disabled - return empty array
    return [];
  }
};
