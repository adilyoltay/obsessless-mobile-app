/**
 * AI Sistem Tip Tanımları
 * 
 * KRITIK: Bu dosya features/ai/types altında, src/ai/types DEĞİL
 * Tüm import'lar @/ alias kullanmalı, features dışına relative path yok
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';

// features/ai/types/index.ts
// Comprehensive TypeScript interfaces for ObsessLess AI system

export interface AIMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: {
    sessionId?: string;
    contextType?: 'onboarding' | 'chat' | 'erp' | 'crisis';
    sentiment?: 'positive' | 'neutral' | 'negative';
    confidence?: number;
    therapeutic_intent?: string[];
    safety_score?: number;
    // Add more metadata as needed
  };
}

export interface AIMessageMetadata {
  sessionId?: string;
  contextType?: 'onboarding' | 'chat' | 'erp' | 'crisis';
  sentiment?: 'positive' | 'neutral' | 'negative';
  confidence?: number;
  therapeutic_intent?: string[];
  safety_score?: number;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  fallbackBehavior: 'generic' | 'silence' | 'redirect';
  featureFlag: string; // The feature flag associated with this config
  safetyThreshold: number; // Threshold for safety violations
  privacyMode: 'strict' | 'balanced' | 'permissive'; // Data handling mode
}

export interface ConversationContext {
  userId: string;
  sessionId: string;
  conversationHistory: AIMessage[];
  userProfile: UserAIProfile;
  currentState: 'stable' | 'elevated' | 'crisis';
  // Add more context data
}

export interface UserAIProfile {
  symptomSeverity: number;
  preferredLanguage: string;
  triggerWords: string[];
  therapeuticGoals: string[];
  communicationStyle?: 'supportive' | 'direct' | 'empathetic';
  privacyPreferences?: {
    dataRetention: 'minimal' | 'standard' | 'extended';
    analyticsConsent: boolean;
    therapistSharing: boolean;
    anonymizedDataUsage: boolean;
  };
}

export interface TherapeuticInsight {
  type: 'pattern' | 'progress' | 'suggestion' | 'warning';
  content: string;
  confidence: number;
  clinicalRelevance: number;
  timestamp?: Date;
}

export interface AIResponse extends AIMessage {
  processingTime?: number;
  modelUsed?: string;
  fallbackUsed?: boolean;
}

// Error handling types
export enum AIErrorCode {
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SAFETY_VIOLATION = 'SAFETY_VIOLATION',
  PRIVACY_VIOLATION = 'PRIVACY_VIOLATION',
  MODEL_ERROR = 'MODEL_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export interface AIError extends Error {
  code: AIErrorCode;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string; // User-friendly message
  details?: string;
}

// Telemetry event types
export enum AIEventType {
  CHAT_START = 'chat_start',
  CHAT_MESSAGE_SENT = 'chat_message_sent',
  CHAT_MESSAGE_RECEIVED = 'chat_message_received',
  INSIGHT_GENERATED = 'insight_generated',
  CRISIS_DETECTED = 'crisis_detected',
  FEATURE_ENABLED = 'feature_enabled',
  FEATURE_DISABLED = 'feature_disabled',
  ERROR_OCCURRED = 'error',
  PERFORMANCE = 'performance',
  MESSAGE_SENT = 'message_sent', // Generic for any AI interaction
  CONVERSATION_START = 'conversation_start',
  CONVERSATION_END = 'conversation_end',
  SAFETY_TRIGGERED = 'safety_triggered',
}

// Safety check types
export interface SafetyViolation {
  type: 'privacy_leak' | 'therapeutic_boundary' | 'bias' | 'misinformation' | 'crisis_language';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedAction: string;
}

export interface AISafetyCheck {
  passed: boolean;
  score: number; // 0-1, 1 being perfectly safe
  violations: SafetyViolation[];
  recommendations: string[];
}

// Validasyon şemaları
export const AIMessageSchema = {
  content: { required: true, maxLength: 4000 },
  role: { required: true, enum: ['user', 'assistant', 'system'] }
};

export const AIConfigSchema = {
  temperature: { min: 0, max: 2, default: 0.7 },
  maxTokens: { min: 50, max: 4000, default: 1000 },
  safetyThreshold: { min: 0, max: 1, default: 0.8 }
}; 