/**
 * No-op Telemetry Service
 * 
 * AI cleanup sonrası kullanılacak dummy telemetry servisi.
 * Tüm telemetry çağrılarını sessizce yok sayar.
 * Production'da gerçek telemetry servisi ile değiştirilebilir.
 */

// AI'dan kalan enum'ları koruyoruz compatibility için - COMPREHENSIVE VERSION
export const AIEventType = {
  // Core telemetry
  SYSTEM_STATUS: 'SYSTEM_STATUS',
  UNIFIED_PIPELINE_CACHE_HIT: 'UNIFIED_PIPELINE_CACHE_HIT',
  UNIFIED_PIPELINE_CACHE_MISS: 'UNIFIED_PIPELINE_CACHE_MISS',
  STORAGE_RETRY_SUCCESS: 'STORAGE_RETRY_SUCCESS',
  EMERGENCY_SHUTDOWN: 'EMERGENCY_SHUTDOWN',
  INSIGHTS_DELIVERED: 'INSIGHTS_DELIVERED',
  ADAPTIVE_SUGGESTION_CLICKED: 'ADAPTIVE_SUGGESTION_CLICKED',
  
  // Service telemetry  
  SERVICE_ACCESSED: 'SERVICE_ACCESSED',
  API_ERROR: 'API_ERROR',
  CACHE_INVALIDATION: 'CACHE_INVALIDATION',
  
  // Delete operations
  DELETE_QUEUED_OFFLINE: 'DELETE_QUEUED_OFFLINE',
  DELETE_REPLAYED_SUCCESS: 'DELETE_REPLAYED_SUCCESS',
  DELETE_REPLAYED_FAILED: 'DELETE_REPLAYED_FAILED',
  
  // Sync operations
  SYNC_ERROR_RECORDED: 'SYNC_ERROR_RECORDED',
  SYNC_ERROR_USER_NOTIFIED: 'SYNC_ERROR_USER_NOTIFIED',
  SYNC_ERROR_RESOLVED: 'SYNC_ERROR_RESOLVED',
  MANUAL_SYNC_TRIGGERED: 'MANUAL_SYNC_TRIGGERED',
  SYNC_ITEM_RETRY: 'SYNC_ITEM_RETRY',
  
  // Breathwork events  
  BREATH_STARTED: 'BREATH_STARTED',
  BREATH_PAUSED: 'BREATH_PAUSED',
  BREATH_RESUMED: 'BREATH_RESUMED',
  BREATH_COMPLETED: 'BREATH_COMPLETED',
  
  // Voice & NLU events
  SUGGESTION_SHOWN: 'SUGGESTION_SHOWN',
  ROUTE_SUGGESTED: 'ROUTE_SUGGESTED',
  
  // Onboarding events
  ONBOARDING_VIEW: 'ONBOARDING_VIEW',
  ONBOARDING_SELECT: 'ONBOARDING_SELECT',
  ONBOARDING_SKIP: 'ONBOARDING_SKIP',
  ONBOARDING_SET_REMINDER: 'ONBOARDING_SET_REMINDER',
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED'
} as const;

export type AIEventType = typeof AIEventType[keyof typeof AIEventType];

/**
 * No-op telemetry function
 * Tüm parametreleri kabul eder ama hiçbir şey yapmaz
 * 3 parametre (eventType, data, userId) veya 2 parametre (eventType, data) destekler
 */
export const trackAIInteraction = (
  eventType: AIEventType | string,
  data?: Record<string, any>,
  userIdOrOptions?: string | Record<string, any>
): Promise<void> => {
  // Development'da telemetry çağrılarını görmek için
  if (__DEV__) {
    console.log(`[NOOP-TELEMETRY] ${eventType}:`, data, userIdOrOptions);
  }
  
  // Promise döndür ki await'li çağrılar çalışmaya devam etsin
  return Promise.resolve();
};

/**
 * Safe track function for backward compatibility
 * Same signature as trackAIInteraction
 */
export const safeTrackAIInteraction = (
  eventType: AIEventType | string,
  data?: Record<string, any>,
  userIdOrOptions?: string | Record<string, any>
): Promise<void> => {
  return trackAIInteraction(eventType, data, userIdOrOptions);
};

/**
 * Default export for easier imports
 */
export default {
  trackAIInteraction,
  safeTrackAIInteraction,
  AIEventType
};
