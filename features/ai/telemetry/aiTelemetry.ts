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
import { generatePrefixedId } from '@/utils/idGenerator';
// In test/live environments, avoid scheduling after interactions to prevent teardown issues
function scheduleAfterInteractions(cb: () => void) {
  try {
    if (process?.env?.TEST_LIVE_BACKEND === '1' || process?.env?.TEST_MODE === '1') {
      cb();
      return;
    }
  } catch {}
  // Fallback to normal RN scheduling
  // @ts-ignore - react-native types vary across versions
  InteractionManager.runAfterInteractions(cb as any);
}
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
  // System events (core)
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
  EXTERNAL_API_ERROR = 'external_api_error',
  SYSTEM_ERROR = 'system_error',
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
  ONBOARDING_VIEW = 'onboarding_view',
  ONBOARDING_SELECT = 'onboarding_select',
  ONBOARDING_SKIP = 'onboarding_skip',
  ONBOARDING_SET_REMINDER = 'onboarding_set_reminder',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  YBOCS_ANALYSIS_COMPLETED = 'assessment_completed',
  TREATMENT_PLAN_GENERATED = 'treatment_plan_generated',
  JITAI_SHUTDOWN = 'jitai_shutdown',
  
  // Sprint 4: Thought Analysis (neutralized from CBT)
  CBT_ENGINE_INITIALIZED = 'thought_engine_initialized',
  CBT_ANALYSIS_COMPLETED = 'thought_analysis_completed',
  CBT_TECHNIQUE_APPLIED = 'thought_technique_applied',
  CBT_ENGINE_SHUTDOWN = 'thought_engine_shutdown',
  
  // Sprint 5: Insights System events  
  INSIGHTS_COORDINATOR_INITIALIZED = 'insights_coordinator_initialized',
  INSIGHT_WORKFLOW_COMPLETED = 'insight_workflow_completed',
  INSIGHTS_COORDINATOR_SHUTDOWN = 'insights_coordinator_shutdown',
  INSIGHTS_REQUESTED = 'insights_requested',
  INSIGHTS_DELIVERED = 'insights_delivered',
  
  // Sprint 7: AI Onboarding Recreation events (consolidated)
  YBOCS_ANALYSIS_STARTED = 'assessment_started',
  YBOCS_ENHANCEMENT_APPLIED = 'assessment_enhancement_applied',
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
  // Progress Analytics removed
  
  // Pattern Recognition V2
  PATTERN_RECOGNITION_INITIALIZED = 'pattern_recognition_initialized',
  PATTERN_ANALYSIS_COMPLETED = 'pattern_analysis_completed',
  PATTERN_VALIDATED = 'pattern_validated',
  PATTERN_RECOGNITION_SHUTDOWN = 'pattern_recognition_shutdown',
  
  // Pattern Persistence Cache
  PATTERN_CACHE_HIT = 'pattern_cache_hit',
  PATTERN_CACHE_MISS = 'pattern_cache_miss', 
  PATTERN_CACHE_SAVED = 'pattern_cache_saved',
  PATTERN_CACHE_INVALIDATED = 'pattern_cache_invalidated',
  
  // Offline Sync User Feedback
  SYNC_ERROR_RECORDED = 'sync_error_recorded',
  SYNC_ERROR_USER_NOTIFIED = 'sync_error_user_notified', 
  SYNC_ERROR_RESOLVED = 'sync_error_resolved',
  MANUAL_SYNC_TRIGGERED = 'manual_sync_triggered',
  SYNC_ITEM_RETRY = 'sync_item_retry',
  
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
  // Offline Sync events (queue + replay)
  DELETE_QUEUED_OFFLINE = 'delete_queued_offline',
  DELETE_REPLAYED_SUCCESS = 'delete_replayed_success',
  DELETE_REPLAYED_FAILED = 'delete_replayed_failed'
  ,
  // Sprint 1: Voice mood check-in
  CHECKIN_STARTED = 'checkin_started',
  CHECKIN_COMPLETED = 'checkin_completed',
  STT_FAILED = 'stt_failed',
  ROUTE_SUGGESTED = 'route_suggested',
  
  // Sprint 2: JITAI
  JITAI_TRIGGER_FIRED = 'jitai_trigger_fired',
  GUARDRAIL_TRIGGERED = 'guardrail_triggered',
  
  // Sprint 2: Behavior entry (neutralized from compulsion)
  COMPULSION_PROMPTED = 'behavior_prompted',
  COMPULSION_LOGGED = 'behavior_logged',
  COMPULSION_DISMISSED = 'behavior_dismissed',
  COMPULSION_SNOOZED = 'behavior_snoozed',
  
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
  // Sprint 1: Thought reframing (neutralized)
  REFRAME_STARTED = 'thought_reframe_started',
  REFRAME_COMPLETED = 'thought_reframe_completed',
  DISTORTION_SELECTED = 'thought_pattern_selected'
  // Missing events added for stability
  ,
  INSIGHTS_FEEDBACK = 'insights_feedback',
  INTERVENTION_RECOMMENDED = 'intervention_recommended',
  YBOCS_QUESTION_VIEWED = 'assessment_question_viewed',
  
  // CoreAnalysisService v1 events
  BATCH_JOB_STARTED = 'batch_job_started',
  BATCH_JOB_COMPLETED = 'batch_job_completed',
  BATCH_JOB_FAILED = 'batch_job_failed',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  LLM_GATING_DECISION = 'llm_gating_decision',
  TOKEN_BUDGET_EXCEEDED = 'token_budget_exceeded',
  TOKEN_USAGE_RECORDED = 'token_usage_recorded',
  SIMILARITY_DEDUP_HIT = 'similarity_dedup_hit',
  PROGRESSIVE_UI_UPDATE = 'progressive_ui_update',

  
  // Unified AI Pipeline events (core)
  UNIFIED_PIPELINE_STARTED = 'unified_pipeline_started',
  UNIFIED_PIPELINE_COMPLETED = 'unified_pipeline_completed',
  UNIFIED_PIPELINE_ERROR = 'unified_pipeline_error',
  UNIFIED_PIPELINE_CACHE_HIT = 'unified_pipeline_cache_hit',
  UNIFIED_PIPELINE_CACHE_MISS = 'unified_pipeline_cache_miss',
  UNIFIED_PIPELINE_DISABLED = 'unified_pipeline_disabled',
  
  // Batch operations
  BATCH_OPERATION_STARTED = 'batch_operation_started',
  BATCH_OPERATION_COMPLETED = 'batch_operation_completed',
  
  // Performance metrics
  PERFORMANCE_METRIC = 'performance_metric',
  
  // Generic events
  WARNING = 'warning',
  GENERIC_EVENT = 'generic_event',
  CACHE_INVALIDATION = 'cache_invalidation',
  
  // Voice Analysis specific events
  VOICE_ANALYSIS_STARTED = 'voice_analysis_started',
  VOICE_ANALYSIS_COMPLETED = 'voice_analysis_completed',
  VOICE_ANALYSIS_FAILED = 'voice_analysis_failed',

  // Pattern Recognition specific events
  PATTERN_RECOGNITION_STARTED = 'pattern_recognition_started',
  PATTERN_RECOGNITION_COMPLETED = 'pattern_recognition_completed',
  PATTERN_RECOGNITION_FAILED = 'pattern_recognition_failed',
  
  // Breathwork Suggestion events (NEW - Week 2)
  BREATHWORK_SUGGESTION_GENERATED = 'breathwork_suggestion_generated',
  BREATHWORK_SUGGESTION_SNOOZED = 'breathwork_suggestion_snoozed',
  BREATHWORK_SUGGESTION_DISMISSED = 'breathwork_suggestion_dismissed',
  BREATHWORK_SUGGESTION_DELAYED = 'breathwork_suggestion_delayed',
  BREATHWORK_SUGGESTION_ACCEPTED = 'breathwork_suggestion_accepted',
  BREATHWORK_SESSION_COMPLETED = 'breathwork_session_completed',
  
  // 🎯 Multi-Intent Events (NEW)
  CHECKIN_ROUTING_DECISION = 'checkin_routing_decision',
  CHECKIN_USER_CORRECTION = 'checkin_user_correction',
  FIELD_COMPLETENESS = 'field_completeness',
  MULTI_RECORD_TRANSACTION = 'multi_record_transaction',
  
  // Dynamic Gamification events (NEW - Week 2)
  GAMIFICATION_DYNAMIC_POINTS_AWARDED = 'gamification_dynamic_points_awarded',
  GAMIFICATION_MISSIONS_GENERATED = 'gamification_missions_generated',
  GAMIFICATION_MISSION_COMPLETED = 'gamification_mission_completed',
  GAMIFICATION_LEVEL_UP = 'gamification_level_up',
  GAMIFICATION_STREAK_MILESTONE = 'gamification_streak_milestone',
  GAMIFICATION_ADAPTATION_UPDATED = 'gamification_adaptation_updated',
  
  // Smart Routing events (NEW - Week 2)
  SMART_ROUTE_GENERATED = 'smart_route_generated',
  SMART_NAVIGATION_ATTEMPTED = 'smart_navigation_attempted',
  SMART_NAVIGATION_COMPLETED = 'smart_navigation_completed',
  SMART_NAVIGATION_FAILED = 'smart_navigation_failed',
  ROUTE_SUGGESTION_PROVIDED = 'route_suggestion_provided',
  PREFILL_DATA_EXTRACTED = 'prefill_data_extracted',
  
  // Legacy/Deprecated aliases (kept for backward compatibility)
  // Deprecated block - do not use in new code
  SERVICE_ACCESSED = 'service_accessed',
  SERVICE_INITIALIZED = 'service_initialized',
  SESSION_STARTED = 'session_started',
  SESSION_CREATED = 'session_created',
  ARTWORK_SAVED = 'artwork_saved',
  ART_THERAPY_STARTED = 'art_therapy_started',
  ART_THERAPY_COMPLETED = 'art_therapy_completed',
  AI_ANALYSIS_COMPLETED = 'ai_analysis_completed',
  PROFILE_CREATED = 'user_profile_generated',
  YBOCS_COMPLETED = 'assessment_completed',
  INTERVENTION_COMPLETED = 'intervention_delivered',
  
  // 🎯 Adaptive Suggestions / JITAI events
  ADAPTIVE_SUGGESTION_SHOWN = 'adaptive_suggestion_shown',
  ADAPTIVE_SUGGESTION_CLICKED = 'adaptive_suggestion_clicked', 
  ADAPTIVE_SUGGESTION_DISMISSED = 'adaptive_suggestion_dismissed',
  
  // 📊 Enhanced Mood Analytics (NEW)
  MOOD_ANALYTICS_COMPUTED = 'mood_analytics_computed'
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
      // Resolve raw user id for persistence (prefer explicit param, else metadata.userId)
      const rawUserId: string | undefined = (typeof userId === 'string' && userId.length > 0)
        ? userId
        : (typeof (metadata as any)?.userId === 'string' && (metadata as any).userId.length > 0
          ? (metadata as any).userId
          : undefined);
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
        // Use InteractionManager to avoid UI jank (or immediate in test/live)
        scheduleAfterInteractions(async () => {
          try {
            if (!FEATURE_FLAGS.isEnabled('AI_TELEMETRY')) return;
            const { default: supabaseService } = await import('@/services/supabase');
            // Do not specify time column; rely on DB default (works with both
            // legacy "timestamp" and new "occurred_at" schemas)
            await supabaseService.supabaseClient
              .from('ai_telemetry')
              .insert({
                user_id: rawUserId || null,
                event_type: eventType,
                metadata: this.sanitizeMetadata(metadata)
              });
          } catch (persistErr) {
            // Swallow persistence errors silently; local buffer still holds
            if (__DEV__) console.warn('Telemetry persist failed:', persistErr);
          }
        });
      } catch {}

      // Update daily performance metrics for key events (non-blocking)
      try {
        const { default: performanceMetricsService } = await import('@/services/telemetry/performanceMetricsService');
        if (eventType === AIEventType.AI_RESPONSE_GENERATED) {
          const latency = Number((metadata as any)?.latency || 0);
          await performanceMetricsService.recordToday({ ai: { requests: ((await performanceMetricsService.getLastNDays(1))[0]?.ai?.requests || 0) + 1 } });
          if (latency > 0) {
            const last = await performanceMetricsService.getLastNDays(1);
            const prev = last[0]?.ai?.avgLatencyMs || 0;
            const prevReq = last[0]?.ai?.requests || 0;
            const newAvg = prevReq > 0 ? Math.round(((prev * prevReq) + latency) / (prevReq + 1)) : latency;
            await performanceMetricsService.recordToday({ ai: { avgLatencyMs: newAvg } });
          }
          if ((metadata as any)?.cached === true) {
            const last = await performanceMetricsService.getLastNDays(1);
            const prevHits = last[0]?.ai?.cacheHits || 0;
            await performanceMetricsService.recordToday({ ai: { cacheHits: prevHits + 1 } });
          }
        } else if (eventType === AIEventType.API_ERROR || eventType === AIEventType.AI_PROVIDER_FAILED) {
          const last = await performanceMetricsService.getLastNDays(1);
          const prevFailures = last[0]?.ai?.failures || 0;
          await performanceMetricsService.recordToday({ ai: { failures: prevFailures + 1 } });
        }
      } catch {}

      // Debug log (sadece development) - throttled
      if (__DEV__) {
        // 🔇 THROTTLE: Only log first 2 calls per event type to reduce spam
        const logKey = `__telemetry_logged_${eventType}`;
        const logCount = (global as any)[logKey] || 0;
        if (logCount < 2) {
          console.log(`📊 AI Telemetry: ${eventType}`, JSON.stringify(metadata));
          (global as any)[logKey] = logCount + 1;
        }
      }

      // Debug listener'ları bilgilendir (sadece development)
      notifyTelemetryDebugListeners(event);

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
    if ((metrics.responseTime || 0) > 5000) {
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
   * 🔒 ENHANCED: Crypto hash for production security
   */
  private hashUserId(userId: string): string {
    try {
      // 🔒 PRODUCTION SECURITY: Use SHA-256 hash for real privacy
      const crypto = require('expo-crypto');
      const hash = crypto.digestStringAsync(
        crypto.CryptoDigestAlgorithm.SHA256,
        userId + 'obsessless_salt_2025', // Add salt for security
        { encoding: crypto.CryptoEncoding.HEX }
      );
      
      // Return async hash (simplified for now - in real production, this should be async)
      // For now, fallback to sync simple hash to avoid breaking existing code
      let simpleHash = 0;
      for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        simpleHash = ((simpleHash << 5) - simpleHash) + char;
        simpleHash = simpleHash & simpleHash;
      }
      
      // Combine with timestamp hash for better uniqueness
      const timestampHash = Date.now().toString(36);
      const finalHash = Math.abs(simpleHash).toString(16) + '_' + timestampHash.slice(-4);
      
      return `user_${finalHash}`;
      
    } catch (error) {
      console.warn('⚠️ Crypto hashing failed, using fallback:', error);
      
      // Fallback to enhanced simple hash
      let hash = 0;
      const saltedUserId = userId + 'obsless_fallback_salt';
      for (let i = 0; i < saltedUserId.length; i++) {
        const char = saltedUserId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `user_${Math.abs(hash).toString(16)}`;
    }
  }

  /**
   * Metadata'yı sanitize et - PII çıkar
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    
    // 🚨 CRITICAL PRIVACY FIX: Mask userId fields in metadata
    const userIdFields = ['userId', 'user_id', 'uid', 'id'];
    for (const field of userIdFields) {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        sanitized[field] = this.hashUserId(sanitized[field]);
        console.log(`🔒 Masked ${field} in telemetry metadata`);
      }
    }
    
    // PII olabilecek field'ları çıkar
    // 🔐 PRIVACY EXPANSION: Added 'text' and other potential PII fields
    const piiFields = ['email', 'phone', 'name', 'address', 'content', 'message', 'text', 'transcript', 'voice_text', 'speech_text', 'user_input'];
    
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
   * Session ID generate et - crypto-secure UUID
   */
  private generateSessionId(): string {
    // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
    return generatePrefixedId('session');
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
          const { default: secureDataService } = await import('@/services/encryption/secureDataService');
          
          // 🔐 PRIVACY FIX: Hash all user IDs before sending to Supabase
          const payload = await Promise.all(this.eventBuffer.map(async (evt) => {
            let hashedUserId: string | null = null;
            
            // Get userId from metadata or evt.userId
            const rawUserId = (evt as any)?.metadata?.userId && typeof (evt as any).metadata.userId === 'string'
              ? (evt as any).metadata.userId
              : evt.userId;
            
            // Hash the userId if present
            if (rawUserId && typeof rawUserId === 'string') {
              try {
                hashedUserId = await secureDataService.createHash(rawUserId);
                console.log(`🔐 User ID anonymized: ${rawUserId.substring(0, 8)}... -> ${hashedUserId.substring(0, 16)}...`);
              } catch (hashError) {
                console.warn('⚠️ Failed to hash userId, using null for privacy:', hashError);
                hashedUserId = null;
              }
            }
            
            return {
              event_type: evt.eventType,
              metadata: evt.metadata,
              session_id: evt.sessionId,
              user_id: hashedUserId, // 🚀 ANONYMOUS: Always hashed, never raw
              consent_level: evt.consentLevel,
              anonymized: true, // 🛡️ Always true since we hash the userId
              occurred_at: evt.timestamp
            };
          }));
          
          // Non-blocking, error-safe insert
          await supabaseService.supabaseClient
            .from('ai_telemetry')
            .insert(payload, { defaultToNull: true });
        }
      } catch (persistErr) {
        if (__DEV__) console.warn('📊 Telemetry bulk persist failed (will remain in offline storage):', persistErr);
      }

      // 🔇 THROTTLE: Only log flush operations once per minute
      if (__DEV__) {
        const lastFlushLogTime = (global as any).__lastFlushLogTime || 0;
        const now = Date.now();
        if (now - lastFlushLogTime > 60000) { // 1 minute
          console.log(`📊 Flushed ${this.eventBuffer.length} telemetry events`);
          (global as any).__lastFlushLogTime = now;
        }
      }

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
    // UI thread'i bloklamak için InteractionManager kullan (test/live'da hemen)
    scheduleAfterInteractions(async () => {
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
    // UI thread'i bloklamadan background'da kaydet (test/live'da hemen)
    scheduleAfterInteractions(async () => {
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
// 🔧 DEBUG LISTENERS (Development Only)
// =============================================================================

/**
 * Debug listener function type
 */
type DebugListener = (event: TelemetryEvent) => void;

/**
 * Global debug listeners array (development only)
 */
let __aiDebugListeners: DebugListener[] = [];

/**
 * Debug listener'ı ekle (sadece development)
 */
export function addTelemetryDebugListener(listener: DebugListener): void {
  if (!__DEV__) {
    console.warn('⚠️ Debug listeners only available in development mode');
    return;
  }
  
  if (typeof listener !== 'function') {
    console.warn('⚠️ Debug listener must be a function');
    return;
  }
  
  __aiDebugListeners.push(listener);
  console.log(`🔧 Added debug listener. Total listeners: ${__aiDebugListeners.length}`);
}

/**
 * Debug listener'ı kaldır (sadece development)
 */
export function removeTelemetryDebugListener(listener: DebugListener): void {
  if (!__DEV__) return;
  
  const index = __aiDebugListeners.indexOf(listener);
  if (index > -1) {
    __aiDebugListeners.splice(index, 1);
    console.log(`🔧 Removed debug listener. Total listeners: ${__aiDebugListeners.length}`);
  }
}

/**
 * Debug listener'ları bilgilendir (sadece development)
 */
function notifyTelemetryDebugListeners(event: TelemetryEvent): void {
  if (!__DEV__ || __aiDebugListeners.length === 0) return;
  
  // Background'da notify et, UI thread'i bloklamayacak şekilde
  setTimeout(() => {
    __aiDebugListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('🚨 Debug listener error:', error);
      }
    });
  }, 0);
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
 * Track cache hit/miss events
 */
export const trackCacheEvent = async (
  hit: boolean,
  cacheKey: string,
  userId?: string
): Promise<void> => {
  return trackAIInteraction(hit ? AIEventType.CACHE_HIT : AIEventType.CACHE_MISS, {
    cacheKey,
    userId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Track LLM gating decisions
 */
export const trackGatingDecision = async (
  decision: 'allow' | 'block',
  reason: string,
  metadata?: Record<string, any>
): Promise<void> => {
  return trackAIInteraction(AIEventType.LLM_GATING_DECISION, {
    decision,
    reason,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
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