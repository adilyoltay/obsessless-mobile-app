/**
 * 📊 AI Telemetry System - Privacy-First Analytics
 * 
 * Bu sistem AI özelliklerinin kullanımını, performansını ve güvenliğini izler.
 * FAZ 0 güvenlik prensiplerine uygun olarak gizlilik-öncelikli tasarlanmıştır.
 * 
 * ⚠️ CRITICAL: Feature flag kontrolü her telemetri öncesi yapılmalı
 * ⚠️ Kişisel veri asla loglanmaz, sadece usage pattern'ları
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import {
  AIError,
  AIInteractionAnalytics,
  AIInteractionType,
  ErrorSeverity
} from '@/features/ai/types';

const ENVIRONMENT = __DEV__ ? 'development' : 'production';

const SENTRY_DSN = __DEV__
  ? process.env.EXPO_PUBLIC_SENTRY_DSN_DEV
  : process.env.EXPO_PUBLIC_SENTRY_DSN_PROD;

const DATADOG_URL = __DEV__
  ? process.env.EXPO_PUBLIC_DATADOG_URL_DEV
  : process.env.EXPO_PUBLIC_DATADOG_URL_PROD;

const DATADOG_API_KEY = __DEV__
  ? process.env.EXPO_PUBLIC_DATADOG_API_KEY_DEV
  : process.env.EXPO_PUBLIC_DATADOG_API_KEY_PROD;

interface AlertThresholds {
  latencyMs: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
  offlineQueue: { warning: number; critical: number };
}

const ALERT_THRESHOLDS: AlertThresholds = {
  latencyMs: { warning: 3000, critical: 5000 },
  errorRate: { warning: 0.02, critical: 0.05 },
  offlineQueue: { warning: 50, critical: 100 }
};

// =============================================================================
// 📋 TELEMETRY EVENT TYPES
// =============================================================================

/**
 * AI Event türleri
 */
export enum AIEventType {
  // System events
  SYSTEM_INITIALIZED = 'system_initialized',
  SYSTEM_STARTED = 'system_started',
  SYSTEM_STOPPED = 'system_stopped',
  SYSTEM_STATUS = 'system_status',
  EMERGENCY_SHUTDOWN = 'emergency_shutdown',
  FEATURE_ENABLED = 'feature_enabled',
  FEATURE_DISABLED = 'feature_disabled',
  
  // Chat events
  CHAT_SESSION_STARTED = 'chat_session_started',
  CHAT_MESSAGE_SENT = 'chat_message_sent',
  CHAT_RESPONSE_RECEIVED = 'chat_response_received',
  CHAT_SESSION_ENDED = 'chat_session_ended',
  CHAT_ERROR = 'chat_error',
  
  // Insights events
  INSIGHT_GENERATED = 'insight_generated',
  INSIGHT_VIEWED = 'insight_viewed',
  INSIGHT_SHARED = 'insight_shared',
  
  // Crisis events
  CRISIS_DETECTED = 'crisis_detected',
  CRISIS_RESOLVED = 'crisis_resolved',
  EMERGENCY_CONTACT_INITIATED = 'emergency_contact_initiated',
  
  // Performance events
  SLOW_RESPONSE = 'slow_response',
  API_ERROR = 'api_error',
  FALLBACK_TRIGGERED = 'fallback_triggered',
  
  // User experience events
  USER_FEEDBACK_POSITIVE = 'user_feedback_positive',
  USER_FEEDBACK_NEGATIVE = 'user_feedback_negative',
  FEATURE_ABANDONED = 'feature_abandoned',
  
  // Sprint 6: Context Intelligence events
  CONTEXT_INTELLIGENCE_INITIALIZED = 'context_intelligence_initialized',
  CONTEXT_ANALYSIS_COMPLETED = 'context_analysis_completed',
  CONTEXT_INTELLIGENCE_SHUTDOWN = 'context_intelligence_shutdown',
  
