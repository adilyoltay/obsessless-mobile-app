/**
 * AI Hooks Fallback - Phase 2
 */

export interface AdaptiveSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  show?: boolean;
  category?: string;
  cta?: {
    label: string;
    screen: string;
    params?: any;
  };
}

export const useAdaptiveSuggestion = (userId?: string) => {
  // AI suggestions disabled - return null
  return {
    suggestion: null,
    isLoading: false,
    error: null,
    loading: false,
    generateSuggestion: async (userId?: string) => null,
    generateSuggestionFromPipeline: async (...args: any[]) => null,
    snoozeSuggestion: async (userId?: string, snoozeHours?: number) => {},
    trackSuggestionClick: async (userId?: string, suggestion?: any) => {},
    trackSuggestionDismissal: async (userId?: string, suggestion?: any, snoozeHours?: number) => {},
  };
};
