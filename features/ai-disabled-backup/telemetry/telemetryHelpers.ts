/**
 * 🔒 Telemetry Helpers - Privacy-First Wrappers
 * 
 * Provides feature-flag-checked telemetry functions to avoid unnecessary
 * processing when AI_TELEMETRY is disabled.
 * 
 * CRITICAL: Always use these wrappers instead of direct trackAIInteraction calls
 * to ensure GDPR compliance and performance optimization.
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, trackAIError, AIEventType } from './aiTelemetry';
import type { AIError, ErrorSeverity, AIErrorCode } from '@/features/ai/types';

/**
 * 🔒 Safe AI Interaction Tracking with Feature Flag Check
 * 
 * This wrapper checks AI_TELEMETRY flag BEFORE doing any processing,
 * avoiding unnecessary imports, object creation, and function calls
 * when telemetry is disabled.
 * 
 * @param eventType - The type of AI event to track
 * @param metadata - Event metadata (sanitized, no PII)
 * @param userId - Optional user ID
 */
export const safeTrackAIInteraction = async (
  eventType: AIEventType,
  metadata: Record<string, any> = {},
  userId?: string
): Promise<void> => {
  // 🚫 EARLY EXIT: Check feature flag FIRST to avoid unnecessary work
  if (!FEATURE_FLAGS.isEnabled('AI_TELEMETRY')) {
    return;
  }

  try {
    await trackAIInteraction(eventType, metadata, userId);
  } catch (error) {
    // Telemetry errors should never break the app
    if (__DEV__) {
      console.warn('⚠️ Telemetry failed (non-critical):', error);
    }
  }
};

/**
 * 🔒 Safe AI Error Tracking with Feature Flag Check
 * 
 * @param error - The AI error to track
 * @param context - Additional error context
 */
export const safeTrackAIError = async (
  error: AIError | {
    code: AIErrorCode;
    message: string;
    severity: ErrorSeverity;
    context?: Record<string, any>;
  },
  context?: Record<string, any>
): Promise<void> => {
  // 🚫 EARLY EXIT: Check feature flag FIRST
  if (!FEATURE_FLAGS.isEnabled('AI_TELEMETRY')) {
    return;
  }

  try {
    await trackAIError(error, context);
  } catch (telemetryError) {
    // Telemetry errors should never break the app
    if (__DEV__) {
      console.warn('⚠️ Error telemetry failed (non-critical):', telemetryError);
    }
  }
};

/**
 * 🔒 Conditional AI Interaction Tracking
 * 
 * Only tracks if both condition and feature flag are true.
 * Useful for conditional telemetry based on app state.
 * 
 * @param condition - Whether to track (in addition to flag check)
 * @param eventType - The type of AI event to track
 * @param metadata - Event metadata
 * @param userId - Optional user ID
 */
export const conditionalTrackAIInteraction = async (
  condition: boolean,
  eventType: AIEventType,
  metadata: Record<string, any> = {},
  userId?: string
): Promise<void> => {
  if (!condition) {
    return;
  }

  await safeTrackAIInteraction(eventType, metadata, userId);
};

/**
 * 🔒 Batch AI Interaction Tracking
 * 
 * Efficiently tracks multiple events with a single flag check.
 * Useful for bulk operations or complex workflows.
 * 
 * @param events - Array of events to track
 */
export const batchTrackAIInteractions = async (
  events: Array<{
    eventType: AIEventType;
    metadata?: Record<string, any>;
    userId?: string;
  }>
): Promise<void> => {
  // 🚫 EARLY EXIT: Check feature flag FIRST
  if (!FEATURE_FLAGS.isEnabled('AI_TELEMETRY')) {
    return;
  }

  try {
    // Process all events with single flag check overhead
    const promises = events.map(event => 
      trackAIInteraction(event.eventType, event.metadata || {}, event.userId)
    );
    
    await Promise.allSettled(promises);
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ Batch telemetry failed (non-critical):', error);
    }
  }
};

/**
 * 🔒 Performance-Critical AI Tracking
 * 
 * For high-frequency events where even the flag check overhead
 * needs to be minimized. Caches the flag state.
 */
let cachedTelemetryEnabled: boolean | null = null;
let cacheExpiry = 0;

export const performanceCriticalTrackAI = async (
  eventType: AIEventType,
  metadata: Record<string, any> = {},
  userId?: string
): Promise<void> => {
  // Cache flag check for 30 seconds to minimize overhead
  const now = Date.now();
  if (cachedTelemetryEnabled === null || now > cacheExpiry) {
    cachedTelemetryEnabled = FEATURE_FLAGS.isEnabled('AI_TELEMETRY');
    cacheExpiry = now + 30000; // 30 seconds cache
  }

  if (!cachedTelemetryEnabled) {
    return;
  }

  try {
    await trackAIInteraction(eventType, metadata, userId);
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ Performance-critical telemetry failed:', error);
    }
  }
};

/**
 * 🔒 Feature Flag Telemetry Check
 * 
 * Utility function to check if telemetry is enabled.
 * Useful for complex telemetry logic that needs the flag state.
 */
export const isTelemetryEnabled = (): boolean => {
  return FEATURE_FLAGS.isEnabled('AI_TELEMETRY');
};

/**
 * 🧹 Clear Telemetry Cache
 * 
 * Forces a fresh flag check on the next performance-critical call.
 * Useful when feature flags change at runtime.
 */
export const clearTelemetryCache = (): void => {
  cachedTelemetryEnabled = null;
  cacheExpiry = 0;
};
