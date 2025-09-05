/**
 * Checkin Service Fallback - Phase 2
 */

// Types for compatibility
export interface NLUResult {
  intent: string;
  confidence: number;
  entities: any[];
  mood?: string;
  category?: string;
}

export const multiIntentVoiceAnalysis = async (transcript: string, userId: string) => {
  // AI voice analysis disabled - return basic classification
  console.log('🚫 AI Voice Analysis disabled:', transcript);
  
  return {
    success: false,
    classification: 'mood', // Default to mood category
    confidence: 0.5,
    routing: {
      targetScreen: '/(tabs)/index',
      params: { focus: 'mood' }
    },
    metadata: {
      source: 'disabled',
      processedAt: Date.now()
    }
  };
};

export const simpleNLU = async (text: string) => {
  // AI NLU disabled - return basic result
  return {
    intent: 'mood',
    confidence: 0.5,
    entities: [],
    mood: 'neutral',
    category: 'mood'
  } as NLUResult;
};

export const trackCheckinLifecycle = async (...args: any[]) => {
  // AI checkin tracking disabled
  console.log('🚫 AI Checkin Lifecycle disabled:', args);
};

export const trackRouteSuggested = async (...args: any[]) => {
  // AI route suggestion tracking disabled
  console.log('🚫 AI Route Suggestion disabled:', args);
};

export const decideRoute = (nlu: NLUResult) => {
  // AI route decision disabled - default to REFRAME
  return 'REFRAME' as const;
};

// Additional types for compatibility
export interface UnifiedAnalysisResult {
  success: boolean;
  classification: string;
  confidence: number;
  routing: {
    targetScreen: string;
    params: any;
  };
  metadata: {
    source: string;
    processedAt: number;
  };
}
