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
  ErrorSeverity,
  AIErrorCode
} from '@/features/ai/types';

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
  
  // Legacy crisis events removed (use preventive/general events instead)
  
  // Performance events
  SLOW_RESPONSE = 'slow_response',
  API_ERROR = 'api_error',
  FALLBACK_TRIGGERED = 'fallback_triggered',
  
  // User experience events
  USER_FEEDBACK_POSITIVE = 'user_feedback_positive',
  USER_FEEDBACK_NEGATIVE = 'user_feedback_negative',
  FEATURE_ABANDONED = 'feature_abandoned',
  SUGGESTION_SHOWN = 'suggestion_shown',
  SUGGESTION_ACCEPTED = 'suggestion_accepted',
  SUGGESTION_REJECTED = 'suggestion_rejected',
  
  // Sprint 6: Context Intelligence events
  CONTEXT_INTELLIGENCE_INITIALIZED = 'context_intelligence_initialized',
  CONTEXT_ANALYSIS_COMPLETED = 'context_analysis_completed',
  CONTEXT_INTELLIGENCE_SHUTDOWN = 'context_intelligence_shutdown',
  
  // Sprint 6: Adaptive Interventions events
  ADAPTIVE_INTERVENTIONS_INITIALIZED = 'adaptive_interventions_initialized',
  INTERVENTION_TRIGGERED = 'intervention_triggered',
  INTERVENTION_DELIVERED = 'intervention_delivered',
  INTERVENTION_FEEDBACK = 'intervention_feedback',
  // Use PREVENTIVE_INTERVENTION_TRIGGERED for risk-based support
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
  
  // Sprint 7: AI Onboarding Recreation events (consolidated)
  YBOCS_ANALYSIS_STARTED = 'ybocs_analysis_started',
  YBOCS_ENHANCEMENT_APPLIED = 'ybocs_enhancement_applied',
  ONBOARDING_SESSION_STARTED = 'onboarding_session_started',
  
  USER_PROFILE_GENERATED = 'user_profile_generated',
  USER_PROFILE_ENHANCED = 'user_profile_enhanced',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  
  // duplicate removed
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
  ,
  // Prompts (sanitized) logging
  AI_PROMPT_LOGGED = 'ai_prompt_logged',
  // Progress Analytics
  PROGRESS_ANALYTICS_INITIALIZED = 'progress_analytics_initialized',
  PROGRESS_ANALYSIS_COMPLETED = 'progress_analysis_completed',
  PROGRESS_ANALYTICS_SHUTDOWN = 'progress_analytics_shutdown',
  
  // Pattern Recognition V2
  PATTERN_RECOGNITION_INITIALIZED = 'pattern_recognition_initialized',
  PATTERN_ANALYSIS_COMPLETED = 'pattern_analysis_completed',
  PATTERN_VALIDATED = 'pattern_validated',
  PATTERN_RECOGNITION_SHUTDOWN = 'pattern_recognition_shutdown',
  
  // Insights Engine V2
  INSIGHTS_ENGINE_INITIALIZED = 'insights_engine_initialized',
  INSIGHTS_GENERATED = 'insights_generated',
  INSIGHTS_ENGINE_SHUTDOWN = 'insights_engine_shutdown',
  // Insights specialization
  INSIGHTS_RATE_LIMITED = 'insights_rate_limited',
  INSIGHTS_CACHE_HIT = 'insights_cache_hit',
  INSIGHTS_CACHE_MISS = 'insights_cache_miss',
  INSIGHTS_MISSING_REQUIRED_FIELDS = 'insights_missing_required_fields',
  NO_INSIGHTS_GENERATED = 'no_insights_generated',
  // Storage reliability
  STORAGE_RETRY_ATTEMPT = 'storage_retry_attempt',
  STORAGE_RETRY_SUCCESS = 'storage_retry_success',
  STORAGE_RETRY_FAILED = 'storage_retry_failed',
  
  // Smart Notifications
  SMART_NOTIFICATIONS_INITIALIZED = 'smart_notifications_initialized',
  NOTIFICATION_SCHEDULED = 'notification_scheduled',
  NOTIFICATION_PREFERENCES_UPDATED = 'notification_preferences_updated',
  NOTIFICATION_FEEDBACK = 'notification_feedback',
  SMART_NOTIFICATIONS_SHUTDOWN = 'smart_notifications_shutdown',
  
  // Therapeutic Prompts
  THERAPEUTIC_PROMPTS_INITIALIZED = 'therapeutic_prompts_initialized'
  ,
  // Insights data insufficiency
  INSIGHTS_DATA_INSUFFICIENT = 'insights_data_insufficient'
  ,
  // Sprint 1: Voice mood check-in
  CHECKIN_STARTED = 'checkin_started',
  CHECKIN_COMPLETED = 'checkin_completed',
  STT_FAILED = 'stt_failed',
  ROUTE_SUGGESTED = 'route_suggested',
  
  // Sprint 2: JITAI + ERP coach
  JITAI_TRIGGER_FIRED = 'jitai_trigger_fired',
  ERP_SESSION_STARTED = 'erp_session_started',
  ERP_SESSION_FINISHED = 'erp_session_finished',
  GUARDRAIL_TRIGGERED = 'guardrail_triggered',
  
  // Sprint 2: Compulsion quick entry
  COMPULSION_PROMPTED = 'compulsion_prompted',
  COMPULSION_LOGGED = 'compulsion_logged',
  COMPULSION_DISMISSED = 'compulsion_dismissed',
  COMPULSION_SNOOZED = 'compulsion_snoozed',
  
  // Sprint 2: Relapse window
  RELAPSE_WINDOW_DETECTED = 'relapse_window_detected',
  PROACTIVE_PROMPT_CLICKED = 'proactive_prompt_clicked',
  
  // Sprint 1: PDF export
  PDF_GENERATED = 'pdf_generated',
  PDF_SHARED = 'pdf_shared',
  PDF_CANCELLED = 'pdf_cancelled',
  PDF_ERROR = 'pdf_error'
  ,
  // Sprint 1: Breathwork
  BREATH_STARTED = 'breath_started',
  BREATH_PAUSED = 'breath_paused',
  BREATH_RESUMED = 'breath_resumed',
  BREATH_COMPLETED = 'breath_completed',
  // Sprint 1: CBT Thought Record
  REFRAME_STARTED = 'reframe_started',
  REFRAME_COMPLETED = 'reframe_completed',
  DISTORTION_SELECTED = 'distortion_selected'
  // Missing events added for stability
  ,
  INSIGHTS_FEEDBACK = 'insights_feedback',
  INTERVENTION_RECOMMENDED = 'intervention_recommended',
  YBOCS_QUESTION_VIEWED = 'ybocs_question_viewed'
}