  // Sprint 6: Adaptive Interventions events
  ADAPTIVE_INTERVENTIONS_INITIALIZED = 'adaptive_interventions_initialized',
  INTERVENTION_TRIGGERED = 'intervention_triggered',
  INTERVENTION_DELIVERED = 'intervention_delivered',
  INTERVENTION_FEEDBACK = 'intervention_feedback',
  CRISIS_INTERVENTION_TRIGGERED = 'crisis_intervention_triggered',
  ADAPTIVE_INTERVENTIONS_SHUTDOWN = 'adaptive_interventions_shutdown',
  
  // Sprint 6: JITAI events
  JITAI_INITIALIZED = 'jitai_initialized',
  TIMING_PREDICTION_GENERATED = 'timing_prediction_generated',
  INTERVENTION_PERSONALIZED = 'intervention_personalized',
  AB_TEST_VARIATION_APPLIED = 'ab_test_variation_applied',
  AB_TEST_STARTED = 'ab_test_started',
  AB_TEST_STOPPED = 'ab_test_stopped',
  
  // Sprint 7: Onboarding events
  ONBOARDING_ENGINE_INITIALIZED = 'onboarding_engine_initialized',
  ONBOARDING_SESSION_CREATED = 'onboarding_session_created',
  ONBOARDING_STEP_COMPLETED = 'onboarding_step_completed',
  ONBOARDING_STEP_UPDATED = 'onboarding_step_updated',
  ONBOARDING_SESSION_COMPLETED = 'onboarding_session_completed',
  ONBOARDING_ENGINE_SHUTDOWN = 'onboarding_engine_shutdown',
  YBOCS_ANALYSIS_COMPLETED = 'ybocs_analysis_completed',
  TREATMENT_PLAN_GENERATED = 'treatment_plan_generated',
  JITAI_SHUTDOWN = 'jitai_shutdown',
  
  // Sprint 4: CBT Engine events
  CBT_ENGINE_INITIALIZED = 'cbt_engine_initialized',
  CBT_ANALYSIS_COMPLETED = 'cbt_analysis_completed',
  CBT_TECHNIQUE_APPLIED = 'cbt_technique_applied',
  CBT_ENGINE_SHUTDOWN = 'cbt_engine_shutdown',
  
  // Sprint 5: Insights System events  
  INSIGHTS_COORDINATOR_INITIALIZED = 'insights_coordinator_initialized',
  INSIGHT_WORKFLOW_COMPLETED = 'insight_workflow_completed',
  INSIGHTS_COORDINATOR_SHUTDOWN = 'insights_coordinator_shutdown',
  INSIGHTS_REQUESTED = 'insights_requested',
  INSIGHTS_DELIVERED = 'insights_delivered',
  
  // Sprint 7: AI Onboarding Recreation events
  YBOCS_ANALYSIS_STARTED = 'ybocs_analysis_started',
  YBOCS_ANALYSIS_COMPLETED = 'ybocs_analysis_completed',
  YBOCS_ENHANCEMENT_APPLIED = 'ybocs_enhancement_applied',
  
  ONBOARDING_ENGINE_INITIALIZED = 'onboarding_engine_initialized',
  ONBOARDING_SESSION_STARTED = 'onboarding_session_started',
  ONBOARDING_STEP_COMPLETED = 'onboarding_step_completed',
  ONBOARDING_SESSION_COMPLETED = 'onboarding_session_completed',
  ONBOARDING_ENGINE_SHUTDOWN = 'onboarding_engine_shutdown',
  
  USER_PROFILE_GENERATED = 'user_profile_generated',
  USER_PROFILE_ENHANCED = 'user_profile_enhanced',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  
  TREATMENT_PLAN_GENERATED = 'treatment_plan_generated',
  TREATMENT_PLAN_ADAPTED = 'treatment_plan_adapted',
  TREATMENT_PLAN_OPTIMIZED = 'treatment_plan_optimized',
  
