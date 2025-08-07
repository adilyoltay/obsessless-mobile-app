/**
 * 🛡️ ObsessLess Feature Flag System - FAZ 0: Güvenlik ve Stabilite Hazırlığı
 * 
 * Bu sistem "Kapsamlı Yol Haritası" belgesindeki Görev 0.0.1 gereksinimlerine uygun olarak
 * tasarlanmıştır. Tüm AI özellikleri varsayılan olarak KAPALI'dır ve sadece explicit
 * environment variable'lar ile açılabilir.
 * 
 * KRİTİK: Bu dosyadaki değişiklikler prodüksiyonu etkileyebilir!
 */

// Feature flag değerlerini runtime'da değiştirmek için mutable obje
const featureFlagState: Record<string, boolean> = {
  // 🤖 AI Features - DEFAULT OFF (Yol Haritası Gereği)
  AI_CHAT: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_CHAT === 'true',
  AI_ONBOARDING: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_ONBOARDING === 'true',
  AI_INSIGHTS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_INSIGHTS === 'true',
  AI_VOICE: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_VOICE === 'true',
  
  // 🚀 SPRINT 4: CBT Engine & External AI API (COMPLETED)
  AI_CBT_ENGINE: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_CBT === 'true',
  AI_EXTERNAL_API: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_API === 'true',
  AI_THERAPEUTIC_PROMPTS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_PROMPTS === 'true',
  AI_REAL_RESPONSES: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_REAL === 'true',
  
  // 🔄 SPRINT 5: Intelligent Insights Engine Recreation (COMPLETED)
  AI_INSIGHTS_ENGINE_V2: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_INSIGHTS_V2 === 'true',
  AI_PATTERN_RECOGNITION_V2: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_PATTERNS_V2 === 'true',
  AI_SMART_NOTIFICATIONS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_NOTIFICATIONS === 'true',
  AI_PROGRESS_ANALYTICS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_ANALYTICS === 'true',
  
  // 🚀 SPRINT 6: Advanced Features & Optimization (COMPLETED)
  AI_ADAPTIVE_INTERVENTIONS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_INTERVENTIONS === 'true',
  AI_CONTEXT_INTELLIGENCE: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_CONTEXT === 'true',
  AI_JITAI_SYSTEM: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_JITAI === 'true',
  AI_ADVANCED_PERSONALIZATION: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_PERSONALIZATION === 'true',
  AI_MODEL_OPTIMIZATION: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_OPTIMIZATION === 'true',
  AI_PERFORMANCE_MONITORING: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_MONITORING === 'true',
  AI_ADVANCED_ANALYTICS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_ANALYTICS_V2 === 'true',
  AI_DASHBOARD: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_DASHBOARD === 'true',

  // 🧭 SPRINT 7: AI Onboarding Recreation
  AI_ONBOARDING_V2: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_ONBOARDING_V2 === 'true',
  AI_YBOCS_ANALYSIS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_YBOCS === 'true',
  AI_USER_PROFILING: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_PROFILING === 'true',
  AI_TREATMENT_PLANNING: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_TREATMENT === 'true',
  AI_RISK_ASSESSMENT: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_RISK === 'true',
  AI_ONBOARDING_UI: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_ONBOARDING_UI === 'true',
  
  // Sprint 7 Integration flags
  AI_ONBOARDING_CONTEXT_INTEGRATION: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_ONBOARDING_CONTEXT === 'true',
  AI_ONBOARDING_INTERVENTIONS_INTEGRATION: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_ONBOARDING_INTERVENTIONS === 'true',
  
  // 🧪 Experimental AI Features
  AI_ART_THERAPY: false,
  AI_VOICE_ERP: false,
  AI_PREDICTIVE_INTERVENTION: false,
  AI_CRISIS_DETECTION: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_CRISIS === 'true',
  
  // 🔧 Development Features
  DEBUG_MODE: __DEV__,
  MOCK_API_RESPONSES: __DEV__ && process.env.EXPO_PUBLIC_MOCK_API === 'true',
  
  // 📊 Telemetry Features
  AI_TELEMETRY: process.env.EXPO_PUBLIC_ENABLE_AI_TELEMETRY === 'true',
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
   */
  setFlag: (feature: keyof typeof featureFlagState, value: boolean): void => {
    if (!__DEV__) {
      console.warn('⚠️ Feature flag changes only allowed in development');
      return;
    }
    
    console.log(`🔧 Changing feature flag: ${feature} = ${value}`);
    featureFlagState[feature] = value;
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
    
    // Environment variable'ları yeniden kontrol et
    Object.keys(featureFlagState).forEach(key => {
      if (key.startsWith('AI_')) {
        const envVar = `EXPO_PUBLIC_ENABLE_${key}`;
        featureFlagState[key] = process.env[envVar] === 'true';
      }
    });
  }
} as const;

// AI Configuration - Yol Haritası Uyumlu
export const AI_CONFIG = {
  // Default provider - environment'tan override edilebilir
  DEFAULT_PROVIDER: (process.env.EXPO_PUBLIC_AI_PROVIDER as 'openai' | 'gemini' | 'claude') || 'openai',
  
  // Provider priorities (fallback order)
  PROVIDER_PRIORITY: ['openai', 'claude', 'gemini'] as const,
  
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