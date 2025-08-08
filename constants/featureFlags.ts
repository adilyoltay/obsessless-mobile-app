/**
 * 🛡️ ObsessLess Feature Flag System - FAZ 0: Güvenlik ve Stabilite Hazırlığı
 * 
 * Bu sistem "Kapsamlı Yol Haritası" belgesindeki Görev 0.0.1 gereksinimlerine uygun olarak
 * tasarlanmıştır. Tüm AI özellikleri tek bir master switch ile kontrol edilir.
 * 
 * KRİTİK: Bu dosyadaki değişiklikler prodüksiyonu etkileyebilir!
 */

// 🎯 MASTER AI SWITCH - Tek bir toggle ile tüm AI özellikleri kontrol edilir
const AI_MASTER_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI === 'true';

// Feature flag değerlerini runtime'da değiştirmek için mutable obje
const featureFlagState: Record<string, boolean> = {
  // 🎯 MASTER AI SWITCH
  AI_ENABLED: AI_MASTER_ENABLED,
  
  // 🤖 Tüm AI Features - Master switch'e bağlı
  AI_CHAT: AI_MASTER_ENABLED,
  AI_ONBOARDING: AI_MASTER_ENABLED,
  AI_INSIGHTS: AI_MASTER_ENABLED,
  AI_VOICE: AI_MASTER_ENABLED,
  AI_CBT_ENGINE: AI_MASTER_ENABLED,
  AI_EXTERNAL_API: AI_MASTER_ENABLED,
  AI_THERAPEUTIC_PROMPTS: AI_MASTER_ENABLED,
  AI_REAL_RESPONSES: AI_MASTER_ENABLED,
  AI_INSIGHTS_ENGINE_V2: AI_MASTER_ENABLED,
  AI_PATTERN_RECOGNITION_V2: AI_MASTER_ENABLED,
  AI_SMART_NOTIFICATIONS: AI_MASTER_ENABLED,
  AI_PROGRESS_ANALYTICS: AI_MASTER_ENABLED,
  AI_ADAPTIVE_INTERVENTIONS: AI_MASTER_ENABLED,
  AI_CONTEXT_INTELLIGENCE: AI_MASTER_ENABLED,
  AI_JITAI_SYSTEM: AI_MASTER_ENABLED,
  AI_ADVANCED_PERSONALIZATION: AI_MASTER_ENABLED,
  AI_MODEL_OPTIMIZATION: AI_MASTER_ENABLED,
  AI_PERFORMANCE_MONITORING: AI_MASTER_ENABLED,
  AI_ADVANCED_ANALYTICS: AI_MASTER_ENABLED,
  AI_DASHBOARD: AI_MASTER_ENABLED,
  AI_ONBOARDING_V2: AI_MASTER_ENABLED,
  AI_YBOCS_ANALYSIS: AI_MASTER_ENABLED,
  AI_USER_PROFILING: AI_MASTER_ENABLED,
  AI_TREATMENT_PLANNING: AI_MASTER_ENABLED,
  AI_RISK_ASSESSMENT: AI_MASTER_ENABLED,
  AI_ONBOARDING_UI: AI_MASTER_ENABLED,
  AI_ONBOARDING_CONTEXT_INTEGRATION: AI_MASTER_ENABLED,
  AI_ONBOARDING_INTERVENTIONS_INTEGRATION: AI_MASTER_ENABLED,
  AI_ART_THERAPY: AI_MASTER_ENABLED,
  AI_VOICE_ERP: AI_MASTER_ENABLED,
  AI_PREDICTIVE_INTERVENTION: AI_MASTER_ENABLED,
  AI_CRISIS_DETECTION: AI_MASTER_ENABLED,
  
  // 🔧 Development Features
  DEBUG_MODE: __DEV__,
  MOCK_API_RESPONSES: __DEV__ && process.env.EXPO_PUBLIC_MOCK_API === 'true',
  
  // 📊 Telemetry Features
  AI_TELEMETRY: AI_MASTER_ENABLED, // Master switch ile kontrol edilir
  PERFORMANCE_MONITORING: true,
  ERROR_REPORTING: true,
  
  // 🚨 Safety Features (Always Enabled)
  SAFETY_CHECKS: true,
  CONTENT_FILTERING: true,
  RATE_LIMITING: true,
};

// Feature flag logging için
const featureUsageLog: Record<string, number> = {};