  RISK_ASSESSMENT_COMPLETED = 'risk_assessment_completed',
  RISK_ESCALATION_PREDICTED = 'risk_escalation_predicted',
  SAFETY_PLAN_CREATED = 'safety_plan_created',
  PREVENTIVE_INTERVENTION_TRIGGERED = 'preventive_intervention_triggered',
  
  // Production telemetry events
  AI_RESPONSE_GENERATED = 'ai_response_generated',
  AI_PROVIDER_HEALTH_CHECK = 'ai_provider_health_check',
  AI_PROVIDER_FAILED = 'ai_provider_failed',
  AI_CACHE_HIT = 'ai_cache_hit',
  AI_CACHE_MISS = 'ai_cache_miss',
  AI_RATE_LIMIT_HIT = 'ai_rate_limit_hit',
  EXTERNAL_AI_INITIALIZED = 'external_ai_initialized',
  EXTERNAL_AI_SHUTDOWN = 'external_ai_shutdown',
  AI_PII_DETECTED = 'ai_pii_detected',
  AI_CONTENT_FILTERED = 'ai_content_filtered'
}

/**
 * Telemetry event base interface
 */
export interface TelemetryEvent {
  eventType: AIEventType;
  timestamp: string;
  sessionId?: string;
  userId?: string; // Hashed for privacy
  metadata: Record<string, any>;
  
  // Privacy & compliance
  anonymized: boolean;
  retentionDays: number;
  consentLevel: ConsentLevel;
}

/**
 * Consent seviyeleri
 */
export enum ConsentLevel {
  NONE = 'none',           // No tracking
  BASIC = 'basic',         // Essential functionality only
  ANALYTICS = 'analytics', // Usage patterns
  FULL = 'full'           // All telemetry (with user consent)
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  responseTime: number;
  tokenCount?: number;
  modelUsed: string;
  cacheHit: boolean;
  errorCount: number;
  retryCount: number;
}

/**
 * User satisfaction feedback
 */
export interface UserFeedback {
  helpfulness: number; // 1-5
  accuracy: number; // 1-5
  empathy: number; // 1-5
  overallSatisfaction: number; // 1-5
  comment?: string; // Sanitized, no PII
}

// =============================================================================
// 🔧 TELEMETRY CONFIGURATION
// =============================================================================

/**
 * Telemetry konfigürasyonu
 */
interface TelemetryConfig {
  enabled: boolean;
  consentLevel: ConsentLevel;
  bufferSize: number;
  flushIntervalMs: number;
  maxRetentionDays: number;
  anonymizationEnabled: boolean;
  offlineBuffering: boolean;
}

/**
 * Default telemetry config
 */
const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: true,
  consentLevel: ConsentLevel.BASIC,
  bufferSize: 100,
  flushIntervalMs: 30000, // 30 seconds
  maxRetentionDays: 30,
  anonymizationEnabled: true,
  offlineBuffering: true
};

// =============================================================================
// 📊 TELEMETRY MANAGER CLASS
// =============================================================================

class AITelemetryManager {
  private config: TelemetryConfig = DEFAULT_CONFIG;
  private eventBuffer: TelemetryEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;
  private isInitialized: boolean = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  /**
   * Telemetry sistemini başlat
   */
  private async initialize(): Promise<void> {
    try {
      // Kullanıcı consent seviyesini yükle
      await this.loadUserConsent();
      
      // Offline buffer'ı yükle
      if (this.config.offlineBuffering) {
        await this.loadOfflineBuffer();
      }
      
      // Periodic flush başlat
      this.startPeriodicFlush();
      
      this.isInitialized = true;
      console.log('📊 AI Telemetry initialized');
      
    } catch (error) {
      console.error('❌ AI Telemetry initialization failed:', error);
    }
  }

