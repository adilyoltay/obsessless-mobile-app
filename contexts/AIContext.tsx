/**
 * 🧠 AI Context Provider - DISABLED
 * 
 * Phase 2: All AI services disabled, minimal context for compatibility.
 */

import React, { createContext, useContext, ReactNode } from 'react';

// Types - minimal for compatibility
interface AIContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  featuresCount: number;
  hasAIInsights: boolean;
  availableFeatures: string[];
  initializeAIServices: () => Promise<void>;
  safeMode: boolean;
}

// Context
const AIContext = createContext<AIContextType | undefined>(undefined);

// Provider component
export function AIContextProvider({ children }: { children: ReactNode }) {
  // All AI disabled - return static values
  const contextValue: AIContextType = {
    isInitialized: true, // Always "initialized" (but disabled)
    isInitializing: false,
    featuresCount: 0, // No AI features
    hasAIInsights: false,
    availableFeatures: [], // No AI features available
    safeMode: false, // No safe mode in fallback
    initializeAIServices: async () => {
      console.log('🚫 AI services disabled (Phase 2)');
    }
  };

  return (
    <AIContext.Provider value={contextValue}>
      {children}
    </AIContext.Provider>
  );
}

// Hook
export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within AIContextProvider');
  }
  return context;
};

// Backwards compatibility exports
export const useAIUserData = () => ({ 
  userData: null,
  hasCompletedOnboarding: false
});
export const useAIActions = () => ({
  triggerInvalidation: async () => {},
  refreshInsights: async () => {},
  generateInsights: async () => null,
});

// Additional hook for AI status (used by SafeModeBanner)
export const useAIStatus = () => ({
  isInitialized: true, // Always initialized (but disabled)
  initializationError: null,
  availableFeatures: [], // No features available
});

// Backwards compatibility alias
export { AIContextProvider as AIProvider };

export default AIContext;
