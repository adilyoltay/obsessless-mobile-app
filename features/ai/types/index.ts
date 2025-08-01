/**
 * AI Sistem Tip Tanımları
 * 
 * KRITIK: Bu dosya features/ai/types altında, src/ai/types DEĞİL
 * Tüm import'lar @/ alias kullanmalı, features dışına relative path yok
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Temel AI mesaj yapısı
export interface AIMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: AIMessageMetadata;
}

export interface AIMessageMetadata {
  sessionId: string;
  contextType: 'onboarding' | 'chat' | 'erp' | 'crisis';
  sentiment?: 'positive' | 'neutral' | 'negative';
  confidence?: number;
  therapeutic_intent?: string[];
  safety_score?: number;
}

// AI konfigürasyon
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  fallbackBehavior: 'generic' | 'silence' | 'redirect';
  featureFlag: keyof typeof FEATURE_FLAGS; // Zorunlu feature flag
  safetyThreshold: number;
  privacyMode: 'strict' | 'balanced' | 'minimal';
}

// Konuşma bağlamı
export interface ConversationContext {
  userId: string;
  sessionId: string;
  conversationHistory: AIMessage[];
  userProfile: UserAIProfile;
  currentState: 'stable' | 'elevated' | 'crisis';
  lastInteraction?: Date;
  sessionDuration?: number;
}

export interface UserAIProfile {
  symptomSeverity: number;
  preferredLanguage: 'tr' | 'en';
  triggerWords: string[];
  therapeuticGoals: string[];
  communicationStyle: 'formal' | 'casual' | 'supportive';
  privacyPreferences: PrivacyPreferences;
}

export interface PrivacyPreferences {
  dataRetention: 'minimal' | 'standard' | 'extended';
  analyticsConsent: boolean;
  therapistSharing: boolean;
  anonymizedDataUsage: boolean;
}

// Hata yönetimi
export interface AIError extends Error {
  code: AIErrorCode;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  technicalDetails?: any;
  fallbackAction?: AIFallbackAction;
}

export enum AIErrorCode {
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SAFETY_VIOLATION = 'SAFETY_VIOLATION',
  PRIVACY_VIOLATION = 'PRIVACY_VIOLATION',
  MODEL_ERROR = 'MODEL_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface AIFallbackAction {
  type: 'retry' | 'fallback_response' | 'disable_feature' | 'alert_user';
  data?: any;
}

// Güvenlik ve validasyon
export interface AISafetyCheck {
  passed: boolean;
  score: number;
  violations: SafetyViolation[];
  recommendations: string[];
}

export interface SafetyViolation {
  type: 'crisis_language' | 'harmful_content' | 'privacy_leak' | 'therapeutic_boundary';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedAction: string;
}

// Telemetri
export interface AITelemetryEvent {
  eventType: AIEventType;
  timestamp: Date;
  sessionId: string;
  userId?: string; // Anonim olabilir
  metadata: Record<string, any>;
  privacy_compliant: boolean;
}

export enum AIEventType {
  FEATURE_ENABLED = 'FEATURE_ENABLED',
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  CONVERSATION_START = 'CONVERSATION_START',
  CONVERSATION_END = 'CONVERSATION_END',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  SAFETY_TRIGGERED = 'SAFETY_TRIGGERED',
  FALLBACK_USED = 'FALLBACK_USED'
}

// Response tipler
export interface AIResponse {
  success: boolean;
  data?: AIResponseData;
  error?: AIError;
  telemetry?: AITelemetryEvent;
}

export interface AIResponseData {
  message: AIMessage;
  suggestions?: string[];
  therapeuticInsights?: TherapeuticInsight[];
  nextSteps?: string[];
}

export interface TherapeuticInsight {
  type: 'progress' | 'pattern' | 'suggestion' | 'warning';
  content: string;
  confidence: number;
  clinicalRelevance: number;
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