  /**
   * AI etkileşimini track et
   */
  async trackAIInteraction(
    eventType: AIEventType,
    metadata: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    // Feature flag kontrolü FIRST
    if (!FEATURE_FLAGS.isEnabled('AI_TELEMETRY')) {
      return;
    }

    // Telemetry disabled ise skip
    if (!this.config.enabled || this.config.consentLevel === ConsentLevel.NONE) {
      return;
    }

    try {
      const event: TelemetryEvent = {
        eventType,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        userId: userId ? this.hashUserId(userId) : undefined,
        metadata: this.sanitizeMetadata(metadata),
        anonymized: this.config.anonymizationEnabled,
        retentionDays: this.config.maxRetentionDays,
        consentLevel: this.config.consentLevel
      };

      // Event'i buffer'a ekle
      this.addToBuffer(event);

      // Debug log (sadece development)
      if (__DEV__) {
        console.log(`📊 AI Telemetry: ${eventType}`, metadata);
      }

    } catch (error) {
      console.error('❌ Error tracking AI interaction:', error);
    }
  }

  /**
   * AI error'unu track et
   */
  async trackAIError(error: AIError, context?: Record<string, any>): Promise<void> {
    await this.trackAIInteraction(AIEventType.API_ERROR, {
      errorCode: error.code,
      errorMessage: error.message,
      severity: error.severity,
      recoverable: error.recoverable,
      context: this.sanitizeMetadata(context || {})
    });
  }

  /**
   * Performance metrics'i track et
   */
  async trackPerformance(
    feature: string,
    metrics: PerformanceMetrics,
    userId?: string
  ): Promise<void> {
    if (metrics.responseTime > ALERT_THRESHOLDS.latencyMs.critical) {
      await this.trackAIInteraction(AIEventType.SLOW_RESPONSE, {
        feature,
        responseTime: metrics.responseTime,
        modelUsed: metrics.modelUsed
      }, userId);
    }

    await this.trackAIInteraction(AIEventType.CHAT_RESPONSE_RECEIVED, {
      feature,
      ...metrics
    }, userId);

    await this.checkAlerts('latencyMs', metrics.responseTime);

    const total = metrics.errorCount + metrics.retryCount;
    if (total > 0) {
      const errorRate = metrics.errorCount / total;
      await this.checkAlerts('errorRate', errorRate);
    }
  }

  /**
   * User feedback'i track et
   */
  async trackUserFeedback(
    feedback: UserFeedback,
    feature: string,
    userId?: string
  ): Promise<void> {
    const eventType = feedback.overallSatisfaction >= 4 
      ? AIEventType.USER_FEEDBACK_POSITIVE 
      : AIEventType.USER_FEEDBACK_NEGATIVE;

    await this.trackAIInteraction(eventType, {
      feature,
      ...feedback,
      comment: feedback.comment ? this.sanitizeComment(feedback.comment) : undefined
    }, userId);
  }

  /**
   * Crisis detection event'ini track et
   */
  async trackCrisisDetection(
    riskLevel: string,
    triggers: string[],
    userId?: string
  ): Promise<void> {
    await this.trackAIInteraction(AIEventType.CRISIS_DETECTED, {
      riskLevel,
      triggerCount: triggers.length,
      // Trigger'ları sanitize et - specific content'i loglamıyoruz
      triggerTypes: triggers.map(t => this.classifyTrigger(t))
    }, userId);
  }

  /**
   * Analytics export (GDPR uyumlu)
   */
  async exportUserData(userId: string): Promise<TelemetryEvent[]> {
    const hashedUserId = this.hashUserId(userId);
    const userEvents: TelemetryEvent[] = [];

    // Buffer'dan user'a ait event'leri filtrele
    const bufferEvents = this.eventBuffer.filter(
      event => event.userId === hashedUserId
    );
    userEvents.push(...bufferEvents);

    // Offline storage'dan da yükle
    try {
      const offlineEvents = await this.loadUserEventsFromStorage(hashedUserId);
      userEvents.push(...offlineEvents);
    } catch (error) {
      console.error('Error loading user events from storage:', error);
    }

    return userEvents;
  }