// Build a runtime set for event validation (after enum declaration)
const VALID_EVENT_TYPES: Set<string> = new Set<string>(Object.values(AIEventType));

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
  private suggestionStats = {
    shown: [] as Date[],
    accepted: [] as Date[],
    rejected: [] as Date[]
  };

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
    // Guard: enforce valid event type
    if (!eventType || typeof eventType !== 'string' || (VALID_EVENT_TYPES.size && !VALID_EVENT_TYPES.has(eventType))) {
      if (__DEV__) console.warn('⚠️ Telemetry eventType missing/invalid, dropping event:', eventType);
      return;
    }
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
        userId: userId && typeof userId === 'string' && userId.length > 0 ? this.hashUserId(userId) : undefined,
        metadata: this.sanitizeMetadata(metadata),
        anonymized: this.config.anonymizationEnabled,
        retentionDays: this.config.maxRetentionDays,
        consentLevel: this.config.consentLevel
      };

      // Event'i buffer'a ekle
      this.addToBuffer(event);

      // Persist a minimal copy to Supabase (non-blocking)
      try {
        // Use InteractionManager to avoid UI jank
        InteractionManager.runAfterInteractions(async () => {
          try {
            if (!FEATURE_FLAGS.isEnabled('AI_TELEMETRY')) return;
            const { default: supabaseService } = await import('@/services/supabase');
            // Do not specify time column; rely on DB default (works with both
            // legacy "timestamp" and new "occurred_at" schemas)
            await supabaseService.supabaseClient
              .from('ai_telemetry')
              .insert({
                user_id: userId || null,
                event_type: eventType,
                metadata: this.sanitizeMetadata(metadata)
              });
          } catch (persistErr) {
            // Swallow persistence errors silently; local buffer still holds
            if (__DEV__) console.warn('Telemetry persist failed:', persistErr);
          }
        });
      } catch {}

      // Debug log (sadece development)
      if (__DEV__) console.log(`📊 AI Telemetry: ${eventType}`, JSON.stringify(metadata));

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
    // Slow response detection
    if (metrics.responseTime > 5000) {
      await this.trackAIInteraction(AIEventType.SLOW_RESPONSE, {
        feature,
        responseTime: metrics.responseTime,
        modelUsed: metrics.modelUsed
      }, userId);
    }

    // General performance tracking
    await this.trackAIInteraction(AIEventType.CHAT_RESPONSE_RECEIVED, {
      feature,
      ...metrics
    }, userId);
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
  // Legacy crisis tracking removed in favor of preventive/general events

  /**
   * Track suggestion usage and feedback
   */
  async trackSuggestionUsage(
    action: 'shown' | 'accepted' | 'rejected',
    suggestionId?: string,
    userId?: string
  ): Promise<void> {
    const eventMap = {
      shown: AIEventType.SUGGESTION_SHOWN,
      accepted: AIEventType.SUGGESTION_ACCEPTED,
      rejected: AIEventType.SUGGESTION_REJECTED,
    } as const;

    this.suggestionStats[action].push(new Date());

    await this.trackAIInteraction(eventMap[action], { suggestionId }, userId);
  }

  /**
   * Get suggestion statistics for a given period
   */
  getSuggestionStats(days: number): { usage: number; acceptanceRate: number } {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const shown = this.suggestionStats.shown.filter(d => d >= cutoff).length;
    const accepted = this.suggestionStats.accepted.filter(d => d >= cutoff).length;
    const usage = shown;
    const acceptanceRate = shown ? accepted / shown : 0;
    return { usage, acceptanceRate };
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

      // Production'da analytics (Supabase) toplu gönderim
      try {
        if (FEATURE_FLAGS.isEnabled('AI_TELEMETRY')) {
          const { default: supabaseService } = await import('@/services/supabase');
          const payload = this.eventBuffer.map(evt => ({
            event_type: evt.eventType,
            metadata: evt.metadata,
            session_id: evt.sessionId,
            user_id: evt.userId || null,
            consent_level: evt.consentLevel,
            anonymized: evt.anonymized,
            occurred_at: evt.timestamp
          }));
          // Non-blocking, error-safe insert
          await supabaseService.supabaseClient
            .from('ai_telemetry')
            .insert(payload, { defaultToNull: true });
        }
      } catch (persistErr) {
        if (__DEV__) console.warn('📊 Telemetry bulk persist failed (will remain in offline storage):', persistErr);
      }

      if (__DEV__) console.log(`📊 Flushed ${this.eventBuffer.length} telemetry events`);

      // Buffer'ı temizle
      this.eventBuffer = [];

    } catch (error) {
      console.error('❌ Error flushing telemetry buffer:', error);
    }
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
// Deprecated: use trackAIInteraction(AIEventType.PREVENTIVE_INTERVENTION_TRIGGERED, ...) instead
export const trackCrisisDetection = async (
  riskLevel: string,
  triggers: string[],
  userId?: string
): Promise<void> => {
  return telemetryManager.trackAIInteraction(AIEventType.PREVENTIVE_INTERVENTION_TRIGGERED, {
    riskLevel,
    triggerCount: triggers.length,
    triggerTypes: triggers.map(t => telemetryManager['classifyTrigger']?.(t) || 'general')
  }, userId);
};

/**
 * Track suggestion usage events
 */
export const trackSuggestionUsage = async (
  action: 'shown' | 'accepted' | 'rejected',
  suggestionId?: string,
  userId?: string
): Promise<void> => {
  return telemetryManager.trackSuggestionUsage(action, suggestionId, userId);
};

/**
 * Get suggestion statistics for charts
 */
export const getSuggestionStats = (days: number) => {
  return telemetryManager.getSuggestionStats(days);
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

// Types already exported via 'export' declarations above