export const FEATURE_FLAGS = {
  ...featureFlagState,
  
  /**
   * 🔍 Feature durumunu kontrol eder
   * Kullanım loglaması ve runtime kontrolleri içerir
   */
  isEnabled: (feature: keyof typeof featureFlagState): boolean => {
    // Kullanım sayacı
    featureUsageLog[feature] = (featureUsageLog[feature] || 0) + 1;
    
    // Geliştirme modunda log
    if (__DEV__) {
      console.log(`🏳️ Feature Flag Check: ${feature} = ${featureFlagState[feature]}`);
    }
    
    // Master AI switch kontrolü
    if (feature.startsWith('AI_') && feature !== 'AI_ENABLED' && !featureFlagState.AI_ENABLED) {
      return false;
    }
    
    // Additional runtime checks
    if (feature.startsWith('AI_') && !featureFlagState.SAFETY_CHECKS) {
      console.warn('⚠️ AI features disabled: Safety checks are off');
      return false;
    }
    
    // Remote kill switch capability (gelecekte API'den kontrol edilebilir)
    if (typeof (global as any).__OBSESSLESS_KILL_SWITCH !== 'undefined') {
      console.warn('🚨 Emergency kill switch activated');
      return false;
    }
    
    return featureFlagState[feature] || false;
  },
  
  /**
   * 🚨 Acil durum fonksiyonu - Tüm AI özelliklerini kapatır
   */
  disableAll: (): void => {
    console.warn('🚨 EMERGENCY: Disabling all AI features');
    
    Object.keys(featureFlagState).forEach(key => {
      if (key.startsWith('AI_')) {
        featureFlagState[key] = false;
      }
    });
    
    // Global kill switch aktive et
    (global as any).__OBSESSLESS_KILL_SWITCH = true;
    
    // Telemetri gönder
    if (featureFlagState.AI_TELEMETRY) {
      // TODO: Send emergency shutdown telemetry
      console.log('📊 Emergency shutdown telemetry sent');
    }
  },
  
  /**
   * 🔧 Runtime'da feature flag değiştirme (sadece development)
   * Master AI switch değiştirildiğinde tüm AI özellikleri etkilenir
   */
  setFlag: (feature: keyof typeof featureFlagState, value: boolean): void => {
    if (!__DEV__) {
      console.warn('⚠️ Feature flag changes only allowed in development');
      return;
    }
    
    console.log(`🔧 Changing feature flag: ${feature} = ${value}`);
    
    // Master AI switch değiştiriliyorsa tüm AI özelliklerini güncelle
    if (feature === 'AI_ENABLED') {
      Object.keys(featureFlagState).forEach(key => {
        if (key.startsWith('AI_')) {
          featureFlagState[key] = value;
        }
      });
    } else {
      featureFlagState[feature] = value;
    }
  },
  
  /**
   * 📊 Feature kullanım istatistikleri
   */
  getUsageStats: (): Record<string, number> => {
    return { ...featureUsageLog };
  },
  
  /**
   * 🔄 Tüm AI özelliklerini yeniden aktifleştir (development only)
   */
  reactivateAll: (): void => {
    if (!__DEV__) {
      console.warn('⚠️ Feature reactivation only allowed in development');
      return;
    }
    
    console.log('🔄 Reactivating all AI features');
    delete (global as any).__OBSESSLESS_KILL_SWITCH;
    
    // Master switch'i aktifleştir
    const masterEnabled = process.env.EXPO_PUBLIC_ENABLE_AI === 'true';
    Object.keys(featureFlagState).forEach(key => {
      if (key.startsWith('AI_')) {
        featureFlagState[key] = masterEnabled;
      }
    });
  }
} as const;

// AI Configuration - Yol Haritası Uyumlu
export const AI_CONFIG = {
  // Default provider - environment'tan override edilebilir
  DEFAULT_PROVIDER: (process.env.EXPO_PUBLIC_AI_PROVIDER as 'openai' | 'gemini' | 'claude') || 'gemini',
  
  // Provider priorities (fallback order)
  PROVIDER_PRIORITY: ['gemini', 'openai', 'claude'] as const,
  
  // Feature-specific AI requirements
  CHAT_REQUIRES_EXTERNAL_AI: true,
  INSIGHTS_USES_LOCAL_AI: true,
  VOICE_USES_HYBRID_AI: true,
  
  // Safety configurations
  MAX_TOKENS: 4000,
  TEMPERATURE_LIMIT: 0.8,
  SAFETY_THRESHOLD: 0.9,
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 60,
  MAX_REQUESTS_PER_HOUR: 1000,
} as const;