  /**
   * User data'sını sil (GDPR right to be forgotten)
   */
  async deleteUserData(userId: string): Promise<void> {
    const hashedUserId = this.hashUserId(userId);

    // Buffer'dan sil
    this.eventBuffer = this.eventBuffer.filter(
      event => event.userId !== hashedUserId
    );

    // Storage'dan sil
    try {
      await this.deleteUserEventsFromStorage(hashedUserId);
      console.log(`🗑️ Deleted telemetry data for user: ${hashedUserId.substring(0, 8)}...`);
    } catch (error) {
      console.error('Error deleting user telemetry data:', error);
    }
  }

  /**
   * Consent seviyesini güncelle
   */
  async updateConsentLevel(level: ConsentLevel): Promise<void> {
    this.config.consentLevel = level;
    
    // Consent'i kaydet
    await AsyncStorage.setItem('ai_telemetry_consent', level);
    
    // Eğer consent kaldırıldıysa, mevcut data'yı temizle
    if (level === ConsentLevel.NONE) {
      this.eventBuffer = [];
      await this.clearStoredEvents();
    }

    console.log(`📊 AI Telemetry consent updated to: ${level}`);
  }

  // =============================================================================
  // 🔒 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * User ID'sini hash'le (privacy için)
   */
  private hashUserId(userId: string): string {
    // Simple hash - production'da crypto hash kullanılmalı
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `user_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Metadata'yı sanitize et - PII çıkar
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    
    // PII olabilecek field'ları çıkar
    const piiFields = ['email', 'phone', 'name', 'address', 'content', 'message'];
    
    for (const field of piiFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }
    
    // String'leri length ile değiştir
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 50) {
        sanitized[key] = `[string_length_${sanitized[key].length}]`;
      }
    }
    
    return sanitized;
  }

  /**
   * Comment'i sanitize et
   */
  private sanitizeComment(comment: string): string {
    // Uzun comment'leri kısalt
    if (comment.length > 100) {
      return `[comment_length_${comment.length}]`;
    }
    
    // PII pattern'larını mask'le
    return comment
      .replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[email]')
      .replace(/\b\d{10,}\b/g, '[phone]')
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[name]');
  }

  /**
   * Trigger type'ını classify et
   */
  private classifyTrigger(trigger: string): string {
    // Trigger content'ini loglamak yerine kategorisini belirle
    if (trigger.includes('suicide') || trigger.includes('death')) {
      return 'suicide_ideation';
    } else if (trigger.includes('harm') || trigger.includes('hurt')) {
      return 'self_harm';
    } else if (trigger.includes('panic') || trigger.includes('anxiety')) {
      return 'anxiety_spike';
    }
    return 'general_distress';
  }

  /**
   * Session ID generate et
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event'i buffer'a ekle
   */
  private addToBuffer(event: TelemetryEvent): void {
    this.eventBuffer.push(event);
    
    // Buffer overflow kontrolü
    if (this.eventBuffer.length > this.config.bufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Buffer'ı flush et
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      // Offline storage'a kaydet
      if (this.config.offlineBuffering) {
        await this.saveEventsToStorage(this.eventBuffer);
      }

      await this.checkAlerts('offlineQueue', this.eventBuffer.length);

      await this.sendToMonitoringPlatform(this.eventBuffer);

      if (__DEV__) {
        console.log(`📊 Flushed ${this.eventBuffer.length} telemetry events`);
      }

      // Buffer'ı temizle
      this.eventBuffer = [];

    } catch (error) {
      console.error('❌ Error flushing telemetry buffer:', error);
    }
  }

  /**
   * Send events to external monitoring platforms
   */
  private async sendToMonitoringPlatform(events: TelemetryEvent[]): Promise<void> {
    const payload = {
      environment: ENVIRONMENT,
      events,
    };
    try {
      if (SENTRY_DSN) {
        await fetch(SENTRY_DSN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (DATADOG_URL) {
        await fetch(DATADOG_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': DATADOG_API_KEY || '',
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (error) {
      console.error('❌ Failed to send telemetry to monitoring platform:', error);
    }
  }

  /**
   * Check metric thresholds and log alerts
   */
  private async checkAlerts(metric: keyof AlertThresholds, value: number): Promise<void> {
    const thresholds = ALERT_THRESHOLDS[metric];
    let level: 'critical' | 'warning' | null = null;
    if (value > thresholds.critical) level = 'critical';
    else if (value > thresholds.warning) level = 'warning';
    if (!level) return;

    await this.trackAIInteraction(AIEventType.SYSTEM_STATUS, {
      alert: metric,
      level,
      value,
    });
  }

  /**
   * Periodic flush başlat
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushIntervalMs);
  }

  /**
   * User consent'ini yükle
   */
  private async loadUserConsent(): Promise<void> {
    try {
      const consent = await AsyncStorage.getItem('ai_telemetry_consent');
      if (consent && Object.values(ConsentLevel).includes(consent as ConsentLevel)) {
        this.config.consentLevel = consent as ConsentLevel;
      }
    } catch (error) {
      console.error('Error loading telemetry consent:', error);
    }
  }

  /**
   * Offline buffer'ı background'da yükle
   */
  private async loadOfflineBuffer(): Promise<void> {
    // UI thread'i bloklamak için InteractionManager kullan
    InteractionManager.runAfterInteractions(async () => {
      try {
        const stored = await AsyncStorage.getItem('ai_telemetry_offline');
        if (stored) {
          const events: TelemetryEvent[] = JSON.parse(stored);
          this.eventBuffer.push(...events);
          
          // Buffer size limit kontrol et
          this.eventBuffer = this.eventBuffer.slice(-this.config.bufferSize);
          
          // Stored events'i temizle
          await AsyncStorage.removeItem('ai_telemetry_offline');
          console.log(`📊 Loaded ${events.length} offline telemetry events`);
        }
      } catch (error) {
        console.error('❌ Failed to load offline telemetry buffer:', error);
        // Telemetry hatasını da track et (recursive error prevention ile)
        this.trackTelemetryError('loadOfflineBuffer', error);
      }
    });
  }

  /**
   * Event'leri background'da storage'a kaydet
   */
  private async saveEventsToStorage(events: TelemetryEvent[]): Promise<void> {
    // UI thread'i bloklamadan background'da kaydet
    InteractionManager.runAfterInteractions(async () => {
      try {
        // Retention policy uygula - eski event'leri filtrele
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.maxRetentionDays);
        
        const filteredEvents = events.filter(event => 
          new Date(event.timestamp) > cutoffDate
        );

        if (filteredEvents.length > 0) {
          await AsyncStorage.setItem(
            'ai_telemetry_offline',
            JSON.stringify(filteredEvents)
          );
        }
      } catch (error) {
        console.error('❌ Error saving events to storage:', error);
        // Storage hatasını da track et (recursive prevention ile)
        this.trackTelemetryError('saveEventsToStorage', error);
      }
    });
  }

  /**
   * User event'lerini storage'dan yükle
   */
  private async loadUserEventsFromStorage(hashedUserId: string): Promise<TelemetryEvent[]> {
    try {
      const stored = await AsyncStorage.getItem('ai_telemetry_offline');
      if (stored) {
        const events: TelemetryEvent[] = JSON.parse(stored);
        return events.filter(event => event.userId === hashedUserId);
      }
    } catch (error) {
      console.error('Error loading user events from storage:', error);
    }
    return [];
  }

  /**
   * User event'lerini storage'dan sil
   */
  private async deleteUserEventsFromStorage(hashedUserId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('ai_telemetry_offline');
      if (stored) {
        const events: TelemetryEvent[] = JSON.parse(stored);
        const filteredEvents = events.filter(event => event.userId !== hashedUserId);
        
        if (filteredEvents.length > 0) {
          await AsyncStorage.setItem('ai_telemetry_offline', JSON.stringify(filteredEvents));
        } else {
          await AsyncStorage.removeItem('ai_telemetry_offline');
        }
      }
    } catch (error) {
      console.error('Error deleting user events from storage:', error);
    }
  }

  /**
   * Tüm stored event'leri temizle
   */
  private async clearStoredEvents(): Promise<void> {
    try {
      await AsyncStorage.removeItem('ai_telemetry_offline');
    } catch (error) {
      console.error('Error clearing stored events:', error);
    }
  }

  /**
   * Telemetry internal error tracking (recursive prevention ile)
   */
  private trackTelemetryError(operation: string, error: any): void {
    // Recursive telemetry error'larını önlemek için basit console log
    console.error(`📊 Telemetry Internal Error [${operation}]:`, error);
    
    // Critical olmayan internal telemetry hatalarını session'da sayar
    if (!this.sessionId.includes('_error_count')) {
      // İlk hata için suffix ekle
      this.sessionId += '_error_count_1';
    } else {
      // Hata sayısını artır
      const parts = this.sessionId.split('_error_count_');
      const count = parseInt(parts[1] || '0') + 1;
      this.sessionId = parts[0] + '_error_count_' + count;
    }
  }

  /**
   * Cleanup on app close
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Final flush
    await this.flushBuffer();
  }
}

// =============================================================================
// 📤 EXPORTED FUNCTIONS
// =============================================================================

// Singleton instance
const telemetryManager = new AITelemetryManager();

/**
 * AI etkileşimini track et
 */
export const trackAIInteraction = async (
  eventType: AIEventType,
  metadata: Record<string, any> = {},
  userId?: string
): Promise<void> => {
  return telemetryManager.trackAIInteraction(eventType, metadata, userId);
};

/**
 * AI error'unu track et
 */
export const trackAIError = async (
  error: AIError | {
    code: AIErrorCode;
    message: string;
    severity: ErrorSeverity;
    context?: Record<string, any>;
  },
  context?: Record<string, any>
): Promise<void> => {
  // If error is not a full AIError, create one
  const fullError: AIError = 'timestamp' in error ? error : {
    ...error,
    timestamp: new Date(),
    recoverable: error.severity !== ErrorSeverity.CRITICAL
  };
  
  return telemetryManager.trackAIError(fullError, context);
};

/**
 * Performance metrics'i track et
 */
export const trackAIPerformance = async (
  feature: string,
  metrics: PerformanceMetrics,
  userId?: string
): Promise<void> => {
  return telemetryManager.trackPerformance(feature, metrics, userId);
};

/**
 * User feedback'i track et
 */
export const trackAIFeedback = async (
  feedback: UserFeedback,
  feature: string,
  userId?: string
): Promise<void> => {
  return telemetryManager.trackUserFeedback(feedback, feature, userId);
};

/**
 * Crisis detection'ı track et
 */
export const trackCrisisDetection = async (
  riskLevel: string,
  triggers: string[],
  userId?: string
): Promise<void> => {
  return telemetryManager.trackCrisisDetection(riskLevel, triggers, userId);
};

/**
 * User data export (GDPR)
 */
export const exportAITelemetryData = async (userId: string): Promise<TelemetryEvent[]> => {
  return telemetryManager.exportUserData(userId);
};

/**
 * User data delete (GDPR)
 */
export const deleteAITelemetryData = async (userId: string): Promise<void> => {
  return telemetryManager.deleteUserData(userId);
};

/**
 * Consent güncelle
 */
export const updateTelemetryConsent = async (level: ConsentLevel): Promise<void> => {
  return telemetryManager.updateConsentLevel(level);
};

/**
 * Cleanup function
 */
export const cleanupTelemetry = async (): Promise<void> => {
  return telemetryManager.cleanup();
};

// Export types for external use
export { 
  AIEventType, 
  ConsentLevel, 
  TelemetryEvent, 
  PerformanceMetrics, 
  UserFeedback 
};