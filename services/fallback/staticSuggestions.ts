/**
 * Static Suggestions Service - Non-AI Fallback
 * Provides simple heuristic suggestions without any AI processing
 */

export const staticSuggestionsService = {
  getQuickMoodSuggestion: async () => {
    // Non-AI static suggestion disabled - return null
    return null;
  },
  
  getFallbackInsight: async () => {
    // Non-AI static insight disabled - return null  
    return null;
  },
  
  generateErrorFallbackInsights: (errorType: string) => {
    // Static fallback insights disabled - return empty array
    return [];
  }
};
