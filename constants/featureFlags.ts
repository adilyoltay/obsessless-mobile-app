/**
 * Feature Flags for ObsessLess App
 * AI Features are now ENABLED BY DEFAULT for production readiness
 */

export const FEATURE_FLAGS = {
  // AI Features - All Enabled for Production
  AI_CHAT: true,           // Professional AI Chat with External APIs
  AI_ONBOARDING: true,     // Intelligent Onboarding Flow  
  AI_INSIGHTS: true,       // Smart Pattern Recognition & Insights
  AI_VOICE: true,          // Voice Interface & Recognition
  
  // Development Features
  DEBUG_MODE: __DEV__,     // Only in development
  MOCK_API_RESPONSES: false, // For testing without real API calls
} as const;

// Runtime feature check helper
export const isFeatureEnabled = (feature: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[feature];
};

// AI Configuration
export const AI_CONFIG = {
  // Default provider - can be overridden by environment
  DEFAULT_PROVIDER: 'openai', // 'openai' | 'gemini' | 'claude'
  
  // Provider priorities (fallback order)
  PROVIDER_PRIORITY: ['openai', 'claude', 'gemini'],
  
  // Feature-specific AI requirements
  CHAT_REQUIRES_EXTERNAL_AI: true,
  INSIGHTS_USES_LOCAL_AI: true,
  VOICE_USES_HYBRID_AI: true,
} as const